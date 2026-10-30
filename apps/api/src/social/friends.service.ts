import { Prisma } from '@prisma/client';
import { InputOf, paginationSchema } from '@lifequest/contracts';
import { pageArgs, pageResult } from '../core/ownership';
import { notify } from '../common/notifications';
import { MailAdapter } from '../auth/mail.adapter';
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
  async request(userId: string, email: string) {
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
      select: { id: true, status: true },
    });
    if (!receiver) {
      if (process.env['NODE_ENV'] !== 'test' && !sender?.emailVerifiedAt)
        throw new BadRequestException('Verify your email before inviting someone to MIRHAL.');
      const today = new Date().toISOString().slice(0, 10);
      const inviterName = sender.profile?.displayName ?? 'A MIRHAL friend';
      const language = sender.profile?.language === 'en' ? 'en' : 'ar';
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (this.db.invitation) {
        const existing = await this.db.invitation.findFirst({
          where: { senderId: userId, email: normalizedEmail, status: 'PENDING' },
        });
        if (existing) {
          await this.db.invitation.update({
            where: { id: existing.id },
            data: { tokenHash, expiresAt },
          });
        } else {
          await this.db.invitation.create({
            data: {
              senderId: userId,
              email: normalizedEmail,
              tokenHash,
              expiresAt,
            },
          });
        }
      }

      await this.mail.sendFriendInvite(
        normalizedEmail,
        inviterName,
        `${userId}:${normalizedEmail}:${today}:${inviterName}:${language}`,
        language,
        rawToken,
      );
      return { channel: 'email' as const, status: 'accepted' as const };
    }

    if (receiver.status !== 'ACTIVE' || receiver.id === userId)
      throw new BadRequestException('A request could not be sent to this address.');
    const pairKey = [userId, receiver.id].sort().join(':');
    return this.db.atomic(userId, async (tx) => {
      const existing = await tx.friendship.findUnique({ where: { pairKey } });
      if (existing) {
        if (existing.status === 'ACCEPTED')
          throw new ConflictException('You are already friends with this person.');
        if (existing.status === 'PENDING')
          throw new ConflictException('A friend request is already pending with this person.');
        if (existing.status === 'BLOCKED')
          throw new ForbiddenException('Cannot send friend request to this user.');
      }
      const friendship = existing
        ? await tx.friendship.update({
            where: { pairKey },
            data: { senderId: userId, receiverId: receiver.id, status: 'PENDING' },
          })
        : await tx.friendship.create({
            data: { senderId: userId, receiverId: receiver.id, pairKey },
          });
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
      return { channel: 'friendship' as const, id: friendship.id, status: friendship.status };
    });
  }
  async resolveInvitation(token: string) {
    if (!token || typeof token !== 'string') return { valid: false as const, reason: 'not-found' as const };
    const tokenHash = hashToken(token);
    const invitation = await this.db.invitation.findUnique({
      where: { tokenHash },
      include: { sender: { select: { profile: { select: { displayName: true } } } } },
    });
    if (!invitation) return { valid: false as const, reason: 'not-found' as const };
    if (invitation.status === 'ACCEPTED') return { valid: false as const, reason: 'already-used' as const };
    if (invitation.status === 'REVOKED') return { valid: false as const, reason: 'revoked' as const };
    if (invitation.expiresAt <= new Date()) {
      if (invitation.status === 'PENDING') {
        await this.db.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
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

    const receiver = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
    });

    const pairKey = [invitation.senderId, userId].sort().join(':');
    return this.db.atomic(userId, async (tx) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      const existing = await tx.friendship.findUnique({ where: { pairKey } });
      let friendship;
      if (existing) {
        friendship = await tx.friendship.update({
          where: { pairKey },
          data: { status: 'ACCEPTED' },
        });
      } else {
        friendship = await tx.friendship.create({
          data: {
            senderId: invitation.senderId,
            receiverId: userId,
            pairKey,
            status: 'ACCEPTED',
          },
        });
      }
      await notify(tx, {
        data: {
          userId: invitation.senderId,
          type: 'FRIEND_ACCEPT',
          title: 'Your friend joined MIRHAL',
          body: `${receiver.profile?.displayName ?? 'Your friend'} accepted your invitation!`,
          arabic: {
            title: 'انضم صديقك إلى مِرحال',
            body: `قبل ${receiver.profile?.displayName ?? 'صديقك'} دعوتك بنجاح!`,
          },
          href: '/friends',
        },
      });
      return { success: true, friendshipId: friendship.id };
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
        return tx.friendship.update({
          where: { id },
          data: { status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' },
        });
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
