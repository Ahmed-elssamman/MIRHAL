import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { XpService } from './xp.service';
import { RewardsService } from './rewards.service';
import { RewardPreferencesService } from './reward-preferences.service';
import { RewardRecommendationsService } from './reward-recommendations.service';
import { DatabaseModule } from '../common/database';

@Module({
  imports: [DatabaseModule],
  controllers: [GamificationController],
  providers: [XpService, RewardsService, RewardPreferencesService, RewardRecommendationsService],
  exports: [XpService, RewardsService, RewardPreferencesService, RewardRecommendationsService],
})
export class GamificationModule {}
