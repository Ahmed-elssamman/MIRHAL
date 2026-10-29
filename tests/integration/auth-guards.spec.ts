import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionAuthGuard } from '../../apps/api/src/auth/guards/session-auth.guard';
import { RolesGuard } from '../../apps/api/src/auth/guards/roles.guard';
import { Database } from '../../apps/api/src/common/database';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { ApiRequest, Identity } from '../../apps/api/src/common/http';

let app: INestApplication;
let db: Database;
let authService: AuthService;

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  db = app.get(Database);
  authService = app.get(AuthService);
});

afterAll(async () => {
  await app?.close();
});

describe('Separation of Concerns: AuthN (SessionAuthGuard) & AuthZ (RolesGuard)', () => {
  const reflector = new Reflector();

  function mockContext(
    cookies: Record<string, string> = {},
    handlerMetadata: Record<string, unknown> = {},
    identity?: Identity,
  ) {
    const request = {
      cookies,
      identity,
      requestId: 'test-req-id',
    } as unknown as ApiRequest;
    const handler = () => {};
    const targetClass = class {};

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => targetClass,
    } as unknown as ExecutionContext;

    // Apply metadata
    if (handlerMetadata['public']) {
      Reflect.defineMetadata('public', true, handler);
    }
    if (handlerMetadata['roles']) {
      Reflect.defineMetadata('roles', handlerMetadata['roles'], handler);
    }

    return { context, request };
  }

  describe('SessionAuthGuard (AuthN)', () => {
    it('allows public routes unconditionally', async () => {
      const guard = new SessionAuthGuard(db, reflector);
      const { context } = mockContext({}, { public: true });
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('rejects requests with missing session cookie', async () => {
      const guard = new SessionAuthGuard(db, reflector);
      const { context } = mockContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('authenticates valid session and attaches identity to request', async () => {
      const email = `authn-${randomUUID()}@example.test`;
      const user = await db.user.create({
        data: {
          email,
          passwordHash: await argon2.hash('test-pwd-long'),
          role: 'USER',
          profile: { create: { displayName: 'AuthN Test', timezone: 'UTC' } },
        },
      });
      const session = await authService.createSession(user.id);

      const guard = new SessionAuthGuard(db, reflector);
      const { context, request } = mockContext({ lq_session: session.token });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(request.identity).toBeDefined();
      expect(request.identity.id).toBe(user.id);
      expect(request.identity.role).toBe('USER');
    });

    it('rejects expired or suspended sessions', async () => {
      const email = `suspended-${randomUUID()}@example.test`;
      const user = await db.user.create({
        data: {
          email,
          passwordHash: await argon2.hash('test-pwd-long'),
          role: 'USER',
          status: 'ACTIVE',
          profile: { create: { displayName: 'Suspended Test', timezone: 'UTC' } },
        },
      });
      const session = await authService.createSession(user.id);

      // Now suspend the user
      await db.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });

      const guard = new SessionAuthGuard(db, reflector);
      const { context } = mockContext({ lq_session: session.token });

      await expect(guard.canActivate(context)).rejects.toThrow(/expired|sign in again/);
    });
  });

  describe('RolesGuard (AuthZ)', () => {
    it('allows access when no roles are required', () => {
      const guard = new RolesGuard(reflector);
      const { context } = mockContext({}, {}, { id: 'u1', role: 'USER' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows access when identity has matching role', () => {
      const guard = new RolesGuard(reflector);
      const { context } = mockContext(
        {},
        { roles: ['ADMIN', 'SUPER_ADMIN'] as Role[] },
        { id: 'admin1', role: 'ADMIN' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('denies access with 403 ForbiddenException when identity lacks matching role', () => {
      const guard = new RolesGuard(reflector);
      const { context } = mockContext(
        {},
        { roles: ['ADMIN'] as Role[] },
        { id: 'u1', role: 'USER' },
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects anonymous caller when route requires roles', () => {
      const guard = new RolesGuard(reflector);
      const { context } = mockContext({}, { roles: ['ADMIN'] as Role[] }, undefined);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
