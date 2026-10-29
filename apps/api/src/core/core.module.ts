import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';
import { ReflectionController } from './reflection.controller';
import { QuestsService } from './quests.service';
import { AccountController } from './account.controller';
import { FeedbackController } from './feedback.controller';
import { AttachmentsController } from './attachments.controller';
import { AttachmentStorage } from './attachment-storage';
import { AttachmentCleanup } from './attachment-cleanup';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from '../common/database';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [DatabaseModule, GamificationModule],
  controllers: [
    PlanningController,
    HabitsController,
    ReflectionController,
    AccountController,
    FeedbackController,
    AttachmentsController,
  ],
  providers: [
    PlanningService,
    HabitsService,
    QuestsService,
    DashboardService,
    AttachmentStorage,
    AttachmentCleanup,
  ],
  exports: [
    PlanningService,
    HabitsService,
    QuestsService,
    DashboardService,
    AttachmentStorage,
    AttachmentCleanup,
  ],
})
export class CoreModule {}
