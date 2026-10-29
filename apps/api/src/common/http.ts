import {
  ArgumentsHost,
  Catch,
  createParamDecorator,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
export interface Identity {
  id: string;
  role: Role;
  sessionId: string;
  timezone: string;
}
export interface ApiRequest extends Request {
  identity?: Identity;
  requestId: string;
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, context): Identity => context.switchToHttp().getRequest<ApiRequest>().identity!,
);
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
@Injectable()
export class Validate<T> implements PipeTransform<unknown, T> {
  constructor(readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields.',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    return result.data;
  }
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<ApiRequest>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';
    let details: unknown = undefined;
    let retryAfter: unknown = undefined;
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const data = body as Record<string, unknown>;
        message =
          typeof data['message'] === 'string' ? data['message'] : 'Please check your request.';
        code =
          typeof data['code'] === 'string'
            ? data['code']
            : status === HttpStatus.TOO_MANY_REQUESTS
              ? 'TOO_MANY_REQUESTS'
              : `HTTP_${status}`;
        details = data['details'];
        retryAfter = data['retryAfter'];
      }
    } else if (
      error instanceof Error &&
      'type' in error &&
      (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')
    ) {
      status = error.type === 'entity.too.large' ? 413 : 400;
      code = error.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON';
      message =
        error.type === 'entity.too.large'
          ? 'The request is too large.'
          : 'The request must contain valid JSON.';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        code = 'ALREADY_EXISTS';
        message = 'This action has already been recorded.';
      }
      if (error.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'We could not find that item.';
      }
      if (error.code === 'P2003') {
        status = 400;
        code = 'INVALID_REFERENCE';
        message = 'A linked item is no longer available.';
      }
    }
    if (status >= 500)
      console.error(
        JSON.stringify({
          level: 'error',
          requestId: request.requestId,
          code,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        }),
      );
    response.status(status).json({
      code,
      message,
      ...(details ? { details } : {}),
      ...(retryAfter !== undefined ? { retryAfter } : {}),
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
