import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ApiRequest } from '../../common/http';

/**
 * RolesGuard: Responsible solely for role-based access control (AuthZ / RBAC).
 * Reads the @Roles() metadata and verifies that the authenticated identity has an allowed role.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!request.identity) {
      throw new UnauthorizedException('Please sign in to continue.');
    }

    if (!requiredRoles.includes(request.identity.role)) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }
}
