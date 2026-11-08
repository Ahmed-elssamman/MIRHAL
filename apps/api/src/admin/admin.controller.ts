import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChallengeStatus, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { feedbackAdminSchema, InputOf, paginationSchema } from '@mirhal/contracts';
import { CurrentUser, Identity, Roles, Validate } from '../common/http';
import { Database } from '../common/database';
import { MailAdapter } from '../auth/mail.adapter';
import { AdminService } from './admin.service';
import { pageArgs, pageResult } from '../core/ownership';
const allStaff: Role[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
  'SUPPORT',
  'CONTENT_MANAGER',
  'ANALYST',
];
const challengeListSchema = paginationSchema.extend({
  status: z.enum(ChallengeStatus).optional(),
});
@ApiTags('Administration')
@Roles(...allStaff)
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly service: AdminService,
    @Inject(Database) private readonly db: Database,
    @Inject(MailAdapter) private readonly mail: MailAdapter,
  ) {}
  @Get('overview') overview() {
    return this.service.overview();
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT') @Get('users') users(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.service.users(query);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT') @Get('users/:id') user(@Param('id') id: string) {
    return this.service.user(id);
  }
  @Roles('SUPER_ADMIN', 'ADMIN') @Patch('users/:id') updateUser(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(
      new Validate(
        z
          .object({
            status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
            role: z
              .enum([
                'USER',
                'SUPER_ADMIN',
                'ADMIN',
                'MODERATOR',
                'SUPPORT',
                'CONTENT_MANAGER',
                'ANALYST',
              ])
              .optional(),
          })
          .strict(),
      ),
    )
    input: { status?: 'ACTIVE' | 'SUSPENDED'; role?: Role },
  ) {
    return this.service.updateUser(user, id, input);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR') @Get('feedback') feedback(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.service.feedback(query);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR') @Patch('feedback/:id') updateFeedback(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(feedbackAdminSchema)) input: InputOf<typeof feedbackAdminSchema>,
  ) {
    return this.service.updateFeedback(user, id, input);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST') @Get('challenges') async challenges(
    @Query(new Validate(challengeListSchema)) query: InputOf<typeof challengeListSchema>,
  ) {
    const where: Prisma.ChallengeWhereInput = {
      status: query.status,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.challenge.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          mode: true,
          startDate: true,
          endDate: true,
          _count: { select: { participants: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query.page, query.limit),
      }),
      this.db.challenge.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'MODERATOR') @Post('challenges/:id/cancel') async moderate(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(z.object({ reason: z.string().min(10).max(1000) }).strict()))
    input: { reason: string },
  ) {
    return this.service.moderateChallenge(user, id, input.reason);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'ANALYST') @Get('audit-logs') async audits(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.auditLog.count(),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Get('health') async health() {
    await this.db.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      database: 'connected',
      email: this.mail.configurationHealth(),
      version: '0.1.0',
      environment: process.env['NODE_ENV'] ?? 'development',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date(),
    };
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Get('rewards') async rewards(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = { userId: null };
    const [items, total] = await Promise.all([
      this.db.reward.findMany({
        where,
        orderBy: { cost: 'asc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.reward.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Get('achievements') async achievements(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = {};
    const [items, total] = await Promise.all([
      this.db.achievement.findMany({
        where,
        orderBy: { threshold: 'asc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.achievement.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Get('help') async help(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = {};
    const [items, total] = await Promise.all([
      this.db.helpArticle.findMany({
        where,
        orderBy: { title: 'asc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.helpArticle.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Get('announcements') async announcements(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = {};
    const [items, total] = await Promise.all([
      this.db.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.announcement.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Roles('SUPER_ADMIN', 'ADMIN') @Get('settings') settings() {
    return this.db.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }
}
