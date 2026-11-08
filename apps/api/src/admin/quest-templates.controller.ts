import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InputOf, paginationSchema, questTemplateSchema } from '@mirhal/contracts';
import { CurrentUser, Identity, Roles, Validate } from '../common/http';
import { Database } from '../common/database';
import { assertReferences, pageArgs, pageResult } from '../core/ownership';
@ApiTags('Quest templates')
@Controller()
export class QuestTemplatesController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get('quest-templates') available() {
    return this.db.questTemplate.findMany({
      where: { active: true },
      include: { area: true, items: { orderBy: { sortOrder: 'asc' } } },
      take: 25,
      orderBy: { createdAt: 'desc' },
    });
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Get('admin/quest-templates') async list(
    @Query(new Validate(paginationSchema)) query: InputOf<typeof paginationSchema>,
  ) {
    const where = query.search
      ? { title: { contains: query.search, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await Promise.all([
      this.db.questTemplate.findMany({
        where,
        include: { area: true, items: { orderBy: { sortOrder: 'asc' } } },
        ...pageArgs(query.page, query.limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.questTemplate.count({ where }),
    ]);
    return pageResult(items, total, query.page, query.limit);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Post('admin/quest-templates') create(
    @CurrentUser() actor: Identity,
    @Body(new Validate(questTemplateSchema)) input: InputOf<typeof questTemplateSchema>,
  ) {
    return this.save(actor, input);
  }
  @Roles('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER') @Patch('admin/quest-templates/:id') update(
    @CurrentUser() actor: Identity,
    @Param('id') id: string,
    @Body(new Validate(questTemplateSchema)) input: InputOf<typeof questTemplateSchema>,
  ) {
    return this.save(actor, input, id);
  }
  private save(actor: Identity, input: InputOf<typeof questTemplateSchema>, id?: string) {
    return this.db.staffAtomic(
      actor.id,
      ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'],
      async (tx) => {
        await assertReferences(tx, actor.id, { areaId: input.areaId });
        const { items, itemsAr, ...fields } = input;
        const data = {
          ...fields,
          items: {
            ...(id ? { deleteMany: {} } : {}),
            create: items.map((title, sortOrder) => ({
              title,
              titleAr: itemsAr?.[sortOrder] ?? '',
              sortOrder,
            })),
          },
        };
        const template = id
          ? await tx.questTemplate.update({ where: { id }, data, include: { items: true } })
          : await tx.questTemplate.create({ data, include: { items: true } });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: id ? 'QUEST_TEMPLATE_UPDATED' : 'QUEST_TEMPLATE_CREATED',
            entity: 'QuestTemplate',
            entityId: template.id,
          },
        });
        return template;
      },
    );
  }
}
