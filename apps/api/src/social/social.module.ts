import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { FriendsService } from './friends.service';
import { ChallengesService } from './challenges.service';
import { ChallengeLifecycleService } from './challenge-lifecycle.service';
import { ChallengeScoringService } from './challenge-scoring.service';
import { DatabaseModule } from '../common/database';
import { GamificationModule } from '../gamification/gamification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, GamificationModule, AuthModule],
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
