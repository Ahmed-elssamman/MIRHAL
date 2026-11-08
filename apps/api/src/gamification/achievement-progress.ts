import { habitStreaks } from '../core/habit-streaks';
import { Prisma } from '@prisma/client';
import { dateOnly, localDate } from '@mirhal/domain';

/** Shared authority for both unlock decisions and progress displayed by the API. */
export async function achievementProgress(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Record<string, number>> {
  const profile = await tx.profile.findUniqueOrThrow({
    where: { userId },
    select: { timezone: true },
  });
  const today = dateOnly(localDate(new Date(), profile.timezone));
  const [habitCount, checkInCount, questCount, challengeCount, habits] = await Promise.all([
    tx.habitLog.count({ where: { userId } }),
    tx.dailyCheckIn.count({ where: { userId } }),
    tx.weeklyQuest.count({ where: { userId, completedAt: { not: null } } }),
    tx.challengeParticipant.count({
      where: { userId, status: 'ACCEPTED', challenge: { status: 'COMPLETED' } },
    }),
    tx.habit.findMany({
      where: { userId, status: 'ACTIVE', frequency: { not: 'WEEKLY' } },
      select: { id: true },
    }),
  ]);
  const streaks = await habitStreaks(
    tx,
    habits.map((habit) => habit.id),
    today,
  );
  return {
    HABIT_COUNT: habitCount,
    CHECK_IN_COUNT: checkInCount,
    QUEST_COUNT: questCount,
    CHALLENGE_COUNT: challengeCount,
    STREAK_DAYS: Math.max(0, ...streaks.values()),
  };
}
