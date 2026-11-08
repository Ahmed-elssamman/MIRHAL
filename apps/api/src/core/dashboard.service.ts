import { habitStreaks } from './habit-streaks';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  isScheduled,
  dateOnly,
  goalProgress,
  habitAdherence,
  journeyScore,
  localDate,
  percent,
  projectProgress,
} from '@mirhal/domain';
import { Database } from '../common/database';
import { Identity } from '../common/http';
import { XpService } from '../gamification/xp.service';
@Injectable()
export class DashboardService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
  ) {}
  async summary(user: Identity, period: 'recent' | 'month' = 'recent', month?: string) {
    const current = dateOnly(localDate(new Date(), user.timezone));
    if (month && month > current.toISOString().slice(0, 7))
      throw new BadRequestException('Choose the current month or an earlier chapter.');
    const monthEnd = month
      ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
      : current;
    const today = monthEnd < current ? monthEnd : current;
    const exclusiveEnd = addDays(today, 1);
    const historical = today < current;
    const start =
      period === 'month'
        ? dateOnly((month ?? today.toISOString().slice(0, 7)) + '-01')
        : addDays(today, -27);
    const periodDays = Math.round((today.getTime() - start.getTime()) / 86400000) + 1;
    const [
      profile,
      habits,
      goals,
      projects,
      tasks,
      checkIns,
      quests,
      xp,
      areas,
      challengeCount,
      achievements,
      periodXp,
    ] = await Promise.all([
      this.db.profile.findUniqueOrThrow({ where: { userId: user.id } }),
      this.db.habit.findMany({
        where: {
          userId: user.id,
          ...(historical ? { startDate: { lte: today } } : { status: 'ACTIVE' as const }),
        },
        include: {
          area: true,
          logs: { where: { date: { gte: start, lt: exclusiveEnd } }, select: { date: true } },
        },
      }),
      this.db.goal.findMany({
        where: {
          userId: user.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          createdAt: { lt: exclusiveEnd },
        },
        include: {
          area: true,
          projects: { include: { tasks: { select: { status: true } } } },
          milestones: true,
        },
      }),
      this.db.project.findMany({
        where: {
          userId: user.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          createdAt: { lt: exclusiveEnd },
        },
        include: { tasks: { select: { status: true } } },
      }),
      this.db.task.findMany({
        where: {
          userId: user.id,
          status: { in: ['PLANNED', 'ACTIVE'] },
          OR: [{ dueDate: { lte: today } }, { dueDate: null }],
          AND: [{ OR: [{ startDate: null }, { startDate: { lte: today } }] }],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      this.db.dailyCheckIn.findMany({
        where: { userId: user.id, date: { gte: start, lt: exclusiveEnd } },
        orderBy: { date: 'desc' },
      }),
      this.db.weeklyQuest.findMany({
        where: {
          userId: user.id,
          deadline: { gte: start },
          createdAt: { lt: exclusiveEnd },
          ...(period === 'month' ? { deadline: { gte: start, lt: exclusiveEnd } } : {}),
        },
        include: { area: true, items: true },
        orderBy: { deadline: 'asc' },
        take: 12,
      }),
      this.xp.summary(user.id),
      this.db.lifeArea.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      this.db.challengeParticipant.count({
        where: { userId: user.id, status: 'ACCEPTED', challenge: { status: 'ACTIVE' } },
      }),
      this.db.userAchievement.findMany({
        where: { userId: user.id },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
        take: 3,
      }),
      this.db.$queryRaw<
        { amount: number }[]
      >`SELECT COALESCE(SUM(amount),0)::float AS amount FROM "XPTransaction" WHERE "userId"=${user.id} AND direction='CREDIT' AND type<>'REWARD' AND ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${user.timezone})::date >= ${start.toISOString().slice(0, 10)}::date AND ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${user.timezone})::date < ${exclusiveEnd.toISOString().slice(0, 10)}::date`,
    ]);
    const mean = (numbers: number[]) =>
      numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
    const streaks = await habitStreaks(
      this.db,
      habits.map((habit) => habit.id),
      today,
    );
    const habitScores = habits.map((habit) => ({
      ...habit,
      scheduledToday: isScheduled(habit, today),
      streak: streaks.get(habit.id) ?? 0,
      adherence: habitAdherence(
        habit,
        habit.logs,
        period === 'month' ? start : addDays(today, -13),
        today,
      ),
      completedToday: habit.logs.some((log) => log.date.getTime() === today.getTime()),
    }));
    const recoveries = checkIns.filter((checkIn) => checkIn.recoveryIntention.trim()).length;
    const score = journeyScore({
      habits: mean(habitScores.map((habit) => habit.adherence)),
      quests: mean(
        quests.map((quest) =>
          percent(quest.items.filter((item) => item.completedAt).length, quest.items.length),
        ),
      ),
      goals: mean(goals.map((goal) => goalProgress(goal))),
      checkIns: percent(checkIns.length, periodDays),
      projects: mean(projects.map((project) => projectProgress(project.tasks))),
      recovery: percent(
        recoveries,
        Math.max(1, checkIns.filter((checkIn) => checkIn.difficulty.trim()).length),
      ),
    });
    const areaProgress = areas.map((area) => ({
      ...area,
      adherence: Math.round(
        mean(
          habitScores.filter((habit) => habit.areaId === area.id).map((habit) => habit.adherence),
        ),
      ),
      habits: habitScores.filter((habit) => habit.areaId === area.id).length,
      goals: goals.filter((goal) => goal.areaId === area.id).length,
    }));
    const activity = Array.from({ length: periodDays }, (_, i) => {
      const date = addDays(start, i).toISOString().slice(0, 10);
      return {
        date,
        habits: habits.reduce(
          (sum, habit) =>
            sum + habit.logs.filter((log) => log.date.toISOString().slice(0, 10) === date).length,
          0,
        ),
        checkIn: checkIns.some((checkIn) => checkIn.date.toISOString().slice(0, 10) === date),
      };
    });
    return {
      profile,
      periodStart: start,
      periodEnd: today,
      historical,
      periodDays,
      periodXp: periodXp[0]?.amount ?? 0,
      date: today,
      xp,
      journey: score,
      areas: areaProgress,
      habits: habitScores
        .filter((habit) => habit.scheduledToday)
        .slice(0, 8)
        .map((habit) => ({
          id: habit.id,
          name: habit.name,
          area: habit.area,
          target: habit.target,
          unit: habit.unit,
          xpReward: habit.xpReward,
          completedToday: habit.completedToday,
          adherence: habit.adherence,
          streak: habit.streak,
          scheduledToday: habit.scheduledToday,
        })),
      habitCount: habits.length,
      completedHabits: habitScores.filter((habit) => habit.completedToday).length,
      tasks,
      quests: quests.map((quest) => ({
        ...quest,
        progress: percent(
          quest.items.filter((item) => item.completedAt).length,
          quest.items.length,
        ),
      })),
      goals: goals
        .map((goal) => ({
          id: goal.id,
          title: goal.title,
          area: goal.area,
          progress: goalProgress(goal),
          targetDate: goal.targetDate,
        }))
        .slice(0, 5),
      checkedIn: checkIns.some((checkIn) => checkIn.date.getTime() === today.getTime()),
      activity,
      challengeCount,
      achievements,
      checkInCount: checkIns.length,
      recoveryCount: recoveries,
      weakestHabit: [...habitScores].sort((a, b) => a.adherence - b.adherence)[0]?.name ?? null,
    };
  }
}
