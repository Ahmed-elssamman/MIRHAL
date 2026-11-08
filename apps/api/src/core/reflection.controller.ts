import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { checkInSchema, InputOf, questSchema, paginationSchema } from '@mirhal/contracts';
import { dateOnly, localDate } from '@mirhal/domain';
import { CurrentUser, Identity, Validate } from '../common/http';
import { Database } from '../common/database';
import { XpService } from '../gamification/xp.service';
import { QuestsService } from './quests.service';
@ApiTags('Check-ins and quests')
@Controller()
export class ReflectionController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
    @Inject(QuestsService) private readonly quests: QuestsService,
  ) {}
  @Get('check-ins') checkIns(@CurrentUser() user: Identity) {
    return this.db.dailyCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 31,
    });
  }
  @Post('check-ins') checkIn(
    @CurrentUser() user: Identity,
    @Body(new Validate(checkInSchema)) input: InputOf<typeof checkInSchema>,
  ) {
    const date = dateOnly(localDate(new Date(), user.timezone));
    return this.db.atomic(user.id, async (tx) => {
      const checkIn = await tx.dailyCheckIn.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: { ...input, userId: user.id, date },
        update: input,
      });
      const { awarded, levelUp } = await this.xp.award(
        tx,
        user.id,
        'CHECK_IN',
        checkIn.id,
        15,
        `checkin:${user.id}:${date.toISOString()}`,
      );
      const unlocks = await this.xp.evaluateAchievements(tx, user.id);
      if (awarded)
        await tx.analyticsEvent.create({
          data: { userId: user.id, name: 'daily_checkin_completed' },
        });
      return {
        ...checkIn,
        awarded,
        achievements: unlocks.achievements,
        levelUp: unlocks.levelUp ?? levelUp,
      };
    });
  }
  @Get('quests') listQuests(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.quests.list(user.id, query);
  }
  @Post('quests') createQuest(
    @CurrentUser() user: Identity,
    @Body(new Validate(questSchema)) input: InputOf<typeof questSchema>,
  ) {
    return this.quests.create(user.id, input);
  }
  @Post('quests/:id/items/:itemId/complete') completeQuest(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.quests.completeItem(user.id, id, itemId);
  }
}
