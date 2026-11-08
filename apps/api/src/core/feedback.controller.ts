import { attachmentSelect } from './attachment-storage';
import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { feedbackSchema, InputOf, paginationSchema } from '@mirhal/contracts';
import { pageArgs, pageResult } from './ownership';
import { Database } from '../common/database';
import { CurrentUser, Identity, Public, Validate } from '../common/http';
@ApiTags('Feedback, notifications and help')
@Controller()
export class FeedbackController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get('feedback') async list(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = { userId: user.id };
    const [items, total] = await Promise.all([
      this.db.feedback.findMany({
        where: { userId: user.id },
        include: {
          attachments: { select: attachmentSelect },
          replies: { where: { internal: false }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.feedback.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Post('feedback') create(
    @CurrentUser() user: Identity,
    @Body(new Validate(feedbackSchema)) input: InputOf<typeof feedbackSchema>,
  ) {
    return this.db.atomic(user.id, async (tx) => {
      const feedback = await tx.feedback.create({ data: { ...input, userId: user.id } });
      await tx.analyticsEvent.create({
        data: {
          userId: user.id,
          name: 'feedback_submitted',
          metadata: { category: input.category },
        },
      });
      return feedback;
    });
  }
  @Get('notifications') async notifications(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = { userId: user.id };
    const [items, total] = await Promise.all([
      this.db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.notification.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Patch('notifications/:id/read') async read(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
  ) {
    await this.db.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
  @Post('notifications/read-all') async readAll(@CurrentUser() user: Identity) {
    await this.db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
  @Public() @Get('public-settings') publicSettings() {
    return this.db.systemSetting.findMany({
      where: { key: { in: ['maintenance_message', 'registration_notice', 'support_email'] } },
      select: { key: true, value: true },
    });
  }
  @Public() @Get('help') help() {
    return this.db.helpArticle.findMany({
      where: { published: true },
      orderBy: { title: 'asc' },
      take: 100,
    });
  }
  @Get('announcements') announcements() {
    return this.db.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }
}
