import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { PlanningService } from '../../apps/api/src/core/planning.service';

describe('Performance Baseline and Optimization', () => {
  let app: INestApplication;
  let db: Database;
  let planning: PlanningService;
  let cookie: string;
  let userId: string;
  const origin = 'http://localhost:4200';

  beforeAll(async () => {
    app = configureApp(
      await NestFactory.create(AppModule, { logger: false, bodyParser: false, abortOnError: false }),
    );
    await app.init();
    db = app.get(Database);
    planning = app.get(PlanningService);

    const user = await db.user.create({
      data: {
        email: `bench-${Date.now()}@perf.test`,
        passwordHash: 'fixture-hash',
        profile: { create: { displayName: 'Perf Tester', timezone: 'UTC' } },
      },
    });
    userId = user.id;
    cookie = 'lq_session=' + (await app.get(AuthService).createSession(userId)).token;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('measures baseline latency for task completion and daily queries', async () => {
    const area = await db.lifeArea.findFirstOrThrow();
    const goalRes = await request(app.getHttpServer())
      .post('/api/goals')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'Performance Goal', areaId: area.id });
    const goalId = goalRes.body.id;

    const projectRes = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'Performance Project', goalId });
    const projectId = projectRes.body.id;

    const taskRes = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ title: 'Performance Task', projectId, goalId });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.id;

    // Warm up
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' });

    // 1. Measure PATCH /api/tasks/:id (HTTP roundtrip through Nest + DB)
    const patchTimings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const status = i % 2 === 0 ? 'COMPLETED' : 'ACTIVE';
      const start = performance.now();
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Origin', origin)
        .set('Cookie', cookie)
        .send({ status });
      patchTimings.push(performance.now() - start);
      expect(res.status).toBe(200);
    }

    // 2. Measure GET /api/tasks?today=true&limit=8
    const getTimings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const res = await request(app.getHttpServer())
        .get('/api/tasks?today=true&limit=8')
        .set('Origin', origin)
        .set('Cookie', cookie);
      getTimings.push(performance.now() - start);
      expect(res.status).toBe(200);
    }

    // 3. Measure direct planningService.updateTask execution
    const serviceTimings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const status = i % 2 === 0 ? 'COMPLETED' : 'ACTIVE';
      const start = performance.now();
      await planning.updateTask(userId, taskId, { status });
      serviceTimings.push(performance.now() - start);
    }

    const avgPatch = (patchTimings.reduce((a, b) => a + b, 0) / patchTimings.length).toFixed(2);
    const avgGet = (getTimings.reduce((a, b) => a + b, 0) / getTimings.length).toFixed(2);
    const avgService = (serviceTimings.reduce((a, b) => a + b, 0) / serviceTimings.length).toFixed(2);
    const sequentialTotal = (parseFloat(avgPatch) + parseFloat(avgGet)).toFixed(2);

    console.log(`[PERF BASELINE] PATCH task avg: ${avgPatch} ms`);
    console.log(`[PERF BASELINE] GET today tasks avg: ${avgGet} ms`);
    console.log(`[PERF BASELINE] Sequential PATCH + GET (pre-optimization total): ${sequentialTotal} ms`);
    console.log(`[PERF BASELINE] Service updateTask avg: ${avgService} ms`);

    expect(patchTimings.length).toBe(5);
  });
});
