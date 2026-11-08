import { notify } from '../common/notifications';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InputOf,
  challengeSchema,
  challengeAcceptSchema,
  paginationSchema,
} from '@mirhal/contracts';
import { Database } from '../common/database';
import { ChallengeLifecycleService } from './challenge-lifecycle.service';
import { assertReferences, pageArgs, pageResult } from '../core/ownership';
import { challengeInclude, ChallengeScoringService } from './challenge-scoring.service';
@Injectable()
export class ChallengesService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(ChallengeLifecycleService) private readonly lifecycle: ChallengeLifecycleService,
    @Inject(ChallengeScoringService) private readonly scoring: ChallengeScoringService,
  ) {}
  async list(userId: string, query: InputOf<typeof paginationSchema>) {
    const where = { participants: { some: { userId } } };
    if (process.env['VERCEL'] === '1') {
      const due = await this.db.challenge.findMany({
        where: {
          ...where,
          status: { in: ['SCHEDULED', 'ACCEPTED', 'ACTIVE'] },
          startDate: { lte: new Date() },
        },
        select: { id: true },
        orderBy: { endDate: 'asc' },
        take: 10,
      });
      for (const challenge of due) await this.lifecycle.advance(challenge.id);
    }
    const [challenges, total] = await Promise.all([
      this.db.challenge.findMany({
        where: { participants: { some: { userId } } },
        include: challengeInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.challenge.count({ where }),
    ]);
    const blocked = await this.db.friendship.findMany({
      where: { status: 'BLOCKED', OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { senderId: true, receiverId: true },
    });
    const hidden = new Set(
      blocked.map((item) => (item.senderId === userId ? item.receiverId : item.senderId)),
    );
    return pageResult(
      challenges.map((challenge) => this.scoring.serialize(challenge, userId, hidden)),
      total,
      query.page,
      query.limit,
    );
  }
  async create(userId: string, input: InputOf<typeof challengeSchema>) {
    const start = new Date(input.startDate),
      end = new Date(input.endDate);
    if (
      start.getTime() < Date.now() - 60_000 ||
      end <= start ||
      end.getTime() - start.getTime() > 90 * 86_400_000
    )
      throw new BadRequestException('Choose a future challenge lasting up to 90 days.');
    if (
      new Set(input.friendIds).size !== input.friendIds.length ||
      input.friendIds.includes(userId)
    )
      throw new BadRequestException('Choose distinct friends.');
    if ((input.scope === 'HABIT' || input.mode === 'IMPROVEMENT') && !input.habitId)
      throw new BadRequestException('Choose a habit for this challenge.');
    if (input.scope === 'AREA' && !input.areaId)
      throw new BadRequestException('Choose a life area.');
    const friends = await this.db.friendship.count({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: userId, receiverId: { in: input.friendIds } },
          { receiverId: userId, senderId: { in: input.friendIds } },
        ],
      },
    });
    if (friends !== input.friendIds.length)
      throw new ForbiddenException('Challenges can only include accepted friends.');
    return this.db.atomic(userId, async (tx) => {
      await assertReferences(tx, userId, {
        habitId: input.habitId,
        areaId: input.areaId ?? undefined,
      });
      const profile = await tx.profile.findUniqueOrThrow({ where: { userId } });
      const challenge = await tx.challenge.create({
        data: {
          ownerId: userId,
          title: input.title,
          description: input.description,
          scope: input.scope,
          mode: input.mode,
          areaId: input.areaId,
          startDate: start,
          endDate: end,
          visibility: input.visibility,
          status: 'INVITED',
          algorithmVersion: 2,
          rules: {
            create: {
              target: input.target,
              lowerIsBetter: input.lowerIsBetter,
              dailyCap: input.dailyCap,
            },
          },
          metric: { create: { name: input.mode === 'SCORE' ? 'Habit points' : 'Habit progress' } },
          participants: {
            create: [
              {
                userId,
                status: 'ACCEPTED',
                acceptedAt: new Date(),
                habitId: input.habitId,
                shareScore: profile.shareChallengeScore,
                shareStreak: profile.shareStreak,
              },
              ...input.friendIds.map((friendId) => ({
                userId: friendId,
                status: 'INVITED' as const,
              })),
            ],
          },
        },
      });
      await notify(tx, {
        data: input.friendIds.map((friendId) => ({
          userId: friendId,
          type: 'CHALLENGE_INVITE',
          title: 'Grow together',
          body: `You are invited to ${input.title}.`,
          arabic: { title: 'نتطور معاً', body: `أنت مدعو للمشاركة في ${input.title}.` },
          href: '/challenges',
        })),
      });
      await tx.analyticsEvent.create({ data: { userId, name: 'challenge_created' } });
      return challenge;
    });
  }
  async accept(userId: string, id: string, input: InputOf<typeof challengeAcceptSchema>) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Challenge" WHERE id = ${id} FOR UPDATE`;
      await this.db.lockActive(tx, userId);
      const challenge = await tx.challenge.findUnique({ where: { id }, include: challengeInclude });
      const participant = challenge?.participants.find((item) => item.userId === userId);
      if (!challenge || !participant) throw new NotFoundException();
      if (participant.status === 'ACCEPTED') return;
      if (
        !['INVITED', 'ACCEPTED', 'SCHEDULED'].includes(challenge.status) ||
        challenge.endDate < new Date()
      )
        throw new BadRequestException('This invitation is no longer active.');
      if ((challenge.scope === 'HABIT' || challenge.mode === 'IMPROVEMENT') && !input.habitId)
        throw new BadRequestException('Choose the habit you want to bring to this challenge.');
      const friendship = await tx.friendship.findUnique({
        where: { pairKey: [userId, challenge.ownerId].sort().join(':') },
      });
      if (friendship?.status !== 'ACCEPTED')
        throw new ForbiddenException('This connection is no longer available.');
      await assertReferences(tx, userId, input);
      await tx.challengeParticipant.update({
        where: { id: participant.id },
        data: { ...input, status: 'ACCEPTED', acceptedAt: new Date() },
      });
      const pending = await tx.challengeParticipant.count({
        where: { challengeId: id, status: 'INVITED' },
      });
      if (!pending)
        await tx.challenge.update({
          where: { id },
          data: { status: challenge.startDate > new Date() ? 'SCHEDULED' : 'ACCEPTED' },
        });
      await tx.analyticsEvent.create({ data: { userId, name: 'challenge_joined' } });
    });
    await this.advance(id);
    return { success: true };
  }
  async action(userId: string, id: string, action: 'cancel' | 'decline' | 'refresh') {
    if (action === 'refresh') {
      if (
        !(await this.db.challengeParticipant.findUnique({
          where: { challengeId_userId: { challengeId: id, userId } },
        }))
      )
        throw new NotFoundException();
      await this.advance(id);
      return { success: true };
    }
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Challenge" WHERE id = ${id} FOR UPDATE`;
      await this.db.lockActive(tx, userId);
      const challenge = await tx.challenge.findFirst({
        where: { id, participants: { some: { userId } } },
        include: { participants: true },
      });
      if (!challenge) throw new NotFoundException();
      if (['COMPLETED', 'CANCELLED'].includes(challenge.status))
        throw new BadRequestException('This challenge has ended.');
      if (action === 'cancel' && challenge.ownerId !== userId) throw new ForbiddenException();
      if (
        action === 'decline' &&
        challenge.participants.find((item) => item.userId === userId)?.status !== 'INVITED'
      )
        throw new BadRequestException('Only pending invitations can be declined.');
      if (action === 'decline')
        await tx.challengeParticipant.update({
          where: { challengeId_userId: { challengeId: id, userId } },
          data: { status: 'DECLINED' },
        });
      await tx.challenge.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({
        data: { actorId: userId, action: 'CHALLENGE_CANCELLED', entity: 'Challenge', entityId: id },
      });
    });
    return { success: true };
  }
  advance(id: string) {
    return this.lifecycle.advance(id);
  }
  tick() {
    return this.lifecycle.tick();
  }
}
