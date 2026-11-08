import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  experimentSchema,
  habitLogSchema,
  habitSchema,
  habitUpdateSchema,
  InputOf,
  paginationSchema,
} from '@mirhal/contracts';
import { CurrentUser, Identity, Validate } from '../common/http';
import { HabitsService } from './habits.service';
@ApiTags('Habits and Habit Lab')
@Controller('habits')
export class HabitsController {
  constructor(@Inject(HabitsService) private readonly service: HabitsService) {}
  @Get() list(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.service.list(user, query);
  }
  @Post() create(
    @CurrentUser() user: Identity,
    @Body(new Validate(habitSchema)) input: InputOf<typeof habitSchema>,
  ) {
    return this.service.create(user, input);
  }
  @Patch(':id') update(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(habitUpdateSchema)) input: InputOf<typeof habitUpdateSchema>,
  ) {
    return this.service.update(user, id, input);
  }
  @Post(':id/complete') complete(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(habitLogSchema)) input: InputOf<typeof habitLogSchema>,
  ) {
    return this.service.complete(user, id, input);
  }
  @Post(':id/experiments') experiment(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(experimentSchema)) input: InputOf<typeof experimentSchema>,
  ) {
    return this.service.experiment(user, id, input);
  }
}
