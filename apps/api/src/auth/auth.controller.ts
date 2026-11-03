import { Body, Req, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import {
  emailSchema,
  InputOf,
  loginSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
} from '@lifequest/contracts';
import { ApiRequest, CurrentUser, Identity, Public, Validate } from '../common/http';
import { Database } from '../common/database';
import { AuthService, safeUser } from './auth.service';
import { MailAdapter } from './mail.adapter';
function cookie(response: Response, session: { token: string; expiresAt: Date }) {
  response.cookie('lq_session', session.token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/api',
    expires: session.expiresAt,
  });
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Database) private readonly db: Database,
    @Inject(MailAdapter) private readonly mail: MailAdapter,
  ) {}
  @Public()
  @Get('capabilities')
  capabilities() {
    return { emailDelivery: this.mail.enabled };
  }
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create an account and secure session' })
  async register(
    @Body(new Validate(registerSchema)) input: InputOf<typeof registerSchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(input);
    cookie(response, result);
    return { user: result.user, verificationEmail: result.verificationEmail };
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body(new Validate(loginSchema)) input: InputOf<typeof loginSchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.email, input.password);
    cookie(response, result);
    return { user: result.user };
  }
  @Get('me') me(@CurrentUser() user: Identity) {
    return this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: safeUser });
  }
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @CurrentUser() user: Identity,
    @Req() request: ApiRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.refresh(user.id, user.sessionId);
    const token = (request.cookies as Record<string, string>)['lq_session']!;
    cookie(response, { ...session, token });
    return { success: true };
  }
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: Identity, @Res({ passthrough: true }) response: Response) {
    await this.db.session.deleteMany({ where: { id: user.sessionId } });
    response.clearCookie('lq_session', { path: '/api' });
    return { success: true };
  }
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: Identity, @Res({ passthrough: true }) response: Response) {
    await this.db.session.deleteMany({ where: { userId: user.id } });
    response.clearCookie('lq_session', { path: '/api' });
    return { success: true };
  }
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgot(@Body(new Validate(emailSchema)) input: InputOf<typeof emailSchema>) {
    return this.auth.forgot(input.email);
  }
  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  reset(@Body(new Validate(resetSchema)) input: InputOf<typeof resetSchema>) {
    return this.auth.consume(input.token, 'RESET_PASSWORD', input.password);
  }
  @Public()
  @Post('verify-email')
  verify(@Body(new Validate(tokenSchema)) input: InputOf<typeof tokenSchema>) {
    return this.auth.consume(input.token, 'VERIFY_EMAIL');
  }
  @Post('resend-verification')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  async resend(@CurrentUser() identity: Identity) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: identity.id } });
    if (user.emailVerifiedAt) return { status: 'already-verified' as const };
    const accepted = await this.auth.issueEmailToken(user.id, user.email, 'VERIFY_EMAIL');
    return { status: accepted ? ('accepted' as const) : ('rate-limited' as const) };
  }
}
