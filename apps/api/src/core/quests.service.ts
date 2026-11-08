import { notify } from '../common/notifications';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InputOf, questSchema, paginationSchema } from '@mirhal/contracts';
import { percent } from '@mirhal/domain';
import { Database } from '../common/database';
import { XpService } from '../gamification/xp.service';
import { assertReferences, pageArgs, pageResult } from './ownership';
@Injectable()
export class QuestsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
  ) {}
  async list(userId: string, query: InputOf<typeof paginationSchema>) {
    const where = {
      userId,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [quests, total] = await Promise.all([
      this.db.weeklyQuest.findMany({
        where,
        include: { area: true, items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query.page, query.limit),
      }),
      this.db.weeklyQuest.count({ where }),
    ]);
    return pageResult(
      quests.map((quest) => ({
        ...quest,
        progress: percent(
          quest.items.filter((item) => item.completedAt).length,
          quest.items.length,
        ),
      })),
      total,
      query.page,
      query.limit,
    );
  }
  async create(userId: string, input: InputOf<typeof questSchema>) {
    if (
      new Date(input.deadline) <= new Date() ||
      new Date(input.deadline).getTime() > Date.now() + 31 * 86_400_000
    )
      throw new BadRequestException('Choose a deadline within the next month.');
    const { items, ...data } = input;
    return this.db.atomic(userId, async (tx) => {
      await assertReferences(tx, userId, input);
      return tx.weeklyQuest.create({
        data: {
          ...data,
          userId,
          xpReward: input.difficulty === 'HARD' ? 150 : input.difficulty === 'EASY' ? 60 : 100,
          items: { create: items.map((title, sortOrder) => ({ title, sortOrder })) },
        },
        include: { items: true },
      });
    });
  }
  async completeItem(userId: string, questId: string, itemId: string) {
    return this.db.atomic(userId, async (tx) => {
      const quest = await tx.weeklyQuest.findFirst({
        where: { id: questId, userId },
        include: { items: true },
      });
      if (!quest || !quest.items.some((item) => item.id === itemId)) throw new NotFoundException();
      if (quest.completedAt) return { completed: true, awarded: 0 };
      if (quest.deadline < new Date())
        throw new BadRequestException(
          'This quest has ended. Start a fresh quest with what you learned.',
        );
      await tx.questProgress.updateMany({
        where: { id: itemId, completedAt: null },
        data: { completedAt: new Date() },
      });
      const remaining = await tx.questProgress.count({ where: { questId, completedAt: null } });
      if (remaining) return { completed: false, awarded: 0 };
      await tx.weeklyQuest.update({ where: { id: questId }, data: { completedAt: new Date() } });
      const { awarded, levelUp } = await this.xp.award(
        tx,
        userId,
        'QUEST',
        questId,
        quest.xpReward,
        `quest:${questId}`,
      );
      const unlocks = await this.xp.evaluateAchievements(tx, userId);
      await notify(tx, {
        data: {
          userId,
          type: 'QUEST',
          title: 'Quest complete',
          body: `You completed ${quest.title}. Take a moment to enjoy it.`,
          arabic: {
            title: 'اكتملت المهمة',
            body: `أكملت ${quest.title}. خذ لحظة لتستمتع بإنجازك.`,
          },
          href: '/quests',
        },
      });
      await tx.analyticsEvent.create({ data: { userId, name: 'quest_completed' } });
      return {
        completed: true,
        awarded,
        achievements: unlocks.achievements,
        levelUp: unlocks.levelUp ?? levelUp,
      };
    });
  }
}
