import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { seed } from '../../prisma/seed';

let app: INestApplication;
let db: Database;
let cookie: string;
let userId: string;
let areaId: string;
const origin = 'http://localhost:4200';
const post = (path: string, data: unknown) =>
  request(app.getHttpServer())
    .post('/api/' + path)
    .set('Origin', origin)
    .set('Cookie', cookie)
    .send(data);
const patch = (path: string, data: unknown) =>
  request(app.getHttpServer())
    .patch('/api/' + path)
    .set('Origin', origin)
    .set('Cookie', cookie)
    .send(data);

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
  const user = await db.user.create({
    data: {
      email: randomUUID() + '@planning.test',
      passwordHash: 'unusable-fixture-hash',
      profile: { create: { displayName: 'Thoughtful Explorer', timezone: 'UTC' } },
    },
  });
  userId = user.id;
  cookie = 'lq_session=' + (await app.get(AuthService).createSession(userId)).token;
  areaId = (await db.lifeArea.findFirstOrThrow()).id;
});
afterAll(async () => {
  await app?.close();
});

describe('Planning and recovery stay consistent across changes', () => {
  it('rejects reversed project and task dates on create and partial update', async () => {
    for (const [kind, end] of [
      ['projects', 'deadline'],
      ['tasks', 'dueDate'],
    ] as const) {
      const invalid = await post(kind, {
        title: 'Thoughtful work',
        startDate: '2026-10-10',
        [end]: '2026-10-01',
      });
      expect(invalid.status).toBe(400);
      const created = await post(kind, {
        title: 'Thoughtful work',
        startDate: '2026-10-01',
        [end]: '2026-10-10',
      });
      expect(created.status).toBe(201);
      expect((await patch(`${kind}/${created.body.id}`, { startDate: '2026-10-11' })).status).toBe(
        400,
      );
      expect((await patch(`${kind}/${created.body.id}`, { [end]: '2026-09-30' })).status).toBe(400);
      expect((await patch(`${kind}/${created.body.id}`, { startDate: '2026-10-10' })).status).toBe(
        200,
      );
    }
  });
  it('reinforces date order in PostgreSQL for every planning entity', async () => {
    const dates = { startDate: new Date('2026-10-10'), title: 'Invalid range', userId };
    await expect(
      db.goal.create({ data: { ...dates, areaId, targetDate: new Date('2026-10-01') } }),
    ).rejects.toThrow();
    await expect(
      db.project.create({ data: { ...dates, deadline: new Date('2026-10-01') } }),
    ).rejects.toThrow();
    await expect(
      db.task.create({ data: { ...dates, dueDate: new Date('2026-10-01') } }),
    ).rejects.toThrow();
  });
  it('requires explicit reconciliation before moving a project with direct task goal links', async () => {
    const first = (await post('goals', { title: 'First outcome', areaId })).body.id;
    const second = (await post('goals', { title: 'Second outcome', areaId })).body.id;
    const project = (await post('projects', { title: 'Meaningful project', goalId: first })).body
      .id;
    const task = (
      await post('tasks', { title: 'Linked work item', goalId: first, projectId: project })
    ).body.id;
    expect((await patch(`projects/${project}`, { goalId: second })).status).toBe(400);
    expect((await db.project.findUniqueOrThrow({ where: { id: project } })).goalId).toBe(first);
    expect((await patch(`tasks/${task}`, { goalId: null })).status).toBe(200);
    expect((await patch(`projects/${project}`, { goalId: second })).status).toBe(200);
  });
  it('changes schedule and commitment atomically with the learning record', async () => {
    const habit = (await post('habits', { name: 'Read with curiosity', areaId })).body.id;
    const input = {
      reason: 'Evenings are too busy',
      hypothesis: 'Morning reading is easier',
      adjustment: 'Read on Monday and Friday',
      frequency: 'CUSTOM',
      scheduleDays: [1, 5],
      commitment: 'flexible',
      target: 2,
    };
    expect((await post(`habits/${habit}/experiments`, input)).status).toBe(201);
    expect(await db.habit.findUniqueOrThrow({ where: { id: habit } })).toMatchObject({
      frequency: 'CUSTOM',
      scheduleDays: [1, 5],
      commitment: 'flexible',
      target: 2,
    });
    expect((await post(`habits/${habit}/experiments`, { ...input, scheduleDays: [] })).status).toBe(
      400,
    );
    expect(
      (await post(`habits/${habit}/experiments`, { ...input, scheduleDays: [1, 1] })).status,
    ).toBe(400);
    expect(await db.habitExperiment.count({ where: { habitId: habit } })).toBe(1);
    expect(
      (
        await post(`habits/${habit}/experiments`, {
          ...input,
          frequency: 'WEEKLY',
          weeklyTarget: 2,
          commitment: 'committed',
        })
      ).status,
    ).toBe(201);
    expect(await db.habit.findUniqueOrThrow({ where: { id: habit } })).toMatchObject({
      frequency: 'WEEKLY',
      weeklyTarget: 2,
      commitment: 'committed',
    });
  });
  it('keeps a commitment unchanged when the learning decision is KEEP', async () => {
    const habit = (await post('habits', { name: 'Keep a useful rhythm', areaId })).body.id;
    expect(
      (
        await post(`habits/${habit}/experiments`, {
          reason: 'A difficult week',
          hypothesis: 'The original plan still fits',
          adjustment: 'Keep the promise small',
          action: 'KEEP',
          target: 20,
          frequency: 'WEEKLY',
          weeklyTarget: 7,
        })
      ).status,
    ).toBe(201);
    expect(await db.habit.findUniqueOrThrow({ where: { id: habit } })).toMatchObject({
      frequency: 'DAILY',
      target: 1,
      failureReason: 'A difficult week',
    });
    expect(await db.habitExperiment.count({ where: { habitId: habit } })).toBe(1);
  });
});
