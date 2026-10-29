import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { FriendsService } from './friends.service';
import { ChallengesService } from './challenges.service';
import { ChallengeLifecycleService } from './challenge-lifecycle.service';
import { ChallengeScoringService } from './challenge-scoring.service';
import { DatabaseModule } from '../common/database';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [DatabaseModule, GamificationModule],
  controllers: [SocialController],
  providers: [
    FriendsService,
    ChallengesService,
    ChallengeLifecycleService,
    ChallengeScoringService,
  ],
  exports: [FriendsService, ChallengesService, ChallengeLifecycleService, ChallengeScoringService],
})
export class SocialModule {}
