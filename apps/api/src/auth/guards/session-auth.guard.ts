import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { Database } from '../../common/database';
import { ApiRequest } from '../../common/http';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * SessionAuthGuard: Responsible solely for authentication (AuthN).
 * Validates the caller's session token from the secure cookie and attaches identity.
 * Contains NO role or authorization policy logic.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const token: unknown = (request.cookies as Record<string, unknown> | undefined)?.['lq_session'];
    if (typeof token !== 'string' || token.length > 256) {
      throw new UnauthorizedException('Please sign in to continue.');
    }

    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: { id: true, role: true, status: true, profile: { select: { timezone: true } } },
        },
      },
    });

    if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    request.identity = {
      id: session.user.id,
      role: session.user.role,
      sessionId: session.id,
      timezone: session.user.profile?.timezone ?? 'UTC',
    };

    return true;
  }
}
