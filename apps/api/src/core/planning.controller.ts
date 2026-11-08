import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  goalSchema,
  goalUpdateSchema,
  InputOf,
  paginationSchema,
  projectSchema,
  projectUpdateSchema,
  taskSchema,
  taskUpdateSchema,
} from '@mirhal/contracts';
import { CurrentUser, Identity, Validate } from '../common/http';
import { milestoneSchema, PlanningService } from './planning.service';
@ApiTags('Goals, projects and tasks')
@Controller()
export class PlanningController {
  constructor(@Inject(PlanningService) private readonly service: PlanningService) {}
  @Get('goals') goals(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.service.goals(user.id, query);
  }
  @Post('goals') createGoal(
    @CurrentUser() user: Identity,
    @Body(new Validate(goalSchema)) input: InputOf<typeof goalSchema>,
  ) {
    return this.service.createGoal(user.id, input);
  }
  @Patch('goals/:id') updateGoal(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(goalUpdateSchema)) input: InputOf<typeof goalUpdateSchema>,
  ) {
    return this.service.updateGoal(user.id, id, input);
  }
  @Get('projects') projects(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.service.projects(user.id, query);
  }
  @Post('projects') createProject(
    @CurrentUser() user: Identity,
    @Body(new Validate(projectSchema)) input: InputOf<typeof projectSchema>,
  ) {
    return this.service.createProject(user.id, input);
  }
  @Patch('projects/:id') updateProject(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(projectUpdateSchema)) input: InputOf<typeof projectUpdateSchema>,
  ) {
    return this.service.updateProject(user.id, id, input);
  }
  @Get('tasks') tasks(
    @CurrentUser() user: Identity,
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    return this.service.tasks(user.id, query, user.timezone);
  }
  @Post('tasks') createTask(
    @CurrentUser() user: Identity,
    @Body(new Validate(taskSchema)) input: InputOf<typeof taskSchema>,
  ) {
    return this.service.createTask(user.id, input);
  }
  @Patch('tasks/:id') updateTask(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(taskUpdateSchema)) input: InputOf<typeof taskUpdateSchema>,
  ) {
    return this.service.updateTask(user.id, id, input);
  }
  @Post('milestones') milestone(
    @CurrentUser() user: Identity,
    @Body(new Validate(milestoneSchema)) input: InputOf<typeof milestoneSchema>,
  ) {
    return this.service.milestone(user.id, input);
  }
  @Patch('milestones/:id') toggleMilestone(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @Body(new Validate(z.object({ completed: z.boolean() }).strict()))
    input: { completed: boolean },
  ) {
    return this.service.toggleMilestone(user.id, id, input.completed);
  }
}
