import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../apps/api/src/app.module';
import { Database } from '../../apps/api/src/common/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { FriendsService } from '../../apps/api/src/social/friends.service';
import { hashToken } from '../../apps/api/src/auth/auth.guard';

describe('invitation lifecycle against PostgreSQL', () => {
  let app: INestApplication;
  let db: Database;
  let auth: AuthService;
  let mail: MailAdapter;
  let friends: FriendsService;
  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.init();
    db = app.get(Database);
    auth = app.get(AuthService);
    mail = app.get(MailAdapter);
    friends = app.get(FriendsService);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('binds registration to an invitation and creates a pending request only after email verification', async () => {
    const suffix = randomUUID();
    const email = `recipient-${suffix}@example.test`;
    const sender = await db.user.create({
      data: {
        email: `sender-${suffix}@example.test`,
        passwordHash: 'fixture',
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: 'Sender', language: 'en' } },
      },
    });
    const sent = await friends.request(sender.id, email);
    expect(sent).toEqual({ channel: 'email', status: 'accepted' });
    const invite = mail.outbox.findLast(
      (entry) => entry.to === email && entry.purpose === 'FRIEND_INVITE',
    );
    const inviteToken = new URL(invite!.url).searchParams.get('inviteToken')!;
    const registered = await auth.register({
      email,
      password: 'test-password-at-least-twelve',
      displayName: 'Recipient',
      timezone: 'UTC',
      language: 'en',
      inviteToken,
    });
    const invitationBefore = await db.invitation.findFirstOrThrow({
      where: { senderId: sender.id, email },
    });
    expect(invitationBefore.status).toBe('PENDING');
    expect(invitationBefore.recipientId).toBe(registered.user.id);
    const pairKey = [sender.id, registered.user.id].sort().join(':');
    expect(await db.friendship.findUnique({ where: { pairKey } })).toBeNull();
    const verification = mail.outbox.findLast(
      (entry) => entry.to === email && entry.purpose === 'VERIFY_EMAIL',
    );
    const verificationToken = new URL(verification!.url).searchParams.get('token')!;
    await auth.consume(verificationToken, 'VERIFY_EMAIL');
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id: invitationBefore.id } })).status,
    ).toBe('PENDING');
    expect(await db.friendship.findUnique({ where: { pairKey } })).toBeNull();
    await expect(friends.acceptInvitation(registered.user.id, inviteToken)).resolves.toMatchObject({
      status: 'accepted',
    });
    expect(
      (await db.invitation.findUniqueOrThrow({ where: { id: invitationBefore.id } })).status,
    ).toBe('ACCEPTED');
    expect((await db.friendship.findUniqueOrThrow({ where: { pairKey } })).status).toBe('ACCEPTED');
    expect(
      await db.notification.count({ where: { userId: sender.id, type: 'FRIEND_ACCEPTED' } }),
    ).toBe(1);
    await expect(friends.acceptInvitation(registered.user.id, inviteToken)).rejects.toThrow();
  });

  it('keeps one active invitation across concurrent retries and invalidates the earlier link', async () => {
    const suffix = randomUUID();
    const email = `invite-${suffix}@example.test`;
    const sender = await db.user.create({
      data: {
        email: `sender-${suffix}@example.test`,
        passwordHash: 'fixture',
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: 'Sender' } },
      },
    });
    const results = await Promise.allSettled([
      friends.request(sender.id, email),
      friends.request(sender.id, email),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
    const activeInvitations = await db.invitation.findMany({
      where: { senderId: sender.id, email, status: 'PENDING' },
    });
    expect(activeInvitations).toHaveLength(1);
    const sent = mail.outbox.filter(
      (entry) => entry.to === email && entry.purpose === 'FRIEND_INVITE',
    );
    expect(sent).toHaveLength(2);
    const activeToken = new URL(sent.at(-1)!.url).searchParams.get('inviteToken');
    expect(activeInvitations[0]!.tokenHash).toBe(hashToken(activeToken!));
  });
});
