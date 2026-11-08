import { notify } from '../common/notifications';
import { achievementProgress } from './achievement-progress';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, XpType } from '@prisma/client';
import { levelProgress } from '@mirhal/domain';
import { Database } from '../common/database';
@Injectable()
export class XpService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async totals(tx: Prisma.TransactionClient, userId: string) {
    const groups = await tx.xPTransaction.groupBy({
      by: ['direction', 'type'],
      where: { userId },
      _sum: { amount: true },
    });
    const balance = groups.reduce(
      (sum, group) => sum + (group.direction === 'CREDIT' ? 1 : -1) * (group._sum.amount ?? 0),
      0,
    );
    const earned = groups
      .filter((group) => group.direction === 'CREDIT' && group.type !== 'REWARD')
      .reduce((sum, group) => sum + (group._sum.amount ?? 0), 0);
    return { balance, earned };
  }
  async award(
    tx: Prisma.TransactionClient,
    userId: string,
    type: XpType,
    source: string,
    amount: number,
    key: string,
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid XP amount');
    const existing = await tx.xPTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { awarded: 0, transaction: existing, levelUp: null };
    const before = await this.totals(tx, userId);
    const transaction = await tx.xPTransaction.create({
      data: { userId, type, source, amount, idempotencyKey: key },
    });
    const levels = await tx.level.findMany({ orderBy: { minXp: 'asc' } });
    const oldLevel = levelProgress(before.earned, levels).current;
    const newLevel = levelProgress(before.earned + amount, levels).current;
    const levelUp = newLevel && oldLevel && newLevel.number > oldLevel.number ? newLevel : null;
    if (levelUp) {
      await notify(tx, {
        data: {
          userId,
          type: 'LEVEL_UP',
          title: 'A new chapter unlocked',
          body: `You reached ${levelUp.title}. Every small step brought you here.`,
          arabic: {
            title: 'فصل جديد في رحلتك',
            body: `وصلت إلى مستوى ${levelUp.titleAr}. كل خطوة صغيرة أوصلتك إلى هنا.`,
          },
          href: '/achievements',
        },
      });
      await tx.analyticsEvent.create({
        data: { userId, name: 'level_up', metadata: { level: levelUp.number } },
      });
    }
    return { awarded: amount, transaction, levelUp };
  }
  async evaluateAchievements(tx: Prisma.TransactionClient, userId: string) {
    const [achievements, owned, values] = await Promise.all([
      tx.achievement.findMany({ where: { active: true } }),
      tx.userAchievement.findMany({ where: { userId } }),
      achievementProgress(tx, userId),
    ]);
    const unlocked: string[] = [];
    let levelUp: Awaited<ReturnType<XpService['award']>>['levelUp'] = null;
    for (const achievement of achievements) {
      if (
        (values[achievement.condition] ?? 0) < achievement.threshold ||
        owned.some((item) => item.achievementId === achievement.id)
      )
        continue;
      await tx.userAchievement.create({ data: { userId, achievementId: achievement.id } });
      const award = await this.award(
        tx,
        userId,
        'ACHIEVEMENT',
        achievement.id,
        achievement.xpReward,
        `achievement:${userId}:${achievement.id}`,
      );
      levelUp = award.levelUp ?? levelUp;
      await notify(tx, {
        data: {
          userId,
          type: 'ACHIEVEMENT',
          title: achievement.title,
          body: achievement.description,
          arabic: {
            title: achievement.titleAr,
            body:
              achievement.descriptionAr ||
              'إنجاز جديد يقدّر تقدمك. شاهد تفاصيله في صفحة الإنجازات.',
          },
          href: '/achievements',
        },
      });
      await tx.analyticsEvent.create({
        data: { userId, name: 'achievement_unlocked', metadata: { achievementId: achievement.id } },
      });
      unlocked.push(achievement.title);
    }
    return { achievements: unlocked, levelUp };
  }
  async summary(userId: string) {
    const [totals, levels, recent] = await Promise.all([
      this.totals(this.db, userId),
      this.db.level.findMany({ orderBy: { minXp: 'asc' } }),
      this.db.xPTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { ...totals, level: levelProgress(totals.earned, levels), recent };
  }
}
