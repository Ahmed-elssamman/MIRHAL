import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Database } from '../common/database';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

export { hashToken, SessionAuthGuard } from './guards/session-auth.guard';
export { RolesGuard } from './guards/roles.guard';

/**
 * AuthGuard combines SessionAuthGuard (AuthN) and RolesGuard (AuthZ)
 * for backward compatibility with existing tests and imports.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly sessionGuard: SessionAuthGuard;
  private readonly rolesGuard: RolesGuard;

  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {
    this.sessionGuard = new SessionAuthGuard(db, reflector);
    this.rolesGuard = new RolesGuard(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authn = await this.sessionGuard.canActivate(context);
    if (!authn) return false;
    return this.rolesGuard.canActivate(context);
  }
}
