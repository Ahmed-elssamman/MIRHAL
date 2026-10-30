import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { habitStreaks } from '../../apps/api/src/core/habit-streaks';
import { currentStreak, addDays, localDate, dateOnly } from '@lifequest/domain';
import { PlanningService } from '../../apps/api/src/core/planning.service';
import { AttachmentStorage } from '../../apps/api/src/core/attachment-storage';
import { AdminService } from '../../apps/api/src/admin/admin.service';
import { AccountController } from '../../apps/api/src/core/account.controller';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { ChallengeLifecycleService } from '../../apps/api/src/social/challenge-lifecycle.service';
import { seed } from '../../prisma/seed';
import { Role } from '@prisma/client';
let app: INestApplication;
let db: Database;
let member: { id: string; cookie: string; email: string };
let support: typeof member;
let admin: typeof member;
const password = 'isolated-security-test-password';
const origin = 'http://localhost:4200';
const http = () => request(app.getHttpServer());
const post = (path: string, cookie = member.cookie, data: unknown = {}) =>
  http()
    .post('/api/' + path)
    .set('Origin', origin)
    .set('Cookie', cookie)
    .send(data);
const patch = (path: string, data: unknown, cookie = member.cookie) =>
  http()
    .patch('/api/' + path)
    .set('Origin', origin)
    .set('Cookie', cookie)
    .send(data);
const get = (path: string, cookie = member.cookie) =>
  http()
    .get('/api/' + path)
    .set('Cookie', cookie);
async function fixture(role: Role = 'USER') {
  const email = randomUUID() + '@security.test';
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password),
      role,
      profile: { create: { displayName: 'Privacy fixture', timezone: 'UTC' } },
    },
  });
  const session = await app.get(AuthService).createSession(user.id);
  return { id: user.id, email, cookie: 'lq_session=' + session.token };
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
  await seed(db);
  member = await fixture();
  support = await fixture('SUPPORT');
  admin = await fixture('SUPER_ADMIN');
});
afterAll(async () => {
  await app?.close();
});
describe('Authentication recovery, privacy and operational control', () => {
  it('documents validated bodies, pagination and role requirements', async () => {
    const docs = await http().get('/api/docs-json');
    expect(docs.status).toBe(200);
    expect(
      docs.body.paths['/api/auth/register'].post.requestBody.content['application/json'].schema
        .properties.password.minLength,
    ).toBe(12);
    expect(docs.body.paths['/api/admin/users'].get.description).toContain('SUPPORT');
    expect(
      docs.body.paths['/api/goals'].get.parameters.some((p: { name: string }) => p.name === 'page'),
    ).toBe(true);
  });
  it('serves bounded private collections and safe public content', async () => {
    for (const route of [
      'goals',
      'projects',
      'tasks',
      'habits',
      'check-ins',
      'quests',
      'xp',
      'achievements',
      'rewards',
      'redemptions',
      'friends',
      'challenges',
      'notifications',
      'feedback',
      'account/sessions',
      'help',
      'announcements',
      'public-settings',
    ])
      expect((await get(route)).status, route).toBe(200);
    expect((await get('goals?limit=100000')).status).toBe(400);
  });
  it('enforces support privileges and forbids unauthorized staff mutations', async () => {
    expect((await get('admin/users', support.cookie)).status).toBe(200);
    expect((await get('admin/users/' + member.id, support.cookie)).body).not.toHaveProperty(
      'passwordHash',
    );
    expect((await get('admin/settings', support.cookie)).status).toBe(403);
    expect(
      (await patch('admin/users/' + member.id, { role: 'ADMIN' }, support.cookie)).status,
    ).toBe(403);
    expect(
      (await patch('admin/users/' + admin.id, { status: 'SUSPENDED' }, admin.cookie)).status,
    ).toBe(400);
    expect((await get('admin/users/missing', admin.cookie)).status).toBe(404);
  });
  it('suspends accounts, invalidates sessions and audits reactivation', async () => {
    const target = await fixture();
    expect(
      (await patch('admin/users/' + target.id, { status: 'SUSPENDED' }, admin.cookie)).status,
    ).toBe(200);
    expect((await get('auth/me', target.cookie)).status).toBe(401);
    expect(
      (await patch('admin/users/' + target.id, { status: 'ACTIVE' }, admin.cookie)).status,
    ).toBe(200);
    expect(
      await db.auditLog.count({ where: { entityId: target.id, action: 'USER_STATUS_CHANGED' } }),
    ).toBe(2);
    expect(
      (await patch('admin/users/' + target.id, { role: 'ANALYST' }, admin.cookie)).body.role,
    ).toBe('ANALYST');
  });
  it('rejects stale permissions and personal writes after account access changes', async () => {
    const formerAdmin = await fixture('SUPER_ADMIN');
    const staleIdentity = {
      id: formerAdmin.id,
      role: 'SUPER_ADMIN' as const,
      sessionId: 'old',
      timezone: 'UTC',
    };
    await db.user.update({ where: { id: formerAdmin.id }, data: { role: 'USER' } });
    await expect(
      app.get(AdminService).updateUser(staleIdentity, member.id, { role: 'ADMIN' }),
    ).rejects.toThrow('permissions have changed');
    const deleted = await fixture();
    const goal = await db.goal.create({
      data: { userId: deleted.id, title: 'Retained milestone', areaId: 'area-growth' },
    });
    const milestone = await db.milestone.create({
      data: { goalId: goal.id, title: 'Protected change' },
    });
    await db.user.update({ where: { id: deleted.id }, data: { status: 'DELETED' } });
    await expect(
      app.get(PlanningService).toggleMilestone(deleted.id, milestone.id, true),
    ).rejects.toThrow('no longer active');
    expect((await db.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).completed).toBe(
      false,
    );
    await expect(
      app
        .get(AccountController)
        .profile(
          { ...staleIdentity, id: deleted.id, role: 'USER' },
          { bio: 'Write after erasure' },
        ),
    ).rejects.toThrow('no longer active');
    expect((await db.profile.findUniqueOrThrow({ where: { userId: deleted.id } })).bio).toBe('');
  });
  it('handles anonymous feedback, internal notes and public replies separately', async () => {
    const feedback = await post('feedback', member.cookie, {
      title: 'Private concern',
      description: 'This is a private test concern.',
      category: 'COMPLAINT',
      anonymous: true,
    });
    expect(feedback.status).toBe(201);
    expect(
      (
        await patch(
          'admin/feedback/' + feedback.body.id,
          { status: 'REVIEWING', reply: 'Private triage', internal: true },
          support.cookie,
        )
      ).status,
    ).toBe(200);
    expect(JSON.stringify((await get('feedback')).body)).not.toContain('Private triage');
    const queue = (await get('admin/feedback?category=COMPLAINT', support.cookie)).body.items;
    expect(queue.every((item: { category: string }) => item.category === 'COMPLAINT')).toBe(true);
    expect(queue.find((item: { id: string }) => item.id === feedback.body.id).user).toBeNull();
    await patch(
      'admin/feedback/' + feedback.body.id,
      { status: 'RESOLVED', reply: 'We have fixed this.', internal: false },
      support.cookie,
    );
    expect(JSON.stringify((await get('feedback')).body)).toContain('We have fixed this.');
    const notifications = (await get('notifications')).body.items;
    expect(notifications.length).toBeGreaterThan(0);
    await patch('notifications/' + notifications[0].id + '/read', {});
    await post('notifications/read-all');
    expect(
      (await get('notifications')).body.items.every(
        (item: { readAt: string | null }) => item.readAt,
      ),
    ).toBe(true);
  });
  it('offers aggregate planning and recovery insights only to authorized analysts', async () => {
    expect((await get('admin/insights', member.cookie)).status).toBe(403);
    expect((await get('admin/insights', support.cookie)).status).toBe(403);
    const insights = await get('admin/insights', admin.cookie);
    expect(insights.status).toBe(200);
    expect(insights.body.planning.map((group: { kind: string }) => group.kind)).toEqual([
      'goals',
      'projects',
      'tasks',
    ]);
    expect(insights.body.habitCompletionRate).toBeGreaterThanOrEqual(0);
    expect(insights.body.habitCompletionRate).toBeLessThanOrEqual(100);
    expect(JSON.stringify(insights.body)).not.toContain(member.email);
  });
  it('calculates long daily, custom and weekly streaks without truncating history', async () => {
    const owner = await fixture();
    const area = await db.lifeArea.findFirstOrThrow();
    const today = new Date('2026-09-26T00:00:00Z');
    const start = addDays(today, -1099);
    const daily = await db.habit.create({
      data: { userId: owner.id, areaId: area.id, name: 'Long term consistency', startDate: start },
    });
    const dailyLogs = Array.from({ length: 1100 }, (_, index) => ({
      userId: owner.id,
      habitId: daily.id,
      date: addDays(start, index),
      value: 1,
      targetSnapshot: 1,
    }));
    await db.habitLog.createMany({ data: dailyLogs });
    const custom = await db.habit.create({
      data: {
        userId: owner.id,
        areaId: area.id,
        name: 'Three days',
        frequency: 'CUSTOM',
        scheduleDays: [1, 3, 5],
        startDate: addDays(today, -50),
      },
    });
    const customLogs = Array.from({ length: 51 }, (_, index) => ({
      userId: owner.id,
      habitId: custom.id,
      date: addDays(today, index - 50),
      value: 1,
      targetSnapshot: 1,
    })).filter((log) => [1, 3, 5].includes(log.date.getUTCDay()));
    await db.habitLog.createMany({ data: customLogs });
    const weekly = await db.habit.create({
      data: {
        userId: owner.id,
        areaId: area.id,
        name: 'Three weekly steps',
        frequency: 'WEEKLY',
        weeklyTarget: 3,
        startDate: addDays(today, -50),
      },
    });
    const weeklyLogs = customLogs.map((log) => ({ ...log, habitId: weekly.id }));
    await db.habitLog.createMany({ data: weeklyLogs });
    const result = await habitStreaks(db, [daily.id, custom.id, weekly.id], today);
    expect(result.get(daily.id)).toBe(1100);
    expect(currentStreak(daily, dailyLogs, today)).toBe(1100);
    expect(result.get(custom.id)).toBe(currentStreak(custom, customLogs, today));
    expect(result.get(weekly.id)).toBe(currentStreak(weekly, weeklyLogs, today));
    expect((await habitStreaks(db, [custom.id], addDays(today, 4))).get(custom.id) ?? 0).toBe(0);
    await db.habitLog.deleteMany({ where: { habitId: daily.id, date: addDays(today, -3) } });
    expect((await habitStreaks(db, [daily.id], today)).get(daily.id)).toBe(3);
  });
  it('keeps screenshot uploads private, bounded, and removable with account data', async () => {
    const owner = await fixture();
    const feedback = await post('feedback', owner.cookie, {
      title: 'Screenshot report',
      description: 'A detailed issue with a screenshot.',
      category: 'BUG',
      anonymous: true,
    });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6V8AAAAASUVORK5CYII=',
      'base64',
    );
    const upload = (cookie: string, buffer = png, type = 'image/png') =>
      http()
        .post(`/api/feedback/${feedback.body.id}/attachments`)
        .set('Origin', origin)
        .set('Cookie', cookie)
        .attach('file', buffer, { filename: 'screenshot.png', contentType: type });
    const storageWrite = vi.spyOn(app.get(AttachmentStorage), 'put');
    expect((await upload(member.cookie)).status).toBe(404);
    expect(storageWrite).not.toHaveBeenCalled();
    expect(
      (await upload(owner.cookie, Buffer.from('<svg>unsafe</svg>'), 'image/svg+xml')).status,
    ).toBe(400);
    expect((await upload(owner.cookie, Buffer.alloc(2 * 1024 * 1024 + 1))).status).toBe(413);
    const attached = await upload(owner.cookie);
    expect(attached.status).toBe(201);
    expect(attached.body).not.toHaveProperty('storageKey');
    const path = `feedback/${feedback.body.id}/attachments/${attached.body.id}`;
    expect((await get(path, owner.cookie)).headers['content-disposition']).toContain('attachment');
    expect((await get(path, member.cookie)).status).toBe(404);
    expect((await get(path, support.cookie)).status).toBe(200);
    await upload(owner.cookie);
    await upload(owner.cookie);
    const storedCount = storageWrite.mock.calls.length;
    expect((await upload(owner.cookie)).status).toBe(400);
    expect(storageWrite).toHaveBeenCalledTimes(storedCount);
    storageWrite.mockRestore();
    const stored = await db.feedbackAttachment.findUniqueOrThrow({
      where: { id: attached.body.id },
    });
    expect((await app.get(AttachmentStorage).read(stored.storageKey)).length).toBe(png.length);
    expect(
      (await post('account/delete', owner.cookie, { password, confirmation: 'DELETE' })).status,
    ).toBe(201);
    expect(await db.feedbackAttachment.count({ where: { feedbackId: feedback.body.id } })).toBe(0);
    await expect(app.get(AttachmentStorage).read(stored.storageKey)).rejects.toThrow();
  });
  it('paginates private timelines without leaking other accounts or dropping older items', async () => {
    const owner = await fixture();
    await db.notification.createMany({
      data: Array.from({ length: 28 }, (_, i) => ({
        userId: owner.id,
        type: 'BONUS',
        title: `Notice ${i}`,
        body: 'A private update',
        createdAt: new Date(Date.now() + i),
      })),
    });
    const first = (await get('notifications?limit=25', owner.cookie)).body;
    const second = (await get('notifications?page=2&limit=25', owner.cookie)).body;
    expect(first.total).toBe(28);
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(3);
    expect(
      new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size,
    ).toBe(28);
    expect((await get('notifications?limit=101', owner.cookie)).status).toBe(400);
    for (const route of ['quests', 'friends', 'challenges', 'feedback']) {
      const page = (await get(route + '?page=2&limit=1', owner.cookie)).body;
      expect(page.items).toEqual([]);
      expect(page.page).toBe(2);
      expect(page.total).toBe(0);
    }
  });
  it('keeps monthly evidence inside the selected calendar chapter', async () => {
    const explorer = await fixture();
    await db.dailyCheckIn.createMany({
      data: [
        { userId: explorer.id, date: new Date('2025-09-15'), mood: 4, energy: 3 },
        { userId: explorer.id, date: new Date('2025-10-02'), mood: 3, energy: 3 },
      ],
    });
    await db.xPTransaction.createMany({
      data: [
        {
          userId: explorer.id,
          type: 'BONUS',
          source: 'monthly-fixture',
          amount: 11,
          idempotencyKey: randomUUID(),
          createdAt: new Date('2025-09-15T12:00:00Z'),
        },
        {
          userId: explorer.id,
          type: 'BONUS',
          source: 'monthly-fixture',
          amount: 22,
          idempotencyKey: randomUUID(),
          createdAt: new Date('2025-10-02T12:00:00Z'),
        },
      ],
    });
    const result = await get('journey?month=2025-09', explorer.cookie);
    expect(result.status).toBe(200);
    expect(result.body.summary.periodDays).toBe(30);
    expect(result.body.summary.checkInCount).toBe(1);
    expect(result.body.summary.periodXp).toBe(11);
    expect(result.body.summary.historical).toBe(true);
    expect(result.body.summary.activity).toHaveLength(30);
    expect((await get('journey?month=2025-13')).status).toBe(400);
    expect((await get('journey?month=2199-12')).status).toBe(400);
  });
  it('publishes optional quest templates with ordered steps, RBAC and audited replacements', async () => {
    const area = await db.lifeArea.findFirstOrThrow({ where: { active: true } });
    const input = {
      title: 'A week of small wins',
      titleAr: 'أسبوع من الخطوات الصغيرة',
      areaId: area.id,
      items: ['Read two pages', 'Reflect on the week'],
      active: false,
    };
    expect((await post('admin/quest-templates', member.cookie, input)).status).toBe(403);
    expect((await post('admin/quest-templates', support.cookie, input)).status).toBe(403);
    const created = await post('admin/quest-templates', admin.cookie, input);
    expect(created.status).toBe(201);
    expect(
      (await get('quest-templates')).body.some(
        (item: { id: string }) => item.id === created.body.id,
      ),
    ).toBe(false);
    const updated = await patch(
      'admin/quest-templates/' + created.body.id,
      {
        ...input,
        active: true,
        description: 'Begin with one small action.',
        descriptionAr: 'ابدأ بخطوة صغيرة واحدة.',
        items: ['Take one tiny action'],
        itemsAr: ['اتخذ خطوة صغيرة'],
      },
      admin.cookie,
    );
    expect(updated.status).toBe(200);
    expect(updated.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Take one tiny action',
    ]);
    expect(updated.body.descriptionAr).toBe('ابدأ بخطوة صغيرة واحدة.');
    expect(updated.body.items[0].titleAr).toBe('اتخذ خطوة صغيرة');
    expect(
      (await get('quest-templates')).body.some(
        (item: { id: string }) => item.id === created.body.id,
      ),
    ).toBe(true);
    const page = await get('admin/quest-templates?search=small%20wins&limit=1', admin.cookie);
    expect(page.body.items).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: created.body.id } })).toBe(2);
    expect(
      (await post('admin/quest-templates', admin.cookie, { ...input, items: [] })).status,
    ).toBe(400);
    expect(
      (
        await post('admin/quest-templates', admin.cookie, {
          ...input,
          itemsAr: ['خطوة واحدة'],
        })
      ).status,
    ).toBe(400);
    expect(
      (await post('admin/quest-templates', admin.cookie, { ...input, areaId: 'missing' })).status,
    ).toBe(404);
  });
  it('creates and edits operational content without resetting omitted settings', async () => {
    const reward = await post('admin/rewards', admin.cookie, {
      title: 'Operations reward',
      cost: 300,
      description: 'Keep this description',
      icon: 'coffee',
    });
    expect(reward.status).toBe(201);
    expect(
      (await patch('admin/rewards/' + reward.body.id, { cost: 400 }, admin.cookie)).body
        .description,
    ).toBe('Keep this description');
    const translatedReward = await patch(
      'admin/rewards/' + reward.body.id,
      {
        titleAr: 'مكافأة التشغيل',
        descriptionAr: 'احتفظ بهذا الوصف.',
        categoryAr: 'العمل',
      },
      admin.cookie,
    );
    expect(translatedReward.body.titleAr).toBe('مكافأة التشغيل');
    expect(translatedReward.body.categoryAr).toBe('العمل');
    const achievement = await post('admin/achievements', admin.cookie, {
      slug: 'staff-' + randomUUID(),
      title: 'Steady effort',
      titleAr: 'جهد ثابت',
      description: 'Show up consistently',
      icon: 'flame',
      condition: 'STREAK_DAYS',
      threshold: 7,
      xpReward: 75,
      hidden: true,
    });
    expect(achievement.status).toBe(201);
    expect(
      (
        await patch(
          'admin/achievements/' + achievement.body.id,
          { threshold: 8, descriptionAr: 'واظب على عاداتك.' },
          admin.cookie,
        )
      ).body.hidden,
    ).toBe(true);
    expect(
      (await db.achievement.findUniqueOrThrow({ where: { id: achievement.body.id } }))
        .descriptionAr,
    ).toBe('واظب على عاداتك.');
    const help = await post('admin/help', admin.cookie, {
      slug: 'article-' + randomUUID(),
      title: 'A thoughtful answer',
      titleAr: 'إجابة مفيدة',
      body: 'Begin with one small habit.',
      bodyAr: 'ابدأ بعادة صغيرة واحدة.',
      published: false,
    });
    expect(help.status).toBe(201);
    expect(
      (await patch('admin/help/' + help.body.id, { title: 'An updated answer' }, admin.cookie)).body
        .published,
    ).toBe(false);
    expect(JSON.stringify((await get('help')).body)).not.toContain('An updated answer');
    const announcement = await post('admin/announcements', admin.cookie, {
      title: 'New chapter',
      body: 'Time to reflect together',
      active: false,
    });
    expect(
      (
        await patch(
          'admin/announcements/' + announcement.body.id,
          {
            body: 'A new reflection prompt',
            titleAr: 'فصل جديد',
            bodyAr: 'وقت التأمل معاً',
          },
          admin.cookie,
        )
      ).body.active,
    ).toBe(false);
    expect(
      (await db.announcement.findUniqueOrThrow({ where: { id: announcement.body.id } })).bodyAr,
    ).toBe('وقت التأمل معاً');
    expect(
      (
        await patch(
          'admin/settings/registration_notice',
          { value: 'Start small and grow.' },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect(JSON.stringify((await get('public-settings')).body)).toContain('Start small and grow.');
    expect(
      (await patch('admin/settings/DATABASE_URL', { value: 'forbidden' }, admin.cookie)).status,
    ).toBe(400);
    for (const route of [
      'overview',
      'users?search=Privacy',
      'feedback',
      'challenges',
      'rewards',
      'achievements',
      'help',
      'announcements',
      'settings',
      'health',
      'audit-logs',
    ])
      expect((await get('admin/' + route, admin.cookie)).status, route).toBe(200);
    const health = await get('admin/health', admin.cookie);
    expect(health.body.email).toEqual({ provider: 'file', status: 'configured' });
    expect(JSON.stringify(health.body)).not.toContain('RESEND_API_KEY');
  });
  it('reports a level transition only once from committed ledger evidence', async () => {
    const owner = await fixture();
    await db.profile.update({ where: { userId: owner.id }, data: { language: 'ar' } });
    const next = await db.level.findUniqueOrThrow({ where: { number: 2 } });
    await db.xPTransaction.create({
      data: {
        userId: owner.id,
        type: 'BONUS',
        source: 'level-fixture',
        amount: next.minXp - 5,
        idempotencyKey: 'level-fixture:' + owner.id,
      },
    });
    const task = await post('tasks', owner.cookie, { title: 'Cross a meaningful milestone' });
    const completed = await patch('tasks/' + task.body.id, { status: 'COMPLETED' }, owner.cookie);
    expect(completed.body.levelUp.number).toBe(2);
    expect(completed.body.levelUp.titleAr).toBe(next.titleAr);
    const repeated = await patch('tasks/' + task.body.id, { status: 'COMPLETED' }, owner.cookie);
    expect(repeated.body.levelUp).toBeNull();
    expect(repeated.body.awarded).toBe(0);
    expect(await db.notification.count({ where: { userId: owner.id, type: 'LEVEL_UP' } })).toBe(1);
    expect(
      (await db.notification.findFirstOrThrow({ where: { userId: owner.id, type: 'LEVEL_UP' } }))
        .title,
    ).toBe('فصل جديد في رحلتك');
  });
  it('stores the Arabic shared reward name in an Arabic redemption notification', async () => {
    const explorer = await fixture();
    await db.profile.update({ where: { userId: explorer.id }, data: { language: 'ar' } });
    await db.xPTransaction.create({
      data: {
        userId: explorer.id,
        type: 'BONUS',
        source: 'reward-language-fixture',
        amount: 50,
        idempotencyKey: 'reward-language:' + explorer.id,
      },
    });
    const reward = await db.reward.create({
      data: {
        title: 'A shared quiet moment',
        titleAr: 'لحظة هادئة مشتركة',
        descriptionAr: 'استمتع بلحظة هادئة.',
        categoryAr: 'راحة',
        cost: 50,
      },
    });
    const response = await post(`rewards/${reward.id}/redeem`, explorer.cookie, {
      idempotencyKey: randomUUID(),
    });
    expect(response.status).toBe(201);
    const notification = await db.notification.findFirstOrThrow({
      where: { userId: explorer.id, type: 'REWARD' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification.body).toContain('لحظة هادئة مشتركة');
    expect(notification.body).not.toContain('A shared quiet moment');
  });
  it('paginates operational challenges with validated lifecycle filters', async () => {
    const title = 'Paged moderation ' + randomUUID();
    await db.challenge.createMany({
      data: Array.from({ length: 4 }, (_, index) => ({
        ownerId: member.id,
        title: title + index,
        mode: 'CONSISTENCY' as const,
        status: index === 3 ? ('CANCELLED' as const) : ('DRAFT' as const),
        startDate: new Date(),
        endDate: addDays(new Date(), 7),
      })),
    });
    const query = 'admin/challenges?limit=2&status=DRAFT&search=' + encodeURIComponent(title);
    const first = await get(query, admin.cookie);
    const second = await get(query + '&page=2', admin.cookie);
    expect(first.body.total).toBe(3);
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect(first.body.items[0]).not.toHaveProperty('owner');
    expect((await get('admin/challenges?status=BOGUS', admin.cookie)).status).toBe(400);
    expect((await get(query, member.cookie)).status).toBe(403);
  });
  it('selects all of today before pagination using the account timezone', async () => {
    const owner = await fixture();
    const timezone = 'Pacific/Kiritimati';
    await db.profile.update({ where: { userId: owner.id }, data: { timezone } });
    const today = dateOnly(localDate(new Date(), timezone));
    await db.habit.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        userId: owner.id,
        areaId: 'area-growth',
        name: 'Paused habit ' + index,
        status: 'PAUSED' as const,
        startDate: addDays(today, -1),
      })),
    });
    const active = await db.habit.create({
      data: {
        userId: owner.id,
        areaId: 'area-growth',
        name: 'Scheduled action',
        startDate: today,
      },
    });
    await db.habit.create({
      data: {
        userId: owner.id,
        areaId: 'area-growth',
        name: 'Another day',
        startDate: today,
        frequency: 'CUSTOM',
        scheduleDays: [(today.getUTCDay() + 1) % 7],
      },
    });
    await db.habitLog.create({
      data: { userId: owner.id, habitId: active.id, date: today, value: 1, targetSnapshot: 1 },
    });
    await db.task.createMany({
      data: [
        { userId: owner.id, title: 'Due today', dueDate: today },
        { userId: owner.id, title: 'Start tomorrow', startDate: addDays(today, 1) },
        { userId: owner.id, title: 'Due tomorrow', dueDate: addDays(today, 1) },
        { userId: owner.id, title: 'Archived task', status: 'ARCHIVED' },
      ],
    });
    const habits = await get('habits?today=true&limit=1', owner.cookie);
    expect(habits.body.total).toBe(1);
    expect(habits.body.items[0].id).toBe(active.id);
    expect(habits.body.date).toBe(localDate(new Date(), timezone));
    expect(habits.body.completedCount).toBe(1);
    const tasks = await get('tasks?today=true&limit=1', owner.cookie);
    expect(tasks.body.total).toBe(1);
    expect(tasks.body.items[0].title).toBe('Due today');
    expect((await get('habits?today=false&limit=1', owner.cookie)).body.total).toBe(103);
  });
  it('uses minimum actions, custom schedules and server-side filters', async () => {
    const habit = await post('habits', member.cookie, {
      name: 'A tiny reading habit',
      areaId: 'area-growth',
      target: 20,
      unit: 'pages',
      frequency: 'CUSTOM',
      scheduleDays: [new Date().getUTCDay()],
    });
    expect(habit.status).toBe(201);
    expect(
      (await post(`habits/${habit.body.id}/complete`, member.cookie, { value: 2 })).status,
    ).toBe(400);
    expect(
      (await post(`habits/${habit.body.id}/complete`, member.cookie, { minimum: true, value: 2 }))
        .body.awarded,
    ).toBe(10);
    expect((await get('habits?areaId=area-body')).body.total).toBe(0);
    expect(
      (await patch('habits/' + habit.body.id, { frequency: 'CUSTOM', scheduleDays: [] })).status,
    ).toBe(400);
    expect((await patch('habits/' + habit.body.id, { scheduleDays: [1, 1] })).status).toBe(400);
    await post(`habits/${habit.body.id}/experiments`, member.cookie, {
      reason: 'Too much reading',
      hypothesis: 'A short session may help',
      adjustment: 'Read two pages',
      action: 'PAUSE',
    });
    expect((await get('habits')).body.items[0].status).toBe('PAUSED');
  });
  it('keeps goal strategies, project updates and milestone ownership consistent', async () => {
    expect(
      (
        await post('goals', member.cookie, {
          title: 'Invalid number',
          areaId: 'area-growth',
          strategy: 'NUMERIC',
        })
      ).status,
    ).toBe(400);
    const goal = await post('goals', member.cookie, {
      title: 'Meaningful outcome',
      areaId: 'area-growth',
      strategy: 'MILESTONE',
    });
    const milestone = await post('milestones', member.cookie, {
      goalId: goal.body.id,
      title: 'One checkpoint',
    });
    expect(
      (await patch('milestones/' + milestone.body.id, { completed: true }, support.cookie)).status,
    ).toBe(404);
    expect((await patch('milestones/' + milestone.body.id, { completed: true })).status).toBe(200);
    const project = await post('projects', member.cookie, {
      title: 'A linked project',
      goalId: goal.body.id,
    });
    expect((await patch('projects/' + project.body.id, { status: 'ACTIVE' })).status).toBe(200);
    const task = await post('tasks', member.cookie, {
      title: 'A small work item',
      projectId: project.body.id,
    });
    expect((await patch('tasks/' + task.body.id, { parentId: task.body.id })).status).toBe(400);
    expect((await get('tasks?projectId=missing')).body.total).toBe(0);
    expect((await get('tasks?status=DONE')).body.total).toBe(0);
    expect((await get('tasks?status=OPEN')).body.total).toBe(1);
  });
  it('requires reliable improvement baselines and prevents accepting blocked invitations', async () => {
    const peer = await fixture();
    const request = await post('friends', member.cookie, { email: peer.email });
    expect(
      (await post('friends/' + request.body.id + '/actions', peer.cookie, { action: 'accept' }))
        .status,
    ).toBe(201);
    const a = await post('habits', member.cookie, {
      name: 'Read consistently',
      areaId: 'area-growth',
    });
    const b = await post('habits', peer.cookie, {
      name: 'Read consistently',
      areaId: 'area-growth',
    });
    const challenge = await post('challenges', member.cookie, {
      title: 'Our improvement',
      mode: 'IMPROVEMENT',
      scope: 'HABIT',
      habitId: a.body.id,
      friendIds: [peer.id],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(
      (
        await post('challenges/' + challenge.body.id + '/accept', peer.cookie, {
          habitId: b.body.id,
        })
      ).status,
    ).toBe(201);
    expect(
      (await db.challenge.findUniqueOrThrow({ where: { id: challenge.body.id } })).status,
    ).toBe('CANCELLED');
    const invited = await post('challenges', member.cookie, {
      title: 'A new invitation',
      mode: 'CONSISTENCY',
      friendIds: [peer.id],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });
    await post('friends/' + request.body.id + '/actions', member.cookie, { action: 'block' });
    expect((await post('challenges/' + invited.body.id + '/accept', peer.cookie, {})).status).toBe(
      403,
    );
    expect((await get('friends', peer.cookie)).body.items).toEqual([]);
    expect(
      (await post('friends/' + request.body.id + '/actions', peer.cookie, { action: 'remove' }))
        .status,
    ).toBe(403);
    await post('challenges/' + invited.body.id + '/actions', member.cookie, { action: 'cancel' });
    expect(
      (await post('friends/' + request.body.id + '/actions', member.cookie, { action: 'remove' }))
        .status,
    ).toBe(201);
    await app.get(ChallengeLifecycleService).tick();
  });
  it('exports private data, honors notification opt-out and erases personal content', async () => {
    await patch('profile', { bio: 'Sensitive biography', notificationsEnabled: false });
    const reward = await post('rewards', member.cookie, { title: 'Private comfort', cost: 50 });
    expect(reward.status).toBe(201);
    await http()
      .put(`/api/rewards/${reward.body.id}/favorite`)
      .set('Origin', origin)
      .set('Cookie', member.cookie)
      .send({})
      .expect(200);
    await http()
      .put(`/api/rewards/${reward.body.id}/save`)
      .set('Origin', origin)
      .set('Cookie', member.cookie)
      .send({ targetXp: 100 })
      .expect(200);
    const redemption = await db.rewardRedemption.create({
      data: {
        userId: member.id,
        rewardId: reward.body.id,
        costSnapshot: 50,
        idempotencyKey: `erasure:${member.id}`,
        rating: 5,
        ratedAt: new Date(),
      },
    });
    await post('journey/reflection', member.cookie, {
      year: 2026,
      month: 9,
      biggestWin: 'Private monthly reflection',
      failureReason: '',
      adjustment: 'Start small',
      reward: '',
    });
    expect(JSON.stringify((await post('account/export')).body)).toContain('Sensitive biography');
    const notifications = await db.notification.count({ where: { userId: member.id } });
    const feedback = await post('feedback', member.cookie, {
      title: 'A private report',
      description: 'More sensitive context to erase.',
      category: 'BUG',
    });
    await patch(
      'admin/feedback/' + feedback.body.id,
      { reply: 'Public response', internal: false },
      support.cookie,
    );
    expect(await db.notification.count({ where: { userId: member.id } })).toBe(notifications);
    expect(
      (
        await post('account/delete', member.cookie, {
          password: 'incorrect',
          confirmation: 'DELETE',
        })
      ).status,
    ).toBe(400);
    expect(
      (await post('account/delete', member.cookie, { password, confirmation: 'DELETE' })).status,
    ).toBe(201);
    expect((await get('auth/me')).status).toBe(401);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: member.id } })).bio).toBe('');
    expect(await db.monthJourney.count({ where: { userId: member.id } })).toBe(0);
    expect(await db.rewardFavorite.count({ where: { userId: member.id } })).toBe(0);
    expect(await db.rewardSavingsTarget.count({ where: { userId: member.id } })).toBe(0);
    expect(
      (await db.rewardRedemption.findUniqueOrThrow({ where: { id: redemption.id } })).rating,
    ).toBeNull();
    expect(
      (await db.habit.findMany({ where: { userId: member.id } })).every(
        (item) => item.name === 'Deleted habit',
      ),
    ).toBe(true);
    expect(await db.feedback.count({ where: { userId: member.id } })).toBe(0);
    expect(await db.xPTransaction.count({ where: { userId: member.id } })).toBeGreaterThan(0);
    expect(
      (await patch('admin/users/' + member.id, { status: 'ACTIVE' }, admin.cookie)).status,
    ).toBe(400);
  });
  it('consumes password recovery once and revokes every prior session', async () => {
    const user = await fixture();
    const nextPassword = password + '-updated';
    const missing = await post('auth/forgot-password', user.cookie, {
      email: 'not-present@security.test',
    });
    const recovery = await post('auth/forgot-password', user.cookie, { email: user.email });
    expect(recovery.body).toEqual(missing.body);
    const mail = app.get(MailAdapter).outbox.find((item) => item.to === user.email)!;
    const token = new URL(mail.url).searchParams.get('token');
    expect(
      (await post('auth/reset-password', user.cookie, { token, password: nextPassword })).status,
    ).toBe(201);
    const notice = app.get(MailAdapter).outbox.find((item) => item.purpose === 'PASSWORD_CHANGED');
    expect(notice?.to).toBe(user.email);
    expect(new URL(notice!.url).pathname).toBe('/auth/login');
    expect(new URL(notice!.url).search).toBe('');
    expect(
      (await post('auth/reset-password', user.cookie, { token, password: nextPassword })).status,
    ).toBe(400);
    expect((await get('auth/me', user.cookie)).status).toBe(401);
    const login = await post('auth/login', user.cookie, {
      email: user.email,
      password: nextPassword,
    });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    expect((await post('auth/logout-all', cookie)).status).toBe(200);
    expect((await get('auth/me', cookie)).status).toBe(401);
  });
});
