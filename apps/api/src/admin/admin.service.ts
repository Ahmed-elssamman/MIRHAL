import { attachmentSelect } from '../core/attachment-storage';
import { activityMetrics } from './activity-metrics';
import { notify } from '../common/notifications';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { feedbackAdminSchema, InputOf, paginationSchema } from '@mirhal/contracts';
import { Database } from '../common/database';
import { Identity } from '../common/http';
import { pageArgs, pageResult } from '../core/ownership';
@Injectable()
export class AdminService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async moderateChallenge(actor: Identity, id: string, reason: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Challenge" WHERE id = ${id} FOR UPDATE`;
      await this.db.lockActive(tx, actor.id, ['SUPER_ADMIN', 'ADMIN', 'MODERATOR']);
      const challenge = await tx.challenge.findUnique({ where: { id } });
      if (!challenge) throw new NotFoundException('Challenge not found.');
      if (['COMPLETED', 'CANCELLED'].includes(challenge.status))
        throw new BadRequestException('This challenge has already ended.');
      await tx.challenge.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'CHALLENGE_MODERATED',
          entity: 'Challenge',
          entityId: id,
          metadata: { reason },
        },
      });
      return { success: true };
    });
  }
  async overview() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [
      users,
      activeUsers,
      returningUsers,
      newUsers,
      activeHabits,
      logs,
      activeChallenges,
      completedChallenges,
      xp,
      redemptions,
      feedback,
      events,
      adherence,
    ] = await Promise.all([
      this.db.user.count({ where: { status: { not: 'DELETED' } } }),
      this.db.user.count({ where: { lastActiveAt: { gte: since }, status: 'ACTIVE' } }),
      this.db.user.count({
        where: { lastActiveAt: { gte: since }, createdAt: { lt: since }, status: 'ACTIVE' },
      }),
      this.db.user.count({ where: { createdAt: { gte: since }, status: { not: 'DELETED' } } }),
      this.db.habit.count({ where: { status: 'ACTIVE' } }),
      this.db.habitLog.count({ where: { createdAt: { gte: since } } }),
      this.db.challenge.count({ where: { status: 'ACTIVE' } }),
      this.db.challenge.count({ where: { status: 'COMPLETED' } }),
      this.db.xPTransaction.aggregate({
        where: { direction: 'CREDIT', type: { not: 'REWARD' } },
        _sum: { amount: true },
      }),
      this.db.rewardRedemption.count({ where: { refundedAt: null } }),
      this.db.feedback.groupBy({ by: ['status', 'category'], _count: true }),
      this.db.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
      activityMetrics(this.db),
    ]);
    return {
      ...adherence,
      users,
      activeUsers,
      newUsers,
      returningUsers,
      activeHabits,
      habitCompletions: logs,
      activeChallenges,
      completedChallenges,
      xpIssued: xp._sum.amount ?? 0,
      rewardsRedeemed: redemptions,
      feedbackVolume: feedback.reduce((sum, group) => sum + group._count, 0),
      feedback,
      events,
      periodDays: 30,
    };
  }
  async users(query: InputOf<typeof paginationSchema>) {
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { profile: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.status && ['ACTIVE', 'SUSPENDED', 'DELETED'].includes(query.status)
        ? { status: query.status as UserStatus }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          lastActiveAt: true,
          profile: { select: { displayName: true, avatarUrl: true } },
          _count: { select: { habits: true, goals: true, checkIns: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.user.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  async user(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastActiveAt: true,
        profile: { select: { displayName: true, language: true, timezone: true } },
        _count: {
          select: {
            goals: true,
            projects: true,
            tasks: true,
            habits: true,
            habitLogs: true,
            checkIns: true,
            participations: true,
            redemptions: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }
  async updateUser(
    actor: Identity,
    id: string,
    input: { status?: 'ACTIVE' | 'SUSPENDED'; role?: Role },
  ) {
    if (id === actor.id) throw new BadRequestException('You cannot change your own access.');
    return this.db.staffAtomic(
      actor.id,
      ['SUPER_ADMIN', 'ADMIN'],
      async (tx) => {
        const currentActor = await tx.user.findUniqueOrThrow({
          where: { id: actor.id },
          select: { role: true },
        });
        const target = await tx.user.findUnique({
          where: { id },
          select: { role: true, status: true },
        });
        if (!target) throw new NotFoundException();
        if (target.role !== 'USER' && currentActor.role !== 'SUPER_ADMIN')
          throw new ForbiddenException('Only a super administrator can manage staff access.');
        if (input.role && currentActor.role !== 'SUPER_ADMIN')
          throw new ForbiddenException('Only a super administrator can assign roles.');
        if (target.status === 'DELETED')
          throw new BadRequestException('Deleted accounts cannot be reactivated.');
        const user = await tx.user.update({
          where: { id },
          data: input,
          select: { id: true, status: true, role: true },
        });
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: input.role ? 'USER_ROLE_CHANGED' : 'USER_STATUS_CHANGED',
            entity: 'User',
            entityId: id,
            metadata: input,
          },
        });
        return user;
      },
      [id],
    );
  }
  async feedback(query: InputOf<typeof paginationSchema>) {
    const where: Prisma.FeedbackWhereInput = {
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.feedback.findMany({
        where,
        include: {
          replies: true,
          attachments: { select: attachmentSelect },
          user: { select: { id: true, profile: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.feedback.count({ where }),
    ]);
    return pageResult(
      items.map((item) => ({
        ...item,
        userId: item.anonymous ? null : item.userId,
        user: item.anonymous ? null : item.user,
      })),
      total,
      query.page,
      query.limit,
    );
  }
  async updateFeedback(actor: Identity, id: string, input: InputOf<typeof feedbackAdminSchema>) {
    return this.db.staffAtomic(
      actor.id,
      ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR'],
      async (tx) => {
        const feedback = await tx.feedback.update({
          where: { id },
          data: {
            status: input.status,
            priority: input.priority,
            ...(input.reply
              ? {
                  replies: {
                    create: { body: input.reply, internal: input.internal, authorRole: actor.role },
                  },
                }
              : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'FEEDBACK_UPDATED',
            entity: 'Feedback',
            entityId: id,
            metadata: { status: input.status, internal: input.internal },
          },
        });
        if (feedback.userId && !input.internal)
          await notify(tx, {
            data: {
              userId: feedback.userId,
              type: 'FEEDBACK',
              title: 'An update on your feedback',
              body: `Your feedback “${feedback.title}” has an update.`,
              arabic: {
                title: 'تحديث على ملاحظتك',
                body: `هناك تحديث بشأن ملاحظتك «${feedback.title}».`,
              },
              href: '/feedback',
            },
          });
        return { id: feedback.id, status: feedback.status };
      },
    );
  }
}
