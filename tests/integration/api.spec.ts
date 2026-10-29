import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { cleanupExpiredRecords } from '../../apps/api/src/common/maintenance.controller';
import { ChallengeLifecycleService } from '../../apps/api/src/social/challenge-lifecycle.service';
import { seed } from '../../prisma/seed';
let app: INestApplication;
let db: Database;
let cookie = '';
let secondCookie = '';
let userId = '';
let goalId = '';
let projectId = '';
let taskId = '';
let habitId = '';
let rewardId = '';
let questId = '';
let friendId = '';
let challengeId = '';
const origin = 'http://localhost:4200';
const body = {
  email: 'integration@example.test',
  password: 'test-password-very-long',
  displayName: 'Test Explorer',
};
const http = () => request(app.getHttpServer());
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
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  const quoted = tables.map((table) => `"${table.tablename.replaceAll('"', '""')}"`).join(',');
  if (quoted) await db.$executeRawUnsafe(`TRUNCATE ${quoted} CASCADE`);
  await seed(db);
});
afterAll(async () => {
  await app?.close();
});
describe('MIRHAL HTTP workflows on migrated isolated PostgreSQL', () => {
  it('exposes health, protects private routes, and rejects cross-origin writes', async () => {
    expect((await http().get('/api/health')).status).toBe(200);
    expect((await http().get('/api/goals')).status).toBe(401);
    expect((await http().post('/api/auth/register').send(body)).status).toBe(403);
  });
  it('registers with a private cookie and verifies email once', async () => {
    const response = await http().post('/api/auth/register').set('Origin', origin).send(body);
    expect(response.status).toBe(201);
    expect(response.body.user.passwordHash).toBeUndefined();
    cookie = response.headers['set-cookie'][0].split(';')[0];
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    userId = response.body.user.id;
    const mail = app.get(MailAdapter).outbox.find((item) => item.to === body.email)!;
    expect(mail.language).toBe('ar');
    const token = new URL(mail.url).searchParams.get('token');
    expect(
      (await http().post('/api/auth/verify-email').set('Origin', origin).send({ token })).status,
    ).toBe(201);
    expect(
      (await http().post('/api/auth/verify-email').set('Origin', origin).send({ token })).status,
    ).toBe(400);
  });
  it('uses persisted English for recovery mail without exposing account existence on delivery failure', async () => {
    await db.profile.update({ where: { userId }, data: { language: 'en' } });
    const delivered = await http()
      .post('/api/auth/forgot-password')
      .set('Origin', origin)
      .send({ email: body.email });
    expect(delivered.status).toBe(201);
    expect(app.get(MailAdapter).outbox.at(-1)?.language).toBe('en');
    const adapter = app.get(MailAdapter);
    const failing = vi.spyOn(adapter, 'send').mockRejectedValue(new ServiceUnavailableException());
    const known = await http()
      .post('/api/auth/forgot-password')
      .set('Origin', origin)
      .send({ email: body.email });
    const unknown = await http()
      .post('/api/auth/forgot-password')
      .set('Origin', origin)
      .send({ email: 'missing@example.test' });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    failing.mockRestore();
  });
  it('limits recovery email sends per account across concurrent callers', async () => {
    const recent = await db.authToken.count({
      where: {
        userId,
        purpose: 'RESET_PASSWORD',
        createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
      },
    });
    const remaining = Math.max(0, 5 - recent);
    const adapter = app.get(MailAdapter);
    const before = adapter.outbox.length;
    const results = await Promise.all(
      Array.from({ length: remaining + 3 }, () =>
        app.get(AuthService).issueEmailToken(userId, body.email, 'RESET_PASSWORD'),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(remaining);
    expect(adapter.outbox.length - before).toBe(remaining);
    expect(
      await db.authToken.count({
        where: {
          userId,
          purpose: 'RESET_PASSWORD',
          createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
        },
      }),
    ).toBe(5);
  });
  it('rejects invalid credentials and privilege escalation', async () => {
    expect(
      (
        await http()
          .post('/api/auth/login')
          .set('Origin', origin)
          .send({ email: body.email, password: 'wrong-password-long' })
      ).status,
    ).toBe(401);
    expect((await http().get('/api/admin/overview').set('Cookie', cookie)).status).toBe(403);
    expect(
      (
        await http()
          .patch('/api/profile')
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(400);
  });
  it('completes onboarding idempotently', async () => {
    const input = { areaIds: ['area-growth'], goal: 'Learn something new', habit: 'Read a little' };
    const response = await http()
      .post('/api/onboarding')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send(input);
    expect(response.status).toBe(201);
    await http().post('/api/onboarding').set('Origin', origin).set('Cookie', cookie).send(input);
    expect(await db.goal.count({ where: { userId } })).toBe(1);
  });
  it('creates linked goals, projects, tasks, and completes a task once', async () => {
    let result = await http()
      .post('/api/goals')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'Ship a meaningful project', areaId: 'area-growth', strategy: 'PROJECT' });
    expect(result.status).toBe(201);
    goalId = result.body.id;
    result = await http()
      .post('/api/projects')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'First project', goalId });
    expect(result.status).toBe(201);
    projectId = result.body.id;
    result = await http()
      .post('/api/tasks')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'Create a first draft', projectId, goalId });
    expect(result.status).toBe(201);
    taskId = result.body.id;
    const responses = await Promise.all(
      [1, 2].map(() =>
        http()
          .patch(`/api/tasks/${taskId}`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ status: 'COMPLETED' }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(responses.reduce((sum, r) => sum + r.body.awarded, 0)).toBe(10);
    expect(
      (await http().get('/api/goals').set('Cookie', cookie)).body.items.find(
        (g: { id: string }) => g.id === goalId,
      ).progress,
    ).toBe(100);
  });
  it('creates a habit and atomically prevents duplicate logs and XP', async () => {
    const created = await http()
      .post('/api/habits')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ name: 'Walk outside', areaId: 'area-body', target: 10, unit: 'minutes' });
    expect(created.status).toBe(201);
    habitId = created.body.id;
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        http()
          .post(`/api/habits/${habitId}/complete`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({}),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(results.reduce((sum, r) => sum + r.body.awarded, 0)).toBe(20);
    expect(await db.habitLog.count({ where: { habitId } })).toBe(1);
    expect(await db.xPTransaction.count({ where: { source: habitId } })).toBe(1);
    await db.habit.update({
      where: { id: habitId },
      data: { startDate: new Date(Date.now() - 10 * 86400000) },
    });
    const listed = await http().get('/api/habits').set('Cookie', cookie);
    expect(
      listed.body.items.find((item: { id: string }) => item.id === habitId)?.recoveryPattern,
    ).toBe(true);
  });
  it('records learning in Habit Lab and distinct daily check-ins', async () => {
    expect(
      (
        await http()
          .post(`/api/habits/${habitId}/experiments`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({
            reason: 'Too much at once',
            hypothesis: 'A smaller step will help',
            adjustment: 'Five minutes instead',
            target: 5,
          })
      ).status,
    ).toBe(201);
    const a = await http()
      .post('/api/check-ins')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ mood: 4, energy: 3, majorWin: 'Showed up' });
    const b = await http()
      .post('/api/check-ins')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ mood: 3, energy: 3 });
    expect(a.body.awarded).toBe(15);
    expect(b.body.awarded).toBe(0);
    expect(await db.dailyCheckIn.count({ where: { userId } })).toBe(1);
  });
  it('finishes a quest and earns its server-configured reward only once', async () => {
    const created = await http()
      .post('/api/quests')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        title: 'Ship the next step',
        areaId: 'area-growth',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        items: ['Make a draft'],
      });
    expect(created.status).toBe(201);
    questId = created.body.id;
    const url = `/api/quests/${questId}/items/${created.body.items[0].id}/complete`;
    const a = await http().post(url).set('Origin', origin).set('Cookie', cookie).send({});
    const b = await http().post(url).set('Origin', origin).set('Cookie', cookie).send({});
    expect(a.body.awarded).toBe(100);
    expect(b.body.awarded).toBe(0);
  });
  it('redeems, deduplicates, and refunds rewards without changing lifetime XP', async () => {
    const created = await http()
      .post('/api/rewards')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'A lovely coffee', cost: 50 });
    rewardId = created.body.id;
    const before = (await http().get('/api/xp').set('Cookie', cookie)).body;
    const key = crypto.randomUUID();
    const responses = await Promise.all(
      [1, 2].map(() =>
        http()
          .post(`/api/rewards/${rewardId}/redeem`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ idempotencyKey: key }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0]!.body.redemption.id).toBe(responses[1]!.body.redemption.id);
    const after = (await http().get('/api/xp').set('Cookie', cookie)).body;
    expect(after.balance).toBe(before.balance - 50);
    expect(after.earned).toBe(before.earned);
    const url = `/api/redemptions/${responses[0]!.body.redemption.id}/refund`;
    await http().post(url).set('Origin', origin).set('Cookie', cookie).send({});
    await http().post(url).set('Origin', origin).set('Cookie', cookie).send({});
    expect((await http().get('/api/xp').set('Cookie', cookie)).body.balance).toBe(before.balance);
  });
  it('rejects insufficient funds and protects append-only history', async () => {
    const reward = await db.reward.create({
      data: { title: 'Too expensive', cost: 100000, userId },
    });
    expect(
      (
        await http()
          .post(`/api/rewards/${reward.id}/redeem`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ idempotencyKey: crypto.randomUUID() })
      ).status,
    ).toBe(400);
    const xp = await db.xPTransaction.findFirstOrThrow({ where: { userId } });
    await expect(
      db.xPTransaction.update({ where: { id: xp.id }, data: { amount: 999999 } }),
    ).rejects.toThrow();
  });
  it('prevents cross-user reads and linked-object writes', async () => {
    const response = await http()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ ...body, email: 'friend@example.test', displayName: 'Friend' });
    secondCookie = response.headers['set-cookie'][0].split(';')[0];
    friendId = response.body.user.id;
    expect(
      (
        await http()
          .patch(`/api/goals/${goalId}`)
          .set('Origin', origin)
          .set('Cookie', secondCookie)
          .send({ title: 'Stolen goal' })
      ).status,
    ).toBe(404);
    expect(
      (
        await http()
          .post('/api/tasks')
          .set('Origin', origin)
          .set('Cookie', secondCookie)
          .send({ title: 'Linked attack', projectId })
      ).status,
    ).toBe(404);
    expect((await http().get('/api/habits').set('Cookie', secondCookie)).body.items).toHaveLength(
      0,
    );
  });
  it('keeps reward preferences and feedback owned, and clears feedback on refund', async () => {
    const created = await http()
      .post('/api/rewards')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'Weekend book', cost: 50, category: 'books', cooldownDays: 2 });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(
      (
        await http()
          .patch(`/api/rewards/${id}`)
          .set('Origin', origin)
          .set('Cookie', secondCookie)
          .send({ title: 'Stolen reward' })
      ).status,
    ).toBe(404);
    expect(
      (
        await http()
          .put(`/api/rewards/${id}/favorite`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (
        await http()
          .put(`/api/rewards/${id}/save`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ targetXp: 200 })
      ).status,
    ).toBe(200);
    expect(
      (await http().get('/api/reward-savings').set('Cookie', secondCookie)).body.items,
    ).toHaveLength(0);
    const savings = (await http().get('/api/reward-savings').set('Cookie', cookie)).body.items;
    expect(savings.find((item: { rewardId: string }) => item.rewardId === id)?.targetXp).toBe(200);
    const recommendations = await http().get('/api/reward-recommendations').set('Cookie', cookie);
    expect(recommendations.status).toBe(200);
    expect(
      recommendations.body.some((item: { reward: { id: string } }) => item.reward.id === id),
    ).toBe(true);
    const redeemed = await http()
      .post(`/api/rewards/${id}/redeem`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ idempotencyKey: crypto.randomUUID() });
    expect(redeemed.status).toBe(201);
    expect(
      (
        await http()
          .post(`/api/rewards/${id}/redeem`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ idempotencyKey: crypto.randomUUID() })
      ).status,
    ).toBe(400);
    const redemptionId = redeemed.body.redemption.id;
    expect(
      (
        await http()
          .put(`/api/redemptions/${redemptionId}/feedback`)
          .set('Origin', origin)
          .set('Cookie', secondCookie)
          .send({ rating: 5 })
      ).status,
    ).toBe(404);
    expect(
      (
        await http()
          .put(`/api/redemptions/${redemptionId}/feedback`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ rating: 5 })
      ).body.rating,
    ).toBe(5);
    expect(
      (
        await http()
          .post(`/api/redemptions/${redemptionId}/refund`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({})
      ).status,
    ).toBe(201);
    expect(
      (await db.rewardRedemption.findUniqueOrThrow({ where: { id: redemptionId } })).rating,
    ).toBeNull();
    expect(
      (
        await http()
          .put(`/api/redemptions/${redemptionId}/feedback`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ rating: 5 })
      ).status,
    ).toBe(400);
  });
  it('accepts private friends and creates a challenge without exposing journals', async () => {
    const friendship = await http()
      .post('/api/friends')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ email: 'friend@example.test' });
    expect(friendship.status).toBe(201);
    expect(
      (
        await http()
          .post(`/api/friends/${friendship.body.id}/actions`)
          .set('Origin', origin)
          .set('Cookie', secondCookie)
          .send({ action: 'accept' })
      ).status,
    ).toBe(201);
    const challenge = await http()
      .post('/api/challenges')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        title: 'Grow together',
        mode: 'CONSISTENCY',
        friendIds: [friendId],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(challenge.status).toBe(201);
    challengeId = challenge.body.id;
    expect(
      (
        await http()
          .post(`/api/challenges/${challenge.body.id}/accept`)
          .set('Origin', origin)
          .set('Cookie', secondCookie)
          .send({ shareScore: false, shareProgress: false })
      ).status,
    ).toBe(201);
    const list = await http().get('/api/challenges').set('Cookie', cookie);
    expect(list.body.items[0].status).toBe('ACTIVE');
    const participant = list.body.items[0].participants.find(
      (p: { userId: string }) => p.userId === friendId,
    );
    expect(participant.score).toBeNull();
    expect(participant.baseline).toBeUndefined();
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    expect(JSON.stringify(list.body)).not.toContain('majorWin');
  });
  it('submits feedback, excludes internal notes, and supplies real dashboard data', async () => {
    const response = await http()
      .post('/api/feedback')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        title: 'A useful suggestion',
        description: 'Please add a gentler reminder.',
        category: 'SUGGESTION',
        anonymous: true,
      });
    expect(response.status).toBe(201);
    await db.feedbackReply.create({
      data: {
        feedbackId: response.body.id,
        body: 'Internal private triage',
        internal: true,
        authorRole: 'SUPPORT',
      },
    });
    expect(
      JSON.stringify((await http().get('/api/feedback').set('Cookie', cookie)).body),
    ).not.toContain('Internal private triage');
    expect((await http().get('/api/dashboard').set('Cookie', cookie)).body.completedHabits).toBe(1);
    expect((await http().get('/api/journey').set('Cookie', cookie)).status).toBe(200);
  });
  it('renews a session safely under concurrent browser tabs', async () => {
    const sessions = await db.session.findMany({ where: { userId } });
    const responses = await Promise.all(
      [1, 2].map(() =>
        http().post('/api/auth/refresh').set('Origin', origin).set('Cookie', cookie).send({}),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(responses[0]!.headers['set-cookie'][0].split(';')[0]).toBe(cookie);
    expect(await db.session.count({ where: { userId } })).toBe(sessions.length);
  });
  it('freezes eligibility, baselines, timezones and scoring rules at activation', async () => {
    const participant = await db.challengeParticipant.findUniqueOrThrow({
      where: { challengeId_userId: { challengeId, userId } },
    });
    const snapshot = await db.challengeHabitSnapshot.findFirstOrThrow({
      where: { participantId: participant.id, habitId },
    });
    await expect(
      db.challengeHabitSnapshot.update({
        where: { participantId_habitId: { participantId: participant.id, habitId } },
        data: { target: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.challengeHabitSnapshot.delete({
        where: { participantId_habitId: { participantId: participant.id, habitId } },
      }),
    ).rejects.toThrow();
    await expect(
      db.challengeParticipant.update({ where: { id: participant.id }, data: { baseline: 999 } }),
    ).rejects.toThrow();
    await expect(
      db.challengeParticipant.update({
        where: { id: participant.id },
        data: { timezoneSnapshot: 'UTC' },
      }),
    ).rejects.toThrow();
    await expect(
      db.challenge.update({ where: { id: challengeId }, data: { mode: 'SCORE' } }),
    ).rejects.toThrow();
    await expect(
      db.challengeRule.update({ where: { challengeId }, data: { target: 999 } }),
    ).rejects.toThrow();
    await expect(
      db.challengeMetric.update({ where: { challengeId }, data: { unit: 'changed' } }),
    ).rejects.toThrow();
    const created = await http()
      .post('/api/habits')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ name: 'Added after activation', areaId: 'area-growth' });
    await expect(
      db.challengeHabitSnapshot.create({ data: { ...snapshot, habitId: created.body.id } }),
    ).rejects.toThrow();
    await http()
      .post(`/api/habits/${created.body.id}/complete`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({});
    await app.get(ChallengeLifecycleService).advance(challengeId);
    expect(
      (
        await db.challengeScore.findUniqueOrThrow({
          where: { challengeId_participantId: { challengeId, participantId: participant.id } },
        })
      ).score,
    ).toBe(0);
    expect(
      (
        await http()
          .patch(`/api/habits/${habitId}`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ unit: 'kilometres' })
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .patch(`/api/habits/${habitId}`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ areaId: 'area-mind' })
      ).status,
    ).toBe(200);
    expect(
      await db.challengeHabitSnapshot.count({ where: { participantId: participant.id, habitId } }),
    ).toBe(1);
  });
  it('finalizes a challenge once and permanently freezes its results', async () => {
    const past = new Date(Date.now() - 2 * 86400000);
    const historical = await db.habit.create({
      data: { userId, name: 'Historical fixture', areaId: 'area-growth', startDate: past },
    });
    await db.habitLog.create({
      data: {
        userId,
        habitId: historical.id,
        value: 1,
        targetSnapshot: 1,
        date: new Date(past.getTime() + 86400000),
        createdAt: new Date(past.getTime() + 86400000),
      },
    });
    const ended = await db.challenge.create({
      data: {
        ownerId: userId,
        title: 'Finished together',
        mode: 'CONSISTENCY',
        startDate: past,
        endDate: new Date(Date.now() - 1000),
        status: 'SCHEDULED',
        rules: { create: { target: 2 } },
        participants: {
          create: [
            { userId, status: 'ACCEPTED' },
            { userId: friendId, status: 'ACCEPTED' },
          ],
        },
      },
    });
    await Promise.all([
      app.get(ChallengeLifecycleService).advance(ended.id),
      app.get(ChallengeLifecycleService).advance(ended.id),
    ]);
    expect((await db.challenge.findUniqueOrThrow({ where: { id: ended.id } })).status).toBe(
      'COMPLETED',
    );
    const score = await db.challengeScore.findFirstOrThrow({
      where: { challengeId: ended.id, participant: { userId } },
    });
    expect(score.final).toBe(true);
    expect(await db.xPTransaction.count({ where: { source: ended.id, userId } })).toBe(1);
    await expect(
      db.challengeScore.update({ where: { id: score.id }, data: { score: 99 } }),
    ).rejects.toThrow();
    await expect(
      db.challenge.update({ where: { id: ended.id }, data: { status: 'ACTIVE' } }),
    ).rejects.toThrow();
    const result = await http()
      .post(`/api/challenges/${ended.id}/actions`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ action: 'cancel' });
    expect(result.status).toBe(400);
  });
  it('does not leak hidden cooperative contributions', async () => {
    const result = await http()
      .post('/api/challenges')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        title: 'Shared private steps',
        mode: 'COOPERATIVE',
        friendIds: [friendId],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });
    await http()
      .post(`/api/challenges/${result.body.id}/accept`)
      .set('Origin', origin)
      .set('Cookie', secondCookie)
      .send({ shareProgress: false, shareScore: false });
    const list = (await http().get('/api/challenges').set('Cookie', cookie)).body.items;
    expect(
      list.find((item: { id: string }) => item.id === result.body.id).cooperativeProgress,
    ).toBeNull();
  });
  it('serializes spending to prevent overdrafts with distinct replay keys', async () => {
    const balance = (await http().get('/api/xp').set('Cookie', cookie)).body.balance;
    const reward = await db.reward.create({
      data: { title: 'Only affordable once', cost: balance, userId },
    });
    const results = await Promise.all(
      [1, 2].map(() =>
        http()
          .post(`/api/rewards/${reward.id}/redeem`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ idempotencyKey: crypto.randomUUID() }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
    expect((await http().get('/api/xp').set('Cookie', cookie)).body.balance).toBe(0);
  });
  it('prunes expired maintenance records while preserving live rate limits', async () => {
    const expired = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const expiredKey = crypto.randomUUID();
    const liveKey = crypto.randomUUID();
    await db.rateLimitBucket.createMany({
      data: [
        { key: expiredKey, hits: 1, expiresAt: expired },
        { key: liveKey, hits: 1, expiresAt: future },
      ],
    });
    const token = await db.authToken.create({
      data: {
        userId,
        purpose: 'VERIFY_EMAIL',
        tokenHash: crypto.randomUUID(),
        expiresAt: expired,
      },
    });
    const session = await db.session.create({
      data: { userId, tokenHash: crypto.randomUUID(), expiresAt: expired },
    });
    await cleanupExpiredRecords(db);
    expect(await db.rateLimitBucket.findUnique({ where: { key: expiredKey } })).toBeNull();
    expect(await db.rateLimitBucket.findUnique({ where: { key: liveKey } })).not.toBeNull();
    expect(await db.authToken.findUnique({ where: { id: token.id } })).toBeNull();
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();
  });
  it('logs out and invalidates the session', async () => {
    expect(
      (await http().post('/api/auth/logout').set('Origin', origin).set('Cookie', cookie).send({}))
        .status,
    ).toBe(200);
    expect((await http().get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });
});
