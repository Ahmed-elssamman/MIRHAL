import { Prisma } from '@prisma/client';
import { InputOf, paginationSchema } from '@mirhal/contracts';
import { pageArgs, pageResult } from '../core/ownership';
import { notify } from '../common/notifications';
import { MailAdapter } from '../auth/mail.adapter';
import { classifyDeliveryError } from '../mail/mail.types';
import { hashToken } from '../auth/auth.guard';
import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../common/database';
const friendProfile = {
  id: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} as const;
@Injectable()
export class FriendsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(MailAdapter) private readonly mail: MailAdapter,
  ) {}
  async list(userId: string, query: InputOf<typeof paginationSchema>) {
    const where: Prisma.FriendshipWhereInput = {
      AND: [
        { OR: [{ senderId: userId }, { receiverId: userId }] },
        { OR: [{ status: { not: 'BLOCKED' } }, { blockedById: userId }] },
      ],
      ...(query.status === 'ACCEPTED' ? { status: 'ACCEPTED' } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.friendship.findMany({
        where,
        include: { sender: { select: friendProfile }, receiver: { select: friendProfile } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.friendship.count({ where }),
    ]);
    return pageResult(
      items
        .filter((item) => item.status !== 'BLOCKED' || item.blockedById === userId)
        .map((item) => ({
          id: item.id,
          status: item.status,
          incoming: item.receiverId === userId,
          friend: item.senderId === userId ? item.receiver : item.sender,
          createdAt: item.createdAt,
        })),
      total,
      query.page,
      query.limit,
    );
  }
  async request(userId: string, email: string, requestId?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const sender = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        profile: { select: { displayName: true, language: true } },
      },
    });
    if (!sender) {
      throw new NotFoundException('User not found.');
    }
    if (sender.email.toLowerCase() === normalizedEmail)
      throw new BadRequestException('You cannot send a friend request to yourself.');

    const receiver = await this.db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
        profile: { select: { notificationsEnabled: true, language: true } },
      },
    });
    if (!receiver) {
      this.mail.assertConfigured();
      const inviterName = sender.profile?.displayName ?? 'A MIRHAL friend';
      const language = sender.profile?.language === 'en' ? 'en' : 'ar';
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.db.atomic(userId, async (tx) => {
        const existing = await tx.invitation.findFirst({
          where: {
            senderId: userId,
            email: normalizedEmail,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (existing) {
          // Rotate the bearer token on an explicit retry. Any previously delivered
          // link becomes unusable, and the retry remains one active invitation.
          await tx.invitation.updateMany({
            where: {
              id: existing.id,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            data: { tokenHash, expiresAt },
          });
        } else {
          await tx.invitation.create({
            data: { senderId: userId, email: normalizedEmail, tokenHash, expiresAt },
          });
        }
      });

      try {
        const delivery = requestId
          ? this.mail.sendFriendInvite(
              normalizedEmail,
              inviterName,
              tokenHash,
              language,
              rawToken,
              false,
              requestId,
            )
          : this.mail.sendFriendInvite(normalizedEmail, inviterName, tokenHash, language, rawToken);
        await delivery;
      } catch (error) {
        // A definitive rejection cannot have produced a usable email. Ambiguous failures
        // stay pending because the provider may already have accepted the message.
        if (classifyDeliveryError(error) !== 'temporary')
          await this.db.invitation.updateMany({
            where: { tokenHash, status: 'PENDING' },
            data: { status: 'REVOKED' },
          });
        throw error;
      }
      return { channel: 'email' as const, status: 'accepted' as const };
    }

    // A syntactically valid address can belong to a suspended/deactivated account.
    // Report this as an unavailable account state rather than mislabeling it as bad input.
    if (receiver.status !== 'ACTIVE')
      throw new ConflictException({
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'This account cannot receive friend requests right now.',
      });
    if (receiver.id === userId)
      throw new BadRequestException('You cannot send a friend request to yourself.');
    const pairKey = [userId, receiver.id].sort().join(':');
    const friendship = await this.db.atomic(userId, async (tx) => {
      const existing = await tx.friendship.findUnique({ where: { pairKey } });
      if (existing) {
        if (existing.status === 'ACCEPTED')
          throw new ConflictException('You are already friends with this person.');
        if (
          existing.status === 'PENDING' &&
          (existing.senderId !== userId || existing.receiverId !== receiver.id)
        )
          throw new ConflictException('A friend request is already pending with this person.');
        if (existing.status === 'BLOCKED')
          throw new ForbiddenException('Cannot send friend request to this user.');
      }
      const friendship =
        existing?.status === 'PENDING'
          ? existing
          : existing
            ? await tx.friendship.update({
                where: { pairKey },
                data: { senderId: userId, receiverId: receiver.id, status: 'PENDING' },
              })
            : await tx.friendship.create({
                data: { senderId: userId, receiverId: receiver.id, pairKey },
              });
      if (!existing || existing.status === 'REJECTED') {
        const senderProfile = await tx.profile.findUnique({
          where: { userId },
          select: { displayName: true },
        });
        await notify(tx, {
          data: {
            userId: receiver.id,
            type: 'FRIEND_REQUEST',
            title: 'A little company on your journey',
            body: `${senderProfile?.displayName ?? 'Someone'} sent you a friend request.`,
            arabic: {
              title: 'رفيق جديد في رحلتك',
              body: `أرسل ${senderProfile?.displayName ?? 'أحد المستخدمين'} إليك طلب صداقة.`,
            },
            href: '/friends',
          },
        });
      }
      return friendship;
    });
    // The in-app request is committed before delivery. Never report it as emailed unless
    // the provider accepts the message; provider/configuration errors remain server errors.
    const inviterName = sender.profile?.displayName ?? 'A MIRHAL friend';
    const language = receiver.profile?.language === 'en' ? 'en' : 'ar';
    const eventId = `friendship:${friendship.id}`;
    if (requestId)
      await this.mail.sendFriendInvite(
        normalizedEmail,
        inviterName,
        eventId,
        language,
        undefined,
        true,
        requestId,
      );
    else
      await this.mail.sendFriendInvite(
        normalizedEmail,
        inviterName,
        eventId,
        language,
        undefined,
        true,
      );
    return {
      channel: 'friendship' as const,
      id: friendship.id,
      status: friendship.status,
      emailStatus: 'accepted' as const,
    };
  }
  async resolveInvitation(token: string) {
    if (!token || typeof token !== 'string')
      return { valid: false as const, reason: 'not-found' as const };
    const tokenHash = hashToken(token);
    const invitation = await this.db.invitation.findUnique({
      where: { tokenHash },
      include: { sender: { select: { profile: { select: { displayName: true } } } } },
    });
    if (!invitation) return { valid: false as const, reason: 'not-found' as const };
    if (invitation.status === 'ACCEPTED')
      return { valid: false as const, reason: 'already-used' as const };
    if (invitation.status === 'DECLINED')
      return { valid: false as const, reason: 'already-processed' as const };
    if (invitation.status === 'EXPIRED')
      return { valid: false as const, reason: 'expired' as const };
    if (invitation.status === 'REVOKED')
      return { valid: false as const, reason: 'revoked' as const };
    if (invitation.expiresAt <= new Date()) {
      if (invitation.status === 'PENDING') {
        await this.db.invitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash,
            status: 'PENDING',
            expiresAt: { lte: new Date() },
          },
          data: { status: 'EXPIRED' },
        });
      }
      return { valid: false as const, reason: 'expired' as const };
    }
    return {
      valid: true as const,
      email: invitation.email,
      inviterName: invitation.sender.profile?.displayName ?? 'A MIRHAL friend',
    };
  }
  async acceptInvitation(userId: string, token: string) {
    if (!token || typeof token !== 'string')
      throw new BadRequestException('A valid invitation token is required.');
    const tokenHash = hashToken(token);
    const invitation = await this.db.invitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date())
      throw new BadRequestException('Invitation is invalid or has expired.');
    if (invitation.senderId === userId)
      throw new BadRequestException('You cannot accept your own invitation.');

    const pairKey = [invitation.senderId, userId].sort().join(':');
    return this.db.atomic(userId, async (tx) => {
      const receiver = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, emailVerifiedAt: true },
      });
      if (receiver.email.toLowerCase() !== invitation.email.toLowerCase())
        throw new ForbiddenException('This invitation belongs to a different email address.');
      if (!receiver.emailVerifiedAt) {
        const bound = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
            OR: [{ recipientId: null }, { recipientId: userId }],
          },
          data: { recipientId: userId },
        });
        if (bound.count !== 1)
          throw new BadRequestException('Invitation is invalid or has expired.');
        return { success: true as const, status: 'awaiting_verification' as const };
      }
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
          OR: [{ recipientId: null }, { recipientId: userId }],
        },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('Invitation is invalid or has expired.');
      const existing = await tx.friendship.findUnique({ where: { pairKey } });
      if (existing?.status === 'BLOCKED')
        throw new ForbiddenException('Cannot use this invitation.');
      const friendship = existing
        ? await tx.friendship.update({
            where: { pairKey },
            data: {
              senderId: invitation.senderId,
              receiverId: userId,
              status: 'ACCEPTED',
              blockedById: null,
            },
          })
        : await tx.friendship.create({
            data: {
              senderId: invitation.senderId,
              receiverId: userId,
              pairKey,
              status: 'ACCEPTED',
            },
          });
      if (!existing || existing.status !== 'ACCEPTED')
        await notify(tx, {
          data: {
            userId: invitation.senderId,
            type: 'FRIEND_ACCEPTED',
            title: 'Your friend accepted your invitation',
            body: 'Your friend is ready to continue the journey together.',
            arabic: {
              title: 'قبل صديقك دعوتك',
              body: 'أصبح بإمكانكما مواصلة الرحلة معاً.',
            },
            href: '/friends',
          },
        });
      return {
        success: true as const,
        status: 'accepted' as const,
        friendshipId: friendship.id,
      };
    });
  }
  async declineInvitation(userId: string, token: string) {
    if (!token || typeof token !== 'string')
      throw new BadRequestException('A valid invitation token is required.');
    const tokenHash = hashToken(token);
    return this.db.atomic(userId, async (tx) => {
      const receiver = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, emailVerifiedAt: true },
      });
      if (!receiver.emailVerifiedAt)
        throw new ForbiddenException('Verify your email before responding to this invitation.');
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
        select: { senderId: true, email: true },
      });
      if (!invitation || invitation.email.toLowerCase() !== receiver.email.toLowerCase())
        throw new ForbiddenException('This invitation belongs to a different email address.');
      const declined = await tx.invitation.updateMany({
        where: {
          tokenHash,
          email: invitation.email,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
          OR: [{ recipientId: null }, { recipientId: userId }],
        },
        data: { status: 'DECLINED' },
      });
      if (declined.count !== 1)
        throw new BadRequestException('Invitation is invalid or has expired.');
      await notify(tx, {
        data: {
          userId: invitation.senderId,
          type: 'FRIEND_DECLINED',
          title: 'Your friend declined the invitation',
          body: 'Your invitation was declined.',
          arabic: { title: 'رفض صديقك الدعوة', body: 'تم رفض دعوتك.' },
          href: '/friends',
        },
      });
      return { success: true as const, status: 'declined' as const };
    });
  }
  async action(userId: string, id: string, action: string) {
    return this.db.atomic(userId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Friendship" WHERE id = ${id} FOR UPDATE`;
      const friendship = await tx.friendship.findFirst({
        where: { id, OR: [{ senderId: userId }, { receiverId: userId }] },
      });
      if (!friendship) throw new NotFoundException();
      if (friendship.status === 'BLOCKED' && friendship.blockedById !== userId)
        throw new ForbiddenException();
      if (action === 'block')
        return tx.friendship.update({
          where: { id },
          data: { status: 'BLOCKED', blockedById: userId },
        });
      if (friendship.status === 'BLOCKED') {
        if (action !== 'remove' || friendship.blockedById !== userId)
          throw new ForbiddenException();
        return tx.friendship.delete({ where: { id } });
      }
      if (action === 'accept' || action === 'reject') {
        if (friendship.receiverId !== userId || friendship.status !== 'PENDING')
          throw new ForbiddenException();
        const updated = await tx.friendship.update({
          where: { id },
          data: { status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' },
        });
        if (action === 'accept')
          await notify(tx, {
            data: {
              userId: friendship.senderId,
              type: 'FRIEND_ACCEPTED',
              title: 'Your friend request was accepted',
              body: 'You are now connected on MIRHAL.',
              arabic: { title: 'تم قبول طلب الصداقة', body: 'أصبحتما صديقين في مِرحال.' },
              href: '/friends',
            },
          });
        return updated;
      }
      if (
        action === 'cancel' &&
        (friendship.senderId !== userId || friendship.status !== 'PENDING')
      )
        throw new ForbiddenException();
      await tx.friendship.delete({ where: { id } });
      return { success: true };
    });
  }
}
