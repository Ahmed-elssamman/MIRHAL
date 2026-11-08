import { notify } from '../common/notifications';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InputOf, rewardSchema, rewardUpdateSchema, paginationSchema } from '@mirhal/contracts';
import { pageArgs, pageResult } from '../core/ownership';
import { Database } from '../common/database';
import { XpService } from './xp.service';
@Injectable()
export class RewardsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
  ) {}
  async list(userId: string, query: InputOf<typeof paginationSchema>) {
    const where = { active: true, OR: [{ userId }, { userId: null }] };
    const [items, total] = await Promise.all([
      this.db.reward.findMany({
        where,
        orderBy: { cost: 'asc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.reward.count({ where }),
    ]);
    const favorites = await this.db.rewardFavorite.findMany({
      where: { userId, rewardId: { in: items.map((item) => item.id) } },
      select: { rewardId: true },
    });
    const favoriteIds = new Set(favorites.map((item) => item.rewardId));
    return pageResult(
      items.map((item) => ({ ...item, favorite: favoriteIds.has(item.id) })),
      total,
      query.page,
      query.limit,
    );
  }
  async mine(userId: string, query: InputOf<typeof paginationSchema>) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.db.reward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.reward.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  create(userId: string, input: InputOf<typeof rewardSchema>) {
    return this.db.atomic(userId, (tx) => tx.reward.create({ data: { ...input, userId } }));
  }
  update(userId: string, rewardId: string, input: InputOf<typeof rewardUpdateSchema>) {
    return this.db.atomic(userId, async (tx) => {
      const reward = await tx.reward.findFirst({ where: { id: rewardId, userId } });
      if (!reward) throw new NotFoundException();
      return tx.reward.update({ where: { id: rewardId }, data: input });
    });
  }
  async redeem(userId: string, rewardId: string, idempotencyKey: string) {
    const key = `redeem:${userId}:${idempotencyKey}`;
    return this.db.atomic(userId, async (tx) => {
      const existing = await tx.rewardRedemption.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        if (existing.rewardId !== rewardId)
          throw new ConflictException('This request key was already used for another reward.');
        return { redemption: existing, duplicate: true };
      }
      const reward = await tx.reward.findFirst({
        where: { id: rewardId, active: true, OR: [{ userId }, { userId: null }] },
      });
      if (!reward) throw new NotFoundException();
      const totals = await this.xp.totals(tx, userId);
      if (totals.balance < reward.cost)
        throw new BadRequestException({
          code: 'INSUFFICIENT_XP',
          message: 'You are getting closer. Earn a little more XP for this reward.',
        });
      if (
        reward.redemptionLimit &&
        (await tx.rewardRedemption.count({ where: { userId, rewardId, refundedAt: null } })) >=
          reward.redemptionLimit
      )
        throw new BadRequestException('You have reached the redemption limit for this reward.');
      if (reward.cooldownDays > 0) {
        const latest = await tx.rewardRedemption.findFirst({
          where: { userId, rewardId, refundedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        if (latest && Date.now() - latest.createdAt.getTime() < reward.cooldownDays * 86400000)
          throw new BadRequestException(
            'This reward will be ready again after its waiting period.',
          );
      }
      const redemption = await tx.rewardRedemption.create({
        data: { userId, rewardId, costSnapshot: reward.cost, idempotencyKey: key },
      });
      await tx.xPTransaction.create({
        data: {
          userId,
          type: 'REWARD',
          source: redemption.id,
          direction: 'DEBIT',
          amount: reward.cost,
          idempotencyKey: key,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'REWARD_REDEEMED',
          entity: 'RewardRedemption',
          entityId: redemption.id,
        },
      });
      await tx.analyticsEvent.create({ data: { userId, name: 'reward_redeemed' } });
      await notify(tx, {
        data: {
          userId,
          type: 'REWARD',
          title: 'You earned this',
          body: `Enjoy ${reward.title}. Rest and enjoyment belong in your journey.`,
          arabic: {
            title: 'تستحق هذه المكافأة',
            body: `استمتع بـ ${reward.titleAr || (reward.userId === null ? 'مكافأتك' : reward.title)}. الراحة والمتعة جزء من رحلتك.`,
          },
          href: '/rewards',
        },
      });
      return { redemption, duplicate: false };
    });
  }
  async refund(userId: string, redemptionId: string) {
    return this.db.atomic(userId, async (tx) => {
      const redemption = await tx.rewardRedemption.findFirst({
        where: { id: redemptionId, userId },
      });
      if (!redemption) throw new NotFoundException();
      if (redemption.refundedAt) return { success: true, duplicate: true };
      if (Date.now() - redemption.createdAt.getTime() > 5 * 60_000)
        throw new BadRequestException('Rewards can be undone within five minutes.');
      await tx.rewardRedemption.update({
        where: { id: redemptionId },
        data: { refundedAt: new Date(), rating: null, ratedAt: null },
      });
      await tx.xPTransaction.create({
        data: {
          userId,
          type: 'REWARD',
          source: redemption.id,
          amount: redemption.costSnapshot,
          idempotencyKey: `refund:${redemption.id}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'REWARD_REFUNDED',
          entity: 'RewardRedemption',
          entityId: redemption.id,
        },
      });
      return { success: true, duplicate: false };
    });
  }
}
