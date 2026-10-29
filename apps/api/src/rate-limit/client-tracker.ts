import { isIP } from 'node:net';
import { Request } from 'express';
import { ApiRequest } from '../common/http';

/**
 * Extracts client IP safely:
 * - Vercel edge proxy header is trusted ONLY when VERCEL === '1' and contains a valid IP.
 * - Otherwise falls back to request.ip or 'unknown'.
 * - Never trusts unconfigured forwarded headers locally or behind untrusted proxies.
 */
export function clientTracker(request: Request): string {
  const forwarded = request.headers['x-vercel-forwarded-for'];
  const address = typeof forwarded === 'string' ? (forwarded.split(',')[0] ?? '').trim() : '';
  return process.env['VERCEL'] === '1' && isIP(address) ? address : (request.ip ?? 'unknown');
}

/**
 * Builds a composite rate limiting key taking into account:
 * - Client IP (via secure clientTracker)
 * - User/Session ID (when authenticated)
 * - Route path / method
 */
export function buildRateLimitKey(request: Request): string {
  const ip = clientTracker(request);
  const apiReq = request as ApiRequest;
  const identity = apiReq.identity;
  const userPart = identity ? `u:${identity.id}:s:${identity.sessionId}` : 'anon';
  const routePart = `${request.method}:${request.path}`;
  return `${ip}:${userPart}:${routePart}`;
}
