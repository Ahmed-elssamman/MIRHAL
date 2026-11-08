import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma, TokenPurpose } from '@prisma/client';
import { InputOf, registerSchema } from '@mirhal/contracts';
import { Database } from '../common/database';
import { hashToken } from './auth.guard';
import { MailAdapter } from './mail.adapter';
export const safeUser = {
  id: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  profile: true,
  createdAt: true,
} as const;
@Injectable()
export class AuthService {
  private dummyHash: Promise<string> = argon2.hash(randomBytes(32).toString('hex'));
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(MailAdapter) private readonly mail: MailAdapter,
  ) {}
  async register(input: InputOf<typeof registerSchema>) {
    if (this.mail.enabled) this.mail.assertConfigured();
    if (await this.db.user.findUnique({ where: { email: input.email }, select: { id: true } }))
      throw new ConflictException('An account with this email already exists.');
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await this.db.$transaction(async (tx) => {
      if (input.inviteToken) {
        const invitation = await tx.invitation.findUnique({
          where: { tokenHash: hashToken(input.inviteToken) },
          select: { email: true, status: true, expiresAt: true },
        });
        if (
          invitation?.status === 'PENDING' &&
          invitation.expiresAt > new Date() &&
          invitation.email.toLowerCase() !== input.email.toLowerCase()
        ) {
          throw new ForbiddenException(
            'Register with the email address that received this invitation.',
          );
        }
      }
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          profile: {
            create: {
              displayName: input.displayName,
              timezone: input.timezone,
              language: input.language,
            },
          },
          events: { create: { name: 'signup' } },
        },
        select: safeUser,
      });
      if (input.inviteToken) {
        await tx.invitation.updateMany({
          where: {
            tokenHash: hashToken(input.inviteToken),
            email: input.email,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
            recipientId: null,
          },
          data: { recipientId: created.id },
        });
      }
      return created;
    });
    const session = await this.createSession(user.id);
    let verificationEmail: 'accepted' | 'disabled' | 'unavailable' = 'disabled';
    if (this.mail.enabled) {
      try {
        verificationEmail = (await this.issueEmailToken(
          user.id,
          input.email,
          'VERIFY_EMAIL',
          input.inviteToken,
        ))
          ? 'accepted'
          : 'unavailable';
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
        // The account already exists. Keep it usable and offer verification retry.
        verificationEmail = 'unavailable';
      }
    }
    return { user, ...session, verificationEmail };
  }
  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    const valid = await argon2.verify(
      user?.status === 'ACTIVE' ? user.passwordHash : await this.dummyHash,
      password,
    );
    if (!user || !valid || user.status !== 'ACTIVE')
      throw new UnauthorizedException('Email or password is incorrect.');
    return this.db.atomic(user.id, async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      // A password reset may have committed while Argon2 was verifying the old hash.
      if (current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException('Email or password is incorrect.');
      const safe = await tx.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
        select: safeUser,
      });
      return { user: safe, ...(await this.persistSession(tx, user.id)) };
    });
  }
  async createSession(userId: string) {
    return this.db.atomic(userId, (tx) => this.persistSession(tx, userId));
  }
  private async persistSession(tx: Prisma.TransactionClient, userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await tx.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
    return { token, expiresAt };
  }
  async refresh(userId: string, sessionId: string) {
    return this.db.atomic(userId, async (tx) => {
      const session = await tx.session.findUnique({ where: { id: sessionId, userId } });
      const now = Date.now();
      if (
        !session ||
        session.expiresAt.getTime() <= now ||
        now - session.createdAt.getTime() >= 7 * 86_400_000
      )
        throw new UnauthorizedException('Please sign in again to renew your session.');
      const expiresAt = new Date(
        Math.min(now + 60 * 60 * 1000, session.createdAt.getTime() + 7 * 86_400_000),
      );
      await tx.session.update({ where: { id: sessionId, userId }, data: { expiresAt } });
      return { expiresAt };
    });
  }
  async issueEmailToken(
    userId: string,
    email: string,
    purpose: TokenPurpose,
    inviteToken?: string,
  ) {
    this.mail.assertConfigured();
    const token = randomBytes(32).toString('base64url');
    const issued = await this.db.atomic(userId, async (tx) => {
      // The user row lock makes this budget effective across API instances.
      const recent = await tx.authToken.count({
        where: { userId, purpose, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
      });
      if (recent >= 5) return false;
      await tx.authToken.create({
        data: {
          userId,
          purpose,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + (purpose === 'RESET_PASSWORD' ? 30 : 1440) * 60_000),
        },
      });
      return true;
    });
    if (!issued) return false;
    const profile = await this.db.profile.findUnique({
      where: { userId },
      select: { language: true },
    });
    await this.mail.send(
      email,
      purpose,
      token,
      profile?.language === 'en' ? 'en' : 'ar',
      inviteToken,
    );
    return true;
  }
  async forgot(email: string) {
    this.mail.assertConfigured();
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (user?.status === 'ACTIVE') {
      try {
        await this.issueEmailToken(user.id, email, 'RESET_PASSWORD');
      } catch (error) {
        // A provider failure must not reveal whether this address belongs to an account.
        if (!(error instanceof ServiceUnavailableException)) throw error;
      }
    }
    return {
      message: 'For privacy, the same response is returned whether or not an account exists.',
    };
  }
  async consume(token: string, purpose: TokenPurpose, password?: string) {
    const passwordHash = password
      ? await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        })
      : undefined;
    const result = await this.db.$transaction(async (tx) => {
      const record = await tx.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!record || record.usedAt || record.expiresAt < new Date() || record.purpose !== purpose)
        throw new BadRequestException('This link has expired or has already been used.');
      await this.db.lockActive(tx, record.userId);
      const claimed = await tx.authToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException('This link has already been used.');
      const passwordResetRecipient =
        purpose === 'RESET_PASSWORD'
          ? await tx.user.findUniqueOrThrow({
              where: { id: record.userId },
              select: { email: true, profile: { select: { language: true } } },
            })
          : undefined;
      await tx.user.update({
        where: { id: record.userId },
        data: purpose === 'VERIFY_EMAIL' ? { emailVerifiedAt: new Date() } : { passwordHash },
      });
      if (purpose === 'RESET_PASSWORD') {
        await tx.session.deleteMany({ where: { userId: record.userId } });
        await tx.authToken.updateMany({
          where: { userId: record.userId, purpose, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      return {
        passwordResetNotice: passwordResetRecipient
          ? {
              email: passwordResetRecipient.email,
              language: (passwordResetRecipient.profile?.language === 'en' ? 'en' : 'ar') as
                'en' | 'ar',
              eventId: record.id,
            }
          : undefined,
      };
    });
    if (result.passwordResetNotice) {
      try {
        await this.mail.sendPasswordChanged(
          result.passwordResetNotice.email,
          result.passwordResetNotice.eventId,
          result.passwordResetNotice.language,
        );
      } catch {
        // Password reset is already committed; a failed security notice cannot undo it.
      }
    }
    return { success: true };
  }
}
