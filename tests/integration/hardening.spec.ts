import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { FriendsService } from '../../apps/api/src/social/friends.service';
import { ChallengesService } from '../../apps/api/src/social/challenges.service';
import { challengeSchema, challengeAcceptSchema } from '@lifequest/contracts';
import { dateOnly, localDate } from '@lifequest/domain';
import { DashboardService } from '../../apps/api/src/core/dashboard.service';
import { habitStreaks } from '../../apps/api/src/core/habit-streaks';
import { DatabaseRateLimit } from '../../apps/api/src/common/rate-limit';
import { XpService } from '../../apps/api/src/gamification/xp.service';
import { AttachmentStorage } from '../../apps/api/src/core/attachment-storage';
import { AttachmentCleanup } from '../../apps/api/src/core/attachment-cleanup';

let app: INestApplication;
let db: Database;
const password = 'isolated-hardening-password';
async function account() {
  return db.user.create({
    data: {
      email: `${randomUUID()}@hardening.test`,
      passwordHash: await argon2.hash(password),
      profile: { create: { displayName: 'Security fixture', timezone: 'UTC' } },
    },
  });
}
beforeAll(async () => {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: process.env,
    stdio: 'pipe',
  });
  app = configureApp(
    await NestFactory.create(AppModule, { logger: false, bodyParser: false, abortOnError: false }),
  );
  await app.init();
  db = app.get(Database);
  await db.lifeArea.upsert({
    where: { id: 'hardening-area' },
    create: {
      id: 'hardening-area',
      slug: 'hardening-area',
      name: 'Testing',
      nameAr: 'اختبار',
      color: 'mint',
      icon: 'sun',
    },
    update: {},
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await app?.close();
});

describe('Security boundaries under malformed requests and concurrent account changes', () => {
  it('rolls back attachment content with its enclosing transaction', async () => {
    const storage = app.get(AttachmentStorage);
    let key = '';
    await expect(
      db.$transaction(async (tx) => {
        key = await storage.put(Buffer.from('rollback fixture'), tx);
        throw new Error('abort fixture');
      }),
    ).rejects.toThrow('abort fixture');
    expect(await db.attachmentContent.findUnique({ where: { storageKey: key } })).toBeNull();
  });

  it('durably retries attachment erasure after a storage failure and worker restart', async () => {
    const user = await account();
    const storage = app.get(AttachmentStorage);
    const key = await storage.put(Buffer.from('Private fixture attachment'));
    const feedback = await db.feedback.create({
      data: {
        userId: user.id,
        title: 'Erasure fixture',
        description: 'Private fixture context',
        category: 'BUG',
        attachments: {
          create: { name: 'private.png', mimeType: 'image/png', size: 26, storageKey: key },
        },
      },
    });
    const session = await app.get(AuthService).createSession(user.id);
    const remove = vi
      .spyOn(storage, 'remove')
      .mockRejectedValueOnce(new Error('Storage unavailable'));
    try {
      const response = await request(app.getHttpServer())
        .post('/api/account/delete')
        .set('Origin', 'http://localhost:4200')
        .set('Cookie', `lq_session=${session.token}`)
        .send({ password, confirmation: 'DELETE' });
      expect(response.status).toBe(201);
      expect(remove).toHaveBeenCalledWith(key);
      expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('DELETED');
      expect(await db.feedbackAttachment.count({ where: { feedbackId: feedback.id } })).toBe(0);
      expect(await db.attachmentDeletion.count({ where: { storageKey: key } })).toBe(1);
      expect(
        (
          await db.attachmentDeletion.findUniqueOrThrow({ where: { storageKey: key } })
        ).retryAt.getTime(),
      ).toBeGreaterThan(Date.now());
      expect(await storage.read(key)).toEqual(Buffer.from('Private fixture attachment'));
      await db.attachmentDeletion.update({
        where: { storageKey: key },
        data: { retryAt: new Date(0) },
      });
      const restarted = new AttachmentCleanup(db, new AttachmentStorage(db));
      await restarted.drain();
      expect(await db.attachmentDeletion.count({ where: { storageKey: key } })).toBe(0);
      await expect(storage.read(key)).rejects.toThrow('Attachment not found');
      await restarted.drain();
    } finally {
      remove.mockRestore();
      await storage.remove(key);
    }
  });
  it.each(['Pacific/Honolulu', 'Africa/Cairo'])(
    'preserves UTC limits, calendar streaks and monthly XP in database timezone %s',
    async (timezone) => {
      const user = await account();
      const today = dateOnly(localDate(new Date(), 'UTC'));
      const yesterday = new Date(today.getTime() - 86_400_000);
      const habit = await db.habit.create({
        data: {
          userId: user.id,
          areaId: 'hardening-area',
          name: 'Timezone fixture',
          startDate: yesterday,
        },
      });
      await db.habitLog.createMany({
        data: [yesterday, today].map((date) => ({
          userId: user.id,
          habitId: habit.id,
          date,
          value: 1,
          targetSnapshot: 1,
        })),
      });
      await db.xPTransaction.createMany({
        data: [
          ['2026-07-31', 11],
          ['2026-08-01', 77],
          ['2026-08-31', 22],
          ['2026-09-01', 23],
        ].map(([date, amount]) => ({
          userId: user.id,
          type: 'BONUS',
          source: 'timezone-fixture',
          amount: Number(amount),
          createdAt: dateOnly(String(date)),
          idempotencyKey: randomUUID(),
        })),
      });
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('TimeZone', ${timezone}, true)`;
        const rateLimit = new DatabaseRateLimit(tx);
        const result = await rateLimit.increment(randomUUID(), 60_000, 3, 60_000);
        expect(result.timeToExpire).toBeGreaterThanOrEqual(59);
        expect(result.timeToExpire).toBeLessThanOrEqual(60);
        expect((await habitStreaks(tx, [habit.id], today)).get(habit.id)).toBe(2);
        // Route raw SQL through this session without changing Prisma's shared delegates.
        const connection = new Proxy(db, {
          get(target, property) {
            return property === '$queryRaw' ? tx.$queryRaw.bind(tx) : Reflect.get(target, property);
          },
        });
        const dashboard = await new DashboardService(connection, app.get(XpService)).summary(
          { id: user.id, role: 'USER', timezone: 'UTC', sessionId: '' },
          'month',
          '2026-08',
        );
        expect(dashboard.periodXp).toBe(99);
      });
    },
  );
  it('only audits successful challenge moderation and returns accurate HTTP errors', async () => {
    const admin = await account();
    await db.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    const session = await app.get(AuthService).createSession(admin.id);
    const moderate = (id: string) =>
      request(app.getHttpServer())
        .post(`/api/admin/challenges/${id}/cancel`)
        .set('Origin', 'http://localhost:4200')
        .set('Cookie', `lq_session=${session.token}`)
        .send({ reason: 'Moderation regression fixture' });
    const missing = randomUUID();
    expect((await moderate(missing)).status).toBe(404);
    expect(await db.auditLog.count({ where: { entityId: missing } })).toBe(0);
    const challenge = await db.challenge.create({
      data: {
        ownerId: admin.id,
        title: 'Moderation fixture',
        description: '',
        mode: 'CONSISTENCY',
        status: 'INVITED',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86_400_000),
      },
    });
    expect((await moderate(challenge.id)).status).toBe(201);
    expect((await moderate(challenge.id)).status).toBe(400);
    expect(
      await db.auditLog.count({ where: { entityId: challenge.id, action: 'CHALLENGE_MODERATED' } }),
    ).toBe(1);
  });
  it('returns an ordinary authentication failure for erased credentials', async () => {
    const user = await account();
    await db.user.update({
      where: { id: user.id },
      data: { status: 'DELETED', passwordHash: 'deleted' },
    });
    await expect(app.get(AuthService).login(user.email, password)).rejects.toMatchObject({
      status: 401,
    });
  });
  it.each([
    ['malformed JSON', '{"password":"private-value",', 400],
    ['oversized JSON', JSON.stringify({ password: 'x'.repeat(70_000) }), 413],
  ])('returns a safe, traceable client error for %s', async (_name, body, status) => {
    const result = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:4200')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(result.status).toBe(status);
    expect(result.body.requestId).toBe(result.headers['x-request-id']);
    expect(result.body.requestId).toEqual(expect.any(String));
    expect(result.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(result.body)).not.toContain('private-value');
    expect(result.body.stack).toBeUndefined();
  });

  it.each(['password', 'status'] as const)(
    'does not issue a session when %s changes during password verification',
    async (change) => {
      const user = await account();
      const find = db.user.findUnique.bind(db.user);
      const replacement = await argon2.hash('replacement-hardening-password');
      // Return the pre-change snapshot to reproduce a reset/suspension racing login.
      const spy = vi.spyOn(db.user, 'findUnique').mockImplementationOnce(async (args) => {
        const snapshot = await find(args);
        await db.user.update({
          where: { id: user.id },
          data: change === 'password' ? { passwordHash: replacement } : { status: 'SUSPENDED' },
        });
        return snapshot;
      });
      try {
        await expect(app.get(AuthService).login(user.email, password)).rejects.toMatchObject({
          status: 401,
        });
        expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
      } finally {
        spy.mockRestore();
      }
    },
  );

  it('does not renew an expired session even if the caller passed an earlier auth check', async () => {
    const user = await account();
    const session = await db.session.create({
      data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date(0) },
    });
    await expect(app.get(AuthService).refresh(user.id, session.id)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('prevents a blocked participant from taking ownership of and removing the block', async () => {
    const sender = await account();
    const receiver = await account();
    const friendship = await db.friendship.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        pairKey: [sender.id, receiver.id].sort().join(':'),
        status: 'BLOCKED',
        blockedById: sender.id,
      },
    });
    const service = app.get(FriendsService);
    await expect(service.action(receiver.id, friendship.id, 'block')).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.action(receiver.id, friendship.id, 'remove')).rejects.toMatchObject({
      status: 403,
    });
    expect(
      (await db.friendship.findUniqueOrThrow({ where: { id: friendship.id } })).blockedById,
    ).toBe(sender.id);
    await service.action(sender.id, friendship.id, 'remove');
    expect(await db.friendship.findUnique({ where: { id: friendship.id } })).toBeNull();
  });

  it.each([false, true])(
    'scores frozen habit points independently of later XP settings (minimum: %s)',
    async (minimum) => {
      const owner = await account();
      const friend = await account();
      const habit = await db.habit.create({
        data: {
          userId: owner.id,
          areaId: 'hardening-area',
          name: 'Frozen commitment',
          difficulty: 'HARD',
          xpReward: 40,
          startDate: new Date(Date.now() - 86_400_000),
        },
      });
      await db.friendship.create({
        data: {
          senderId: owner.id,
          receiverId: friend.id,
          pairKey: [owner.id, friend.id].sort().join(':'),
          status: 'ACCEPTED',
        },
      });
      const service = app.get(ChallengesService);
      const challenge = await service.create(
        owner.id,
        challengeSchema.parse({
          title: 'Frozen points',
          mode: 'SCORE',
          friendIds: [friend.id],
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86_400_000).toISOString(),
          target: 100,
        }),
      );
      expect(challenge.algorithmVersion).toBe(2);
      await service.accept(friend.id, challenge.id, challengeAcceptSchema.parse({}));
      await db.habit.update({
        where: { id: habit.id },
        data: { difficulty: 'EASY', xpReward: 20 },
      });
      const date = dateOnly(localDate(new Date(), 'UTC'));
      await db.habitLog.create({
        data: {
          userId: owner.id,
          habitId: habit.id,
          value: 1,
          targetSnapshot: 1,
          date,
          minimum,
        },
      });
      await db.xPTransaction.create({
        data: {
          userId: owner.id,
          type: 'HABIT',
          source: habit.id,
          amount: minimum ? 10 : 20,
          idempotencyKey: `habit:${habit.id}:${date.toISOString().slice(0, 10)}`,
        },
      });
      await service.advance(challenge.id);
      const score = await db.challengeScore.findFirstOrThrow({
        where: { challengeId: challenge.id, participant: { userId: owner.id } },
      });
      expect(score.score).toBe(minimum ? 20 : 40);
      expect(score.algorithmVersion).toBe(2);
      await db.xPTransaction.create({
        data: {
          userId: owner.id,
          type: 'BONUS',
          source: 'fixture',
          amount: 1000,
          idempotencyKey: randomUUID(),
        },
      });
      await service.advance(challenge.id);
      expect((await db.challengeScore.findUniqueOrThrow({ where: { id: score.id } })).score).toBe(
        score.score,
      );
    },
  );

  it('does not put future-start tasks in the dashboard today list', async () => {
    const user = await account();
    const future = await db.task.create({
      data: {
        userId: user.id,
        title: 'Start next week',
        startDate: new Date(Date.now() + 7 * 86_400_000),
        labels: [],
      },
    });
    const available = await db.task.create({
      data: { userId: user.id, title: 'Available now', labels: [] },
    });
    const dashboard = await app
      .get(DashboardService)
      .summary({ id: user.id, role: 'USER', timezone: 'UTC', sessionId: '' });
    expect(dashboard.tasks.map((task) => task.id)).toContain(available.id);
    expect(dashboard.tasks.map((task) => task.id)).not.toContain(future.id);
  });

  it('returns dashboard summaries without private habit notes or raw logs', async () => {
    const user = await account();
    const habit = await db.habit.create({
      data: {
        userId: user.id,
        areaId: 'hardening-area',
        name: 'Summary fixture',
        notes: 'Private habit context',
        startDate: new Date(Date.now() - 86_400_000),
      },
    });
    await db.habitLog.create({
      data: {
        userId: user.id,
        habitId: habit.id,
        date: dateOnly(localDate(new Date(), 'UTC')),
        value: 1,
        targetSnapshot: 1,
        note: 'Private reflection',
      },
    });
    const dashboard = await app
      .get(DashboardService)
      .summary({ id: user.id, role: 'USER', timezone: 'UTC', sessionId: '' });
    expect(dashboard.habits[0]?.completedToday).toBe(true);
    expect(dashboard.habits[0]).not.toHaveProperty('logs');
    expect(dashboard.habits[0]).not.toHaveProperty('notes');
    expect(JSON.stringify(dashboard)).not.toContain('Private reflection');
  });

  it('cancels unfinished shared challenges when an account is erased', async () => {
    const owner = await account();
    const friend = await account();
    await db.friendship.create({
      data: {
        senderId: owner.id,
        receiverId: friend.id,
        pairKey: [owner.id, friend.id].sort().join(':'),
        status: 'ACCEPTED',
      },
    });
    const challenge = await app.get(ChallengesService).create(
      owner.id,
      challengeSchema.parse({
        title: 'Erasure fixture',
        mode: 'CONSISTENCY',
        friendIds: [friend.id],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );
    const session = await app.get(AuthService).createSession(owner.id);
    const result = await request(app.getHttpServer())
      .post('/api/account/delete')
      .set('Origin', 'http://localhost:4200')
      .set('Cookie', `lq_session=${session.token}`)
      .send({ password, confirmation: 'DELETE' });
    expect(result.status).toBe(201);
    expect((await db.challenge.findUniqueOrThrow({ where: { id: challenge.id } })).status).toBe(
      'CANCELLED',
    );
    await app.get(ChallengesService).advance(challenge.id);
    expect(await db.xPTransaction.count({ where: { userId: owner.id } })).toBe(0);
    expect(await db.analyticsEvent.count({ where: { userId: owner.id } })).toBe(0);
  });
});
