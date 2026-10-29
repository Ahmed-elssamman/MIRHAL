import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ContentController } from './content.controller';
import { InsightsController } from './insights.controller';
import { QuestTemplatesController } from './quest-templates.controller';
import { DatabaseModule } from '../common/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController, ContentController, InsightsController, QuestTemplatesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
