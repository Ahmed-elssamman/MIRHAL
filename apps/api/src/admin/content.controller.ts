import { Body, Controller, Inject, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { InputOf, patchSchema, rewardSchema, rewardUpdateSchema } from '@mirhal/contracts';
import { Database } from '../common/database';
import { CurrentUser, Identity, Roles, Validate } from '../common/http';
const articleSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    title: z.string().min(2).max(160),
    titleAr: z.string().min(2).max(160),
    body: z.string().min(10).max(20000),
    bodyAr: z.string().min(10).max(20000),
    published: z.boolean().default(true),
  })
  .strict();
const achievementSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    title: z.string().min(2).max(160),
    titleAr: z.string().min(2).max(160),
    description: z.string().max(4000),
    descriptionAr: z.string().max(4000).default(''),
    icon: z.string().max(40),
    condition: z.enum([
      'HABIT_COUNT',
      'CHECK_IN_COUNT',
      'QUEST_COUNT',
      'CHALLENGE_COUNT',
      'STREAK_DAYS',
    ]),
    threshold: z.number().int().min(1).max(10000),
    xpReward: z.number().int().min(1).max(1000),
    hidden: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .strict();
const announcementSchema = z
  .object({
    title: z.string().min(2).max(160),
    titleAr: z.string().max(160).default(''),
    body: z.string().min(2).max(4000),
    bodyAr: z.string().max(4000).default(''),
    active: z.boolean().default(true),
  })
  .strict();
@Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')
@Controller('admin')
export class ContentController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Post('rewards') reward(
    @CurrentUser() user: Identity,
    @Body(new Validate(rewardSchema)) input: InputOf<typeof rewardSchema>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.reward.create({ data: input });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'REWARD_CREATED', entity: 'Reward', entityId: item.id },
      });
      return item;
    });
  }
  @Patch('rewards/:id') updateReward(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(rewardUpdateSchema))
    input: InputOf<typeof rewardUpdateSchema>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.reward.update({ where: { id, userId: null }, data: input });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'REWARD_UPDATED', entity: 'Reward', entityId: id },
      });
      return item;
    });
  }
  @Post('achievements') achievement(
    @CurrentUser() user: Identity,
    @Body(new Validate(achievementSchema)) input: InputOf<typeof achievementSchema>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.achievement.create({ data: input });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ACHIEVEMENT_CREATED',
          entity: 'Achievement',
          entityId: item.id,
        },
      });
      return item;
    });
  }
  @Patch('achievements/:id') updateAchievement(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(patchSchema(achievementSchema)))
    input: Partial<InputOf<typeof achievementSchema>>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.achievement.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ACHIEVEMENT_UPDATED',
          entity: 'Achievement',
          entityId: id,
        },
      });
      return item;
    });
  }
  @Post('help') article(
    @CurrentUser() user: Identity,
    @Body(new Validate(articleSchema)) input: InputOf<typeof articleSchema>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.helpArticle.create({ data: input });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'HELP_CREATED',
          entity: 'HelpArticle',
          entityId: item.id,
        },
      });
      return item;
    });
  }
  @Patch('help/:id') updateArticle(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(patchSchema(articleSchema))) input: Partial<InputOf<typeof articleSchema>>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.helpArticle.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'HELP_UPDATED', entity: 'HelpArticle', entityId: id },
      });
      return item;
    });
  }
  @Post('announcements') announcement(
    @CurrentUser() user: Identity,
    @Body(new Validate(announcementSchema)) input: InputOf<typeof announcementSchema>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.announcement.create({ data: input });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ANNOUNCEMENT_CREATED',
          entity: 'Announcement',
          entityId: item.id,
        },
      });
      return item;
    });
  }
  @Patch('announcements/:id') updateAnnouncement(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(patchSchema(announcementSchema)))
    input: Partial<InputOf<typeof announcementSchema>>,
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'], async (tx) => {
      const item = await tx.announcement.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ANNOUNCEMENT_UPDATED',
          entity: 'Announcement',
          entityId: id,
        },
      });
      return item;
    });
  }
  @Roles('SUPER_ADMIN', 'ADMIN') @Patch('settings/:key') setting(
    @CurrentUser() user: Identity,
    @Param(
      'key',
      new Validate(z.enum(['maintenance_message', 'support_email', 'registration_notice'])),
    )
    key: string,
    @Body(new Validate(z.object({ value: z.string().max(1000) }).strict()))
    input: { value: string },
  ) {
    return this.db.staffAtomic(user.id, ['SUPER_ADMIN', 'ADMIN'], async (tx) => {
      const item = await tx.systemSetting.upsert({
        where: { key },
        create: { key, value: input.value, description: key.replaceAll('_', ' ') },
        update: { value: input.value },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SETTING_UPDATED',
          entity: 'SystemSetting',
          entityId: key,
        },
      });
      return item;
    });
  }
}
