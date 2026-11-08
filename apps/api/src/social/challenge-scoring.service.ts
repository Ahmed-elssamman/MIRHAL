import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ScoringEngine, addDays, dateOnly, isScheduled, localDate } from '@mirhal/domain';
import { Database } from '../common/database';
export const challengeInclude = {
  rules: true,
  metric: true,
  participants: {
    include: {
      eligibleHabits: true,
      user: {
        select: { profile: { select: { displayName: true, avatarUrl: true, timezone: true } } },
      },
    },
  },
  scores: true,
} as const;
export type ChallengeRecord = Prisma.ChallengeGetPayload<{ include: typeof challengeInclude }>;
@Injectable()
export class ChallengeScoringService {
  private readonly engine = new ScoringEngine();
  constructor(@Inject(Database) private readonly db: Database) {}
  async calculate(tx: Prisma.TransactionClient, challenge: ChallengeRecord, final = false) {
    if (!challenge.rules) throw new Error('Challenge has no rules');
    if (![1, 2].includes(challenge.algorithmVersion))
      throw new Error('Unsupported challenge algorithm version');
    const until = new Date(Math.min(Date.now(), challenge.endDate.getTime() - 1));
    for (const participant of challenge.participants.filter((item) => item.status === 'ACCEPTED')) {
      const timezone = participant.timezoneSnapshot ?? 'UTC';
      const startDay = dateOnly(localDate(challenge.startDate, timezone));
      const endDay = dateOnly(localDate(until, timezone));
      let expectedDays = 0;
      for (let day = startDay; day <= endDay; day = addDays(day, 1)) {
        if (participant.eligibleHabits.some((habit) => isScheduled(habit, day))) expectedDays++;
      }
      expectedDays = Math.max(1, expectedDays);
      const logs = await tx.habitLog.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        where: {
          userId: participant.userId,
          createdAt: { gte: challenge.startDate, lte: until },
          habitId: { in: participant.eligibleHabits.map((habit) => habit.habitId) },
        },
        select: {
          date: true,
          createdAt: true,
          value: true,
          habitId: true,
          minimum: true,
          targetSnapshot: true,
        },
      });
      const ledger =
        challenge.algorithmVersion === 1
          ? await tx.xPTransaction.findMany({
              where: {
                userId: participant.userId,
                type: 'HABIT',
                direction: 'CREDIT',
                createdAt: { gte: challenge.startDate, lte: until },
              },
              select: { source: true, amount: true, idempotencyKey: true },
            })
          : [];
      // Group by the frozen timezone, and count at most one observation per habit/day.
      // Changing live schedules or timezone cannot add evidence to this challenge.
      const seen = new Set<string>();
      const eligibleLogs = logs.filter((log) => {
        const day = localDate(log.createdAt, timezone);
        const snapshot = participant.eligibleHabits.find((habit) => habit.habitId === log.habitId);
        const key = `${log.habitId}:${day}`;
        if (!snapshot || !isScheduled(snapshot, dateOnly(day)) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const evidence = eligibleLogs.map((log) => {
        const snapshot = participant.eligibleHabits.find((habit) => habit.habitId === log.habitId)!;
        return {
          date: localDate(log.createdAt, timezone),
          value:
            challenge.mode === 'IMPROVEMENT' ||
            challenge.mode === 'TARGET' ||
            challenge.mode === 'COOPERATIVE'
              ? log.value
              : 1,
          xp:
            challenge.algorithmVersion === 2
              ? log.minimum
                ? Math.ceil(snapshot.xpReward / 2)
                : snapshot.xpReward
              : Math.min(
                  snapshot.xpReward,
                  ledger.find(
                    (entry) =>
                      entry.source === log.habitId &&
                      entry.idempotencyKey.endsWith(log.date.toISOString().slice(0, 10)),
                  )?.amount ?? 0,
                ),
        };
      });
      const input = {
        evidence,
        expectedDays,
        baseline: participant.baseline,
        target: challenge.rules.target,
        dailyCap: challenge.rules.dailyCap,
        lowerIsBetter: challenge.rules.lowerIsBetter,
      };
      const result = this.engine.calculate(challenge.mode, input);
      const evidenceHash = createHash('sha256')
        .update(JSON.stringify({ version: challenge.algorithmVersion, input }))
        .digest('hex');
      const data = {
        ...result,
        evidenceHash,
        algorithmVersion: challenge.algorithmVersion,
        final,
        calculatedAt: new Date(),
      };
      await tx.challengeScore.upsert({
        where: {
          challengeId_participantId: { challengeId: challenge.id, participantId: participant.id },
        },
        create: { challengeId: challenge.id, participantId: participant.id, ...data },
        update: data,
      });
    }
  }
  serialize(challenge: ChallengeRecord, viewerId: string, hiddenUsers = new Set<string>()) {
    const { participants, scores, ...base } = challenge;
    return {
      ...base,
      cooperativeProgress:
        challenge.mode === 'COOPERATIVE' &&
        participants.every(
          (participant) =>
            participant.userId === viewerId ||
            (participant.shareProgress && !hiddenUsers.has(participant.userId)),
        )
          ? Math.min(
              100,
              scores.reduce((sum, score) => sum + score.progress, 0),
            )
          : null,
      participants: participants.map((participant) => {
        const own = participant.userId === viewerId;
        const hidden = hiddenUsers.has(participant.userId);
        const score = scores.find((score) => score.participantId === participant.id);
        return {
          id: participant.id,
          userId: participant.userId,
          displayName: hidden
            ? 'Private explorer'
            : (participant.user.profile?.displayName ?? 'Explorer'),
          avatarUrl: hidden ? null : participant.user.profile?.avatarUrl,
          status: participant.status,
          own,
          ...(own ? { habitId: participant.habitId, baseline: participant.baseline } : {}),
          score: own || (!hidden && participant.shareScore) ? (score?.score ?? 0) : null,
          progress: own || (!hidden && participant.shareProgress) ? (score?.progress ?? 0) : null,
          streak: own || (!hidden && participant.shareStreak) ? (score?.streak ?? 0) : null,
        };
      }),
    };
  }
}
