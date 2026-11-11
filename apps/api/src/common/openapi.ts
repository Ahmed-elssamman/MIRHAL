import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import { Validate } from './http';

/** Derive documentation from the same Zod validators that handle requests. */
export function documentValidation(app: INestApplication, document: OpenAPIObject) {
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;
      const prototype = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const method = prototype[name];
        if (typeof method !== 'function') continue;
        const verb = Reflect.getMetadata(METHOD_METADATA, method) as number | undefined;
        if (verb === undefined) continue;
        const path =
          '/api/' +
          [
            Reflect.getMetadata(PATH_METADATA, controller),
            Reflect.getMetadata(PATH_METADATA, method),
          ]
            .filter((value) => value && value !== '/')
            .join('/')
            .replace(/:([^/]+)/g, '{$1}');
        const operation = document.paths[path]?.[RequestMethod[verb]!.toLowerCase() as 'get'];
        if (!operation) continue;
        const isPublic =
          Reflect.getMetadata('public', method) || Reflect.getMetadata('public', controller);
        if (!isPublic) operation.security = [{ cookie: [] }];
        const roles =
          Reflect.getMetadata('roles', method) ?? Reflect.getMetadata('roles', controller);
        operation.description = [
          operation.description,
          roles ? `Required roles: ${(roles as string[]).join(', ')}.` : '',
          'Mutation requests require the configured Origin header.',
        ]
          .filter(Boolean)
          .join('\n');
        const parameters = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) as
          Record<string, { pipes: unknown[] }> | undefined;
        for (const [kind, parameter] of Object.entries(parameters ?? {})) {
          const validation = parameter.pipes.find((pipe) => pipe instanceof Validate);
          if (!(validation instanceof Validate)) continue;
          const schema = z.toJSONSchema(validation.schema, {
            io: 'input',
            unrepresentable: 'any',
            target: 'openapi-3.0',
          }) as SchemaObject;
          if (kind.startsWith('3:'))
            operation.requestBody = { required: true, content: { 'application/json': { schema } } };
          if (kind.startsWith('4:')) {
            operation.parameters = [
              ...(operation.parameters ?? []),
              ...Object.entries(schema.properties ?? {}).map(([name, property]) => ({
                name,
                in: 'query' as const,
                required: schema.required?.includes(name) ?? false,
                schema: property,
              })),
            ];
          }
        }
        for (const code of ['400', '401', '403', '404', '409', '500']) {
          operation.responses[code] ??= {
            description: {
              '400': 'Validation or business rule rejected',
              '401': 'Session missing or expired',
              '403': 'Insufficient permissions or invalid origin',
              '404': 'Owned resource not found',
              '409': 'Duplicate request or conflict',
              '500': 'Safe internal error; use requestId for support',
            }[code]!,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'message', 'requestId', 'timestamp'],
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    details: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { field: { type: 'string' }, message: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          };
        }
      }
    }
  }
}
