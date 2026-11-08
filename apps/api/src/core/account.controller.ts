import { AttachmentCleanup } from './attachment-cleanup';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Res,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { InputOf, onboardingSchema, profileSchema, journeyQuerySchema } from '@mirhal/contracts';
import { Database } from '../common/database';
import { CurrentUser, Identity, Public, Validate } from '../common/http';
import { erasePersonalContent } from './account-erasure';
import { DashboardService } from './dashboard.service';
@ApiTags('Account and journey')
@Controller()
export class AccountController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(AttachmentCleanup) private readonly cleanup: AttachmentCleanup,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}
  @Public() @Get('life-areas') areas() {
    return this.db.lifeArea.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }
  @Get('dashboard') summary(@CurrentUser() user: Identity) {
    return this.dashboard.summary(user);
  }
  @Get('analytics') analytics(@CurrentUser() user: Identity) {
    return this.dashboard.summary(user);
  }
  @Patch('profile') profile(
    @CurrentUser() user: Identity,
    @Body(new Validate(profileSchema)) input: InputOf<typeof profileSchema>,
  ) {
    return this.db.atomic(user.id, (tx) =>
      tx.profile.update({ where: { userId: user.id }, data: input }),
    );
  }
  @Post('onboarding') onboarding(
    @CurrentUser() user: Identity,
    @Body(new Validate(onboardingSchema)) input: InputOf<typeof onboardingSchema>,
  ) {
    return this.db.atomic(user.id, async (tx) => {
      const profile = await tx.profile.findUniqueOrThrow({ where: { userId: user.id } });
      if (profile.onboardingCompletedAt) return profile;
      const areas = await tx.lifeArea.findMany({
        where: { id: { in: input.areaIds }, active: true },
      });
      if (areas.length !== new Set(input.areaIds).size)
        throw new BadRequestException('Choose valid life areas.');
      await tx.userLifeArea.createMany({
        data: [...new Set(input.areaIds)].map((areaId) => ({ areaId, userId: user.id })),
        skipDuplicates: true,
      });
      const areaId = areas[0]!.id;
      const goal = input.goal
        ? await tx.goal.create({ data: { userId: user.id, areaId, title: input.goal } })
        : null;
      if (input.habit)
        await tx.habit.create({
          data: {
            userId: user.id,
            areaId,
            goalId: goal?.id,
            name: input.habit,
            minimumAction: 'Just two minutes',
            scheduleDays: [],
            preferredTime: input.preferredRoutine,
          },
        });
      await tx.analyticsEvent.create({ data: { userId: user.id, name: 'onboarding_completed' } });
      return tx.profile.update({
        where: { userId: user.id },
        data: {
          onboardingCompletedAt: new Date(),
          preferredRoutine: input.preferredRoutine,
          profileVisibility: input.profileVisibility,
        },
      });
    });
  }
  @Get('journey') async journey(
    @CurrentUser() user: Identity,
    @Query(new Validate(journeyQuerySchema)) query: InputOf<typeof journeyQuerySchema>,
  ) {
    const [seasons, reflections, summary] = await Promise.all([
      this.db.season.findMany({
        include: { phases: { orderBy: [{ year: 'asc' }, { month: 'asc' }] } },
        orderBy: { year: 'desc' },
        take: 10,
      }),
      this.db.monthJourney.findMany({
        where: { userId: user.id },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 24,
      }),
      this.dashboard.summary(user, 'month', query.month),
    ]);
    return { seasons, reflections, summary };
  }
  @Post('journey/reflection') async reflection(
    @CurrentUser() user: Identity,
    @Body(
      new Validate(
        z
          .object({
            year: z.number().int().min(2020).max(2200),
            month: z.number().int().min(1).max(12),
            biggestWin: z.string().max(4000),
            failureReason: z.string().max(4000),
            adjustment: z.string().max(4000),
            reward: z.string().max(4000),
          })
          .strict(),
      ),
    )
    input: {
      year: number;
      month: number;
      biggestWin: string;
      failureReason: string;
      adjustment: string;
      reward: string;
    },
  ) {
    const phase = await this.db.seasonPhase.findFirst({
      where: { year: input.year, month: input.month },
      orderBy: { season: { startDate: 'desc' } },
    });
    return this.db.atomic(user.id, async (tx) => {
      if (phase)
        await tx.userProgress.upsert({
          where: { userId_seasonId: { userId: user.id, seasonId: phase.seasonId } },
          create: { userId: user.id, seasonId: phase.seasonId, reflection: input.adjustment },
          update: { reflection: input.adjustment },
        });
      return tx.monthJourney.upsert({
        where: { userId_year_month: { userId: user.id, year: input.year, month: input.month } },
        create: { ...input, userId: user.id, phaseId: phase?.id },
        update: { ...input, phaseId: phase?.id },
      });
    });
  }
  @Get('account/sessions') sessions(@CurrentUser() user: Identity) {
    return this.db.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post('account/export') async export(@CurrentUser() user: Identity) {
    const userId = user.id;
    const [
      profile,
      goals,
      projects,
      tasks,
      habits,
      checkIns,
      quests,
      xp,
      rewards,
      redemptions,
      feedback,
    ] = await Promise.all([
      this.db.profile.findUnique({ where: { userId } }),
      this.db.goal.findMany({ where: { userId } }),
      this.db.project.findMany({ where: { userId } }),
      this.db.task.findMany({ where: { userId } }),
      this.db.habit.findMany({ where: { userId }, include: { logs: true, experiments: true } }),
      this.db.dailyCheckIn.findMany({ where: { userId } }),
      this.db.weeklyQuest.findMany({ where: { userId }, include: { items: true } }),
      this.db.xPTransaction.findMany({ where: { userId } }),
      this.db.reward.findMany({ where: { userId } }),
      this.db.rewardRedemption.findMany({ where: { userId } }),
      this.db.feedback.findMany({
        where: { userId },
        include: { replies: { where: { internal: false } } },
      }),
    ]);
    await this.db.auditLog.create({
      data: { actorId: userId, action: 'DATA_EXPORTED', entity: 'User', entityId: userId },
    });
    return {
      exportedAt: new Date(),
      profile,
      goals,
      projects,
      tasks,
      habits,
      checkIns,
      quests,
      xp,
      rewards,
      redemptions,
      feedback,
    };
  }
  @Post('account/delete') async delete(
    @CurrentUser() user: Identity,
    @Body(
      new Validate(
        z.object({ password: z.string().max(128), confirmation: z.literal('DELETE') }).strict(),
      ),
    )
    input: { password: string; confirmation: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const account = await this.db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await argon2.verify(account.passwordHash, input.password)))
      throw new BadRequestException('Your password is incorrect.');
    const files = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT c.id FROM "Challenge" c JOIN "ChallengeParticipant" p ON p."challengeId" = c.id WHERE p."userId" = ${user.id} ORDER BY c.id FOR UPDATE OF c`;
      await this.db.lockActive(tx, user.id);
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (current.passwordHash !== account.passwordHash)
        throw new BadRequestException('Your password changed. Please sign in again.');
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.authToken.deleteMany({ where: { userId: user.id } });
      await tx.challenge.updateMany({
        where: {
          participants: { some: { userId: user.id } },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        data: { status: 'CANCELLED' },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          email: `deleted-${user.id}@invalid.local`,
          passwordHash: 'deleted',
        },
      });
      const files = await erasePersonalContent(tx, user.id);
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'ACCOUNT_DELETED', entity: 'User', entityId: user.id },
      });
      return files;
    });
    await this.cleanup.drain(files);
    response.clearCookie('lq_session', { path: '/api' });
    return { success: true };
  }
}
