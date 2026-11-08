import { habitStreaks } from './habit-streaks';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  experimentSchema,
  habitLogSchema,
  habitSchema,
  habitUpdateSchema,
  InputOf,
  paginationSchema,
} from '@mirhal/contracts';
import {
  addDays,
  dateOnly,
  habitAdherence,
  habitXp,
  isScheduled,
  localDate,
  needsRecovery,
  repeatedMisses,
} from '@mirhal/domain';
import { Database } from '../common/database';
import { Identity } from '../common/http';
import { XpService } from '../gamification/xp.service';
import { assertReferences, dates, pageArgs, pageResult } from './ownership';
@Injectable()
export class HabitsService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
  ) {}
  async list(user: Identity, query: InputOf<typeof paginationSchema>) {
    const today = dateOnly(localDate(new Date(), user.timezone));
    const where: Prisma.HabitWhereInput = {
      userId: user.id,
      ...(query.today
        ? {
            status: 'ACTIVE',
            startDate: { lte: today },
            OR: [{ frequency: { not: 'CUSTOM' } }, { scheduleDays: { has: today.getUTCDay() } }],
          }
        : {}),
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [habits, count, completedCount] = await Promise.all([
      this.db.habit.findMany({
        where,
        include: {
          area: true,
          goal: { select: { id: true, title: true } },
          logs: { where: { date: { gte: addDays(today, -90) } }, orderBy: { date: 'desc' } },
          experiments: { take: 3, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.habit.count({ where }),
      query.today
        ? this.db.habit.count({ where: { ...where, logs: { some: { date: today } } } })
        : Promise.resolve(0),
    ]);
    const streaks = await habitStreaks(
      this.db,
      habits.map((habit) => habit.id),
      today,
    );
    return {
      ...pageResult(
        habits.map((habit) => ({
          ...habit,
          adherence: habitAdherence(habit, habit.logs, addDays(today, -13), today),
          streak: streaks.get(habit.id) ?? 0,
          completedToday: habit.logs.some((log) => log.date.getTime() === today.getTime()),
          scheduledToday: isScheduled(habit, today),
          recoverySuggested: habit.status === 'ACTIVE' && needsRecovery(habit, habit.logs, today),
          recoveryPattern: habit.status === 'ACTIVE' && repeatedMisses(habit, habit.logs, today),
        })),
        count,
        query.page,
        query.limit,
      ),
      date: today.toISOString().slice(0, 10),
      ...(query.today ? { completedCount } : {}),
    };
  }
  async create(user: Identity, input: InputOf<typeof habitSchema>) {
    this.validateSchedule(input);
    return this.db.atomic(user.id, async (tx) => {
      await assertReferences(tx, user.id, input);
      const habit = await tx.habit.create({
        data: {
          ...dates(input, ['startDate']),
          startDate: input.startDate
            ? dateOnly(input.startDate)
            : dateOnly(localDate(new Date(), user.timezone)),
          userId: user.id,
          xpReward: habitXp(input.difficulty, false),
        },
      });
      await tx.analyticsEvent.create({ data: { userId: user.id, name: 'habit_created' } });
      return habit;
    });
  }
  async update(user: Identity, id: string, input: InputOf<typeof habitUpdateSchema>) {
    return this.db.atomic(user.id, async (tx) => {
      const habit = await tx.habit.findFirst({ where: { id, userId: user.id } });
      if (!habit) throw new NotFoundException();
      if (
        input.unit &&
        input.unit !== habit.unit &&
        (await tx.challengeHabitSnapshot.count({
          where: { habitId: id, participant: { challenge: { status: 'ACTIVE' } } },
        }))
      )
        throw new BadRequestException(
          'Keep this unit until your active challenge ends so recorded values stay comparable.',
        );
      this.validateSchedule({ ...habit, ...input });
      await assertReferences(tx, user.id, input);
      return tx.habit.update({
        where: { id },
        data: {
          ...dates(input, ['startDate']),
          ...(input.difficulty ? { xpReward: habitXp(input.difficulty, false) } : {}),
        },
      });
    });
  }
  private validateSchedule(input: { frequency: string; scheduleDays: number[] }) {
    if (input.frequency === 'CUSTOM' && input.scheduleDays.length === 0)
      throw new BadRequestException('Choose at least one day for a custom schedule.');
    if (new Set(input.scheduleDays).size !== input.scheduleDays.length)
      throw new BadRequestException('Schedule days must be unique.');
  }
  async complete(user: Identity, id: string, input: InputOf<typeof habitLogSchema>) {
    return this.db.atomic(user.id, async (tx) => {
      const habit = await tx.habit.findFirst({ where: { id, userId: user.id } });
      if (!habit) throw new NotFoundException();
      const date = dateOnly(localDate(new Date(), user.timezone));
      const existing = await tx.habitLog.findUnique({
        where: { habitId_date: { habitId: id, date } },
      });
      if (existing) return { log: existing, awarded: 0, duplicate: true, achievements: [] };
      if (habit.status !== 'ACTIVE')
        throw new BadRequestException('Resume this habit before recording an action.');
      if (!isScheduled(habit, date))
        throw new BadRequestException('This habit is not scheduled for today.');
      const value = input.value ?? (input.minimum ? Math.min(1, habit.target) : habit.target);
      if (!input.minimum && value < habit.target)
        throw new BadRequestException('Use the minimum action option for a smaller step.');
      if (value > habit.target * 10)
        throw new BadRequestException('This value is above the recording limit.');
      const log = await tx.habitLog.create({
        data: {
          habitId: id,
          userId: user.id,
          date,
          value,
          minimum: input.minimum,
          note: input.note,
          targetSnapshot: habit.target,
        },
      });
      const { awarded, levelUp } = await this.xp.award(
        tx,
        user.id,
        'HABIT',
        id,
        habitXp(habit.difficulty, input.minimum),
        `habit:${id}:${date.toISOString().slice(0, 10)}`,
      );
      const unlocks = await this.xp.evaluateAchievements(tx, user.id);
      await tx.analyticsEvent.create({
        data: { userId: user.id, name: 'habit_completed', metadata: { minimum: input.minimum } },
      });
      return {
        log,
        awarded,
        achievements: unlocks.achievements,
        levelUp: unlocks.levelUp ?? levelUp,
        duplicate: false,
      };
    });
  }
  async experiment(user: Identity, id: string, input: InputOf<typeof experimentSchema>) {
    return this.db.atomic(user.id, async (tx) => {
      const habit = await tx.habit.findFirst({ where: { id, userId: user.id } });
      if (!habit) throw new NotFoundException();
      const adjustment =
        input.action === 'ADJUST'
          ? {
              target: input.target,
              minimumAction: input.minimumAction,
              preferredTime: input.preferredTime,
              frequency: input.frequency,
              scheduleDays: input.scheduleDays,
              weeklyTarget: input.weeklyTarget,
              commitment: input.commitment,
            }
          : {};
      this.validateSchedule({
        frequency: adjustment.frequency ?? habit.frequency,
        scheduleDays: adjustment.scheduleDays ?? habit.scheduleDays,
      });
      const experiment = await tx.habitExperiment.create({
        data: {
          habitId: id,
          reason: input.reason,
          hypothesis: input.hypothesis,
          adjustment: input.adjustment,
        },
      });
      await tx.habit.update({
        where: { id },
        data: {
          failureReason: input.reason,
          nextExperiment: input.hypothesis,
          ...adjustment,
          ...(input.action === 'PAUSE'
            ? { status: 'PAUSED' }
            : input.action === 'ARCHIVE'
              ? { status: 'ARCHIVED' }
              : {}),
        },
      });
      return experiment;
    });
  }
}
