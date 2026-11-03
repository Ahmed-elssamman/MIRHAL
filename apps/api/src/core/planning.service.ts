import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
} from '@lifequest/contracts';
import { dateOnly, goalProgress, localDate, projectProgress } from '@lifequest/domain';
import { Database } from '../common/database';
import { assertDateOrder, assertReferences, dates, pageArgs, pageResult } from './ownership';
import { XpService } from '../gamification/xp.service';
const goalInclude = {
  area: true,
  milestones: true,
  projects: { include: { tasks: { select: { status: true } } } },
  _count: { select: { habits: true } },
} as const;
const projectInclude = {
  goal: { select: { id: true, title: true, area: true } },
  tasks: { select: { id: true, title: true, status: true } },
  milestones: true,
} as const;
@Injectable()
export class PlanningService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(XpService) private readonly xp: XpService,
  ) {}
  async goals(userId: string, query: InputOf<typeof paginationSchema>) {
    const where = {
      userId,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, count] = await Promise.all([
      this.db.goal.findMany({
        where,
        include: goalInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.goal.count({ where }),
    ]);
    return pageResult(
      items.map((goal) => ({ ...goal, progress: goalProgress(goal) })),
      count,
      query.page,
      query.limit,
    );
  }
  async createGoal(userId: string, input: InputOf<typeof goalSchema>) {
    this.validateGoal(input);
    return this.db.atomic(userId, async (tx) => {
      await assertReferences(tx, userId, input);
      const goal = await tx.goal.create({
        data: { ...dates(input, ['startDate', 'targetDate']), userId },
      });
      await tx.analyticsEvent.create({ data: { userId, name: 'goal_created' } });
      return goal;
    });
  }
  async updateGoal(userId: string, id: string, input: InputOf<typeof goalUpdateSchema>) {
    return this.db.atomic(userId, async (tx) => {
      const goal = await tx.goal.findFirst({ where: { id, userId } });
      if (!goal) throw new NotFoundException();
      this.validateGoal({ ...goal, ...input });
      await assertReferences(tx, userId, input);
      return tx.goal.update({ where: { id }, data: dates(input, ['startDate', 'targetDate']) });
    });
  }
  private validateGoal(input: {
    strategy?: string;
    numericTarget?: number | null;
    startDate?: string | Date | null;
    targetDate?: string | Date | null;
  }) {
    if (input.strategy === 'NUMERIC' && !input.numericTarget)
      throw new BadRequestException('Numeric goals need a positive target.');
    assertDateOrder(input.startDate, input.targetDate);
  }
  async projects(userId: string, query: InputOf<typeof paginationSchema>) {
    const where = {
      userId,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, count] = await Promise.all([
      this.db.project.findMany({
        where,
        include: projectInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.limit),
      }),
      this.db.project.count({ where }),
    ]);
    return pageResult(
      items.map((project) => ({
        ...project,
        progress: projectProgress(project.tasks),
        health:
          project.deadline && project.deadline < new Date() && project.status !== 'COMPLETED'
            ? 'NEEDS_ATTENTION'
            : 'ON_TRACK',
      })),
      count,
      query.page,
      query.limit,
    );
  }
  async createProject(userId: string, input: InputOf<typeof projectSchema>) {
    assertDateOrder(input.startDate, input.deadline);
    return this.db.atomic(userId, async (tx) => {
      await assertReferences(tx, userId, input);
      const project = await tx.project.create({
        data: { ...dates(input, ['startDate', 'deadline']), userId },
      });
      await tx.analyticsEvent.create({ data: { userId, name: 'project_created' } });
      return project;
    });
  }
  async updateProject(userId: string, id: string, input: InputOf<typeof projectUpdateSchema>) {
    return this.db.atomic(userId, async (tx) => {
      const project = await tx.project.findFirst({ where: { id, userId } });
      if (!project) throw new NotFoundException();
      const updated = { ...project, ...input };
      assertDateOrder(updated.startDate, updated.deadline);
      await assertReferences(tx, userId, input);
      if (
        input.goalId &&
        input.goalId !== project.goalId &&
        (await tx.task.count({ where: { projectId: id, goalId: { not: input.goalId } } }))
      )
        throw new BadRequestException(
          'Some tasks are linked to another goal. Update their goal links before moving this project.',
        );
      return tx.project.update({ where: { id }, data: dates(input, ['startDate', 'deadline']) });
    });
  }
  async tasks(userId: string, query: InputOf<typeof paginationSchema>, timezone = 'UTC') {
    const today = dateOnly(localDate(new Date(), timezone));
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status === 'DONE'
        ? { status: 'COMPLETED' as const }
        : query.status === 'OPEN'
          ? { status: { notIn: ['COMPLETED', 'ARCHIVED'] } }
          : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(query.today
        ? {
            status: { notIn: ['COMPLETED', 'ARCHIVED'] as const },
            AND: [
              { OR: [{ dueDate: null }, { dueDate: { lte: today } }] },
              { OR: [{ startDate: null }, { startDate: { lte: today } }] },
            ],
          }
        : {}),
    };
    const [items, count] = await Promise.all([
      this.db.task.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          parent: { select: { id: true, title: true } },
          goal: { select: { id: true, title: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        ...pageArgs(query.page, query.limit),
      }),
      this.db.task.count({ where }),
    ]);
    return pageResult(items, count, query.page, query.limit);
  }
  async createTask(userId: string, input: InputOf<typeof taskSchema>) {
    assertDateOrder(input.startDate, input.dueDate);
    return this.db.atomic(userId, async (tx) => {
      await assertReferences(tx, userId, input);
      return tx.task.create({ data: { ...dates(input, ['startDate', 'dueDate']), userId } });
    });
  }
  async updateTask(userId: string, id: string, input: InputOf<typeof taskUpdateSchema>) {
    return this.db.atomic(userId, async (tx) => {
      const task = await tx.task.findFirst({ where: { id, userId } });
      if (!task) throw new NotFoundException();

      if (input.startDate !== undefined || input.dueDate !== undefined) {
        assertDateOrder(input.startDate ?? task.startDate, input.dueDate ?? task.dueDate);
      }

      const hasRefChanges =
        input.goalId !== undefined || input.projectId !== undefined || input.parentId !== undefined;
      if (hasRefChanges) {
        await assertReferences(tx, userId, {
          goalId: input.goalId !== undefined ? input.goalId : task.goalId,
          projectId: input.projectId !== undefined ? input.projectId : task.projectId,
          parentId: input.parentId !== undefined ? input.parentId : task.parentId,
        });
      }

      if (
        input.parentId !== undefined &&
        input.parentId !== null &&
        input.parentId !== task.parentId
      ) {
        let parentId: string | null | undefined = input.parentId;
        let depth = 0;
        while (parentId) {
          if (parentId === id || depth++ > 50)
            throw new BadRequestException('A task cannot be its own ancestor.');
          parentId = (
            await tx.task.findFirst({
              where: { id: parentId, userId },
              select: { parentId: true },
            })
          )?.parentId;
        }
      }

      const updated = await tx.task.update({
        where: { id },
        data: {
          ...dates(input, ['startDate', 'dueDate']),
          ...(input.status
            ? {
                completedAt: input.status === 'COMPLETED' ? (task.completedAt ?? new Date()) : null,
              }
            : {}),
        },
      });
      let awarded = 0;
      let levelUp: Awaited<ReturnType<XpService['award']>>['levelUp'] = null;
      if (input.status === 'COMPLETED' && task.status !== 'COMPLETED') {
        ({ awarded, levelUp } = await this.xp.award(tx, userId, 'TASK', id, 10, `task:${id}`));
        await tx.analyticsEvent.create({ data: { userId, name: 'task_completed' } });
      }
      return { ...updated, awarded, levelUp };
    });
  }
  async milestone(userId: string, input: { goalId?: string; projectId?: string; title: string }) {
    if (!!input.goalId === !!input.projectId)
      throw new BadRequestException('Choose one parent for the milestone.');
    return this.db.atomic(userId, async (tx) => {
      await assertReferences(tx, userId, input);
      return tx.milestone.create({ data: input });
    });
  }
  async toggleMilestone(userId: string, id: string, completed: boolean) {
    return this.db.atomic(userId, async (tx) => {
      const milestone = await tx.milestone.findFirst({
        where: { id, OR: [{ goal: { userId } }, { project: { userId } }] },
      });
      if (!milestone) throw new NotFoundException();
      return tx.milestone.update({ where: { id }, data: { completed } });
    });
  }
}
export const milestoneSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    goalId: z.string().optional(),
    projectId: z.string().optional(),
  })
  .strict();
