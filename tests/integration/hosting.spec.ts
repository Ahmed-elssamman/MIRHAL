import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { Request } from 'express';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { clientTracker, DatabaseRateLimit } from '../../apps/api/src/common/rate-limit';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';

let app: INestApplication;
let db: Database;
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
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await app?.close();
});

describe('Production hosting behavior', () => {
  it('keeps a newly created account usable when verification email temporarily fails', async () => {
    const mail = app.get(MailAdapter);
    const send = vi
      .spyOn(mail, 'send')
      .mockRejectedValueOnce(new ServiceUnavailableException('Delivery failed'));
    const email = `mail-failure-${crypto.randomUUID()}@example.test`;
    try {
      const registration = await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('Origin', 'http://localhost:4200')
        .send({ email, password: 'isolated-test-password-long', displayName: 'Email retry' });
      expect(registration.status).toBe(201);
      expect(registration.body.verificationEmail).toBe('unavailable');
      expect(registration.body.user.emailVerifiedAt).toBeNull();
      const cookie = registration.headers['set-cookie'][0].split(';')[0];
      expect(
        (await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie)).status,
      ).toBe(200);
      expect(
        (
          await request(app.getHttpServer())
            .post('/api/auth/resend-verification')
            .set('Origin', 'http://localhost:4200')
            .set('Cookie', cookie)
        ).status,
      ).toBe(201);
      expect(mail.outbox.some((item) => item.to === email)).toBe(true);
      expect(await db.user.count({ where: { email } })).toBe(1);
    } finally {
      send.mockRestore();
    }
  });
  it('supports registration without email, leaving verification pending and no recovery promise', async () => {
    vi.stubEnv('MAIL_MODE', 'disabled');
    const http = () => request(app.getHttpServer());
    const email = `hosting-${crypto.randomUUID()}@example.test`;
    const password = 'isolated-test-password-long';
    try {
      expect((await http().get('/api/auth/capabilities')).body).toEqual({ emailDelivery: false });
      const registration = await http()
        .post('/api/auth/register')
        .set('Origin', 'http://localhost:4200')
        .send({ email, password, displayName: 'Hosting Test' });
      expect(registration.status).toBe(201);
      expect(registration.body.user.emailVerifiedAt).toBeNull();
      expect(app.get(MailAdapter).outbox.some((mail) => mail.to === email)).toBe(false);
      expect(await db.authToken.count({ where: { userId: registration.body.user.id } })).toBe(0);
      const cookie = registration.headers['set-cookie'][0].split(';')[0];
      expect(
        (
          await http()
            .post('/api/auth/resend-verification')
            .set('Origin', 'http://localhost:4200')
            .set('Cookie', cookie)
        ).status,
      ).toBe(503);
      for (const target of [email, 'missing@example.test']) {
        const recovery = await http()
          .post('/api/auth/forgot-password')
          .set('Origin', 'http://localhost:4200')
          .send({ email: target });
        expect(recovery.status).toBe(503);
        expect(recovery.body.message).toContain('unavailable');
      }
      expect(
        (
          await http()
            .post('/api/auth/login')
            .set('Origin', 'http://localhost:4200')
            .send({ email, password })
        ).status,
      ).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('requires a correctly authenticated maintenance request', async () => {
    vi.stubEnv('CRON_SECRET', 'test-maintenance-secret');
    try {
      for (const token of ['', 'Bearer wrong'])
        expect(
          (
            await request(app.getHttpServer())
              .get('/api/internal/maintenance')
              .set('Authorization', token)
          ).status,
        ).toBe(401);
      const lifecycle = app.get(
        (await import('../../apps/api/src/social/challenge-lifecycle.service'))
          .ChallengeLifecycleService,
      );
      const tick = vi.spyOn(lifecycle, 'tick').mockResolvedValueOnce();
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/internal/maintenance')
            .set('Authorization', 'Bearer test-maintenance-secret')
        ).status,
      ).toBe(200);
      expect(tick).toHaveBeenCalledOnce();
      tick.mockRestore();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('shares atomic rate limits between instances and resets expired windows', async () => {
    const first = new DatabaseRateLimit(db),
      second = new DatabaseRateLimit(db);
    const key = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        (index % 2 ? first : second).increment(key, 60000, 3, 60000),
      ),
    );
    expect(results.filter((result) => !result.isBlocked)).toHaveLength(3);
    expect(results.map((result) => result.totalHits).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    await db.rateLimitBucket.updateMany({
      data: { expiresAt: new Date(0), blockedUntil: new Date(0) },
    });
    expect((await first.increment(key, 60000, 3, 60000)).totalHits).toBe(1);
  });
  it('only trusts the platform client header inside Vercel', () => {
    const req = { ip: '127.0.0.1', headers: { 'x-vercel-forwarded-for': '192.0.2.10' } } as Request;
    expect(clientTracker(req)).toBe('127.0.0.1');
    vi.stubEnv('VERCEL', '1');
    try {
      expect(clientTracker(req)).toBe('192.0.2.10');
      req.headers['x-vercel-forwarded-for'] = 'invalid';
      expect(clientTracker(req)).toBe('127.0.0.1');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
