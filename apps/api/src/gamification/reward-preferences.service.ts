import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InputOf, paginationSchema } from '@mirhal/contracts';
import { Database } from '../common/database';
import { pageArgs, pageResult } from '../core/ownership';
import { XpService } from './xp.service';

@Injectable()
export class RewardPreferencesService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
  ) {}

  favorite(userId: string, rewardId: string, enabled: boolean) {
    return this.db.atomic(userId, async (tx) => {
      if (enabled) {
        const reward = await tx.reward.findFirst({
          where: { id: rewardId, active: true, OR: [{ userId }, { userId: null }] },
          select: { id: true },
        });
        if (!reward) throw new NotFoundException();
        await tx.rewardFavorite.upsert({
          where: { userId_rewardId: { userId, rewardId } },
          create: { userId, rewardId },
          update: {},
        });
      } else {
        await tx.rewardFavorite.deleteMany({ where: { userId, rewardId } });
      }
      return { favorite: enabled };
    });
  }

  saveTarget(userId: string, rewardId: string, requestedXp?: number) {
    return this.db.atomic(userId, async (tx) => {
      const reward = await tx.reward.findFirst({
        where: { id: rewardId, active: true, OR: [{ userId }, { userId: null }] },
        select: { id: true, cost: true },
      });
      if (!reward) throw new NotFoundException();
      const targetXp = requestedXp ?? reward.cost;
      if (targetXp < reward.cost)
        throw new BadRequestException('The savings target must cover the current reward cost.');
      return tx.rewardSavingsTarget.upsert({
        where: { userId_rewardId: { userId, rewardId } },
        create: { userId, rewardId, targetXp },
        update: { targetXp },
      });
    });
  }

  removeTarget(userId: string, rewardId: string) {
    return this.db.atomic(userId, async (tx) => {
      await tx.rewardSavingsTarget.deleteMany({ where: { userId, rewardId } });
      return { saved: false };
    });
  }

  async savings(userId: string, query: InputOf<typeof paginationSchema>) {
    const [items, total, totals] = await Promise.all([
      this.db.rewardSavingsTarget.findMany({
        where: { userId },
        include: {
          reward: {
            select: {
              id: true,
              userId: true,
              title: true,
              titleAr: true,
              category: true,
              categoryAr: true,
              cost: true,
              icon: true,
              active: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.rewardSavingsTarget.count({ where: { userId } }),
      this.xp.totals(this.db, userId),
    ]);
    const currentXp = Math.max(0, totals.balance);
    return pageResult(
      items.map((item) => {
        const targetXp = Math.max(item.targetXp, item.reward.cost);
        return {
          ...item,
          targetXp,
          currentXp,
          remainingXp: Math.max(0, targetXp - currentXp),
          progressPercent: Math.min(100, Math.round((currentXp / targetXp) * 100)),
          status: !item.reward.active ? 'UNAVAILABLE' : currentXp >= targetXp ? 'READY' : 'SAVING',
        };
      }),
      total,
      query.page,
      query.limit,
    );
  }

  rate(userId: string, redemptionId: string, rating: number) {
    return this.db.atomic(userId, async (tx) => {
      const redemption = await tx.rewardRedemption.findFirst({
        where: { id: redemptionId, userId },
      });
      if (!redemption) throw new NotFoundException();
      if (redemption.refundedAt)
        throw new BadRequestException('A returned reward cannot be rated.');
      if (redemption.rating === rating) return redemption;
      const updated = await tx.rewardRedemption.update({
        where: { id: redemptionId },
        data: { rating, ratedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'REWARD_FEEDBACK_RECORDED',
          entity: 'RewardRedemption',
          entityId: redemptionId,
        },
      });
      return updated;
    });
  }
}
