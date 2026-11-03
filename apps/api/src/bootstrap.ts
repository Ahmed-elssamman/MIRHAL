import { documentValidation } from './common/openapi';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiExceptionFilter, ApiRequest } from './common/http';
export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env['NODE_ENV'] !== 'production') {
    try {
      const url = new URL(origin);
      if (
        url.protocol === 'http:' &&
        ['4200', '4201', '4300', '4301'].includes(url.port || '80')
      ) {
        const host = url.hostname;
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        ) {
          return true;
        }
      }
    } catch {}
  }
  return false;
}

export function configureApp(app: INestApplication) {
  const origins = [
    process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
    process.env['ADMIN_ORIGIN'] ?? 'http://localhost:4201',
  ];
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || isAllowedOrigin(origin, origins)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Request-Id'],
  });
  app.use((request: ApiRequest, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    response.setHeader('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      (!request.headers.origin || !isAllowedOrigin(request.headers.origin, origins))
    ) {
      response.status(403).json({
        code: 'INVALID_ORIGIN',
        message: 'Request origin is not allowed.',
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const start = performance.now();
    response.on('finish', () => {
      if (process.env['NODE_ENV'] !== 'test')
        console.log(
          JSON.stringify({
            level: 'info',
            requestId: request.requestId,
            method: request.method,
            path: request.path,
            status: response.statusCode,
            durationMs: Math.round(performance.now() - start),
          }),
        );
    });
    next();
  });
  app.use(json({ limit: '64kb' }));
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  if (process.env['NODE_ENV'] !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('MIRHAL API')
        .setDescription(
          'Private personal operating system. All write requests require an allowed Origin header. Authentication uses an HttpOnly session cookie. Validation errors include code, message, details, requestId and timestamp.',
        )
        .setVersion('1.0')
        .addCookieAuth('lq_session')
        .build(),
    );
    documentValidation(app, document);
    SwaggerModule.setup('api/docs', app, document);
  }
  return app;
}
