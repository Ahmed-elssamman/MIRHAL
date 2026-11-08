import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { LoadingService } from './api';
import { API_LOADING_SCOPE } from './request-context';

export function isApiRequest(url: string): boolean {
  if (!url) return false;
  // Ignore static assets, bundles, media, fonts, translation files
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|css|js|json)(\?.*)?$/i.test(url)) {
    return false;
  }
  return url.startsWith('/api') || url.includes('/api/') || url.includes('api.');
}

/** Tracks API requests and manages centralized loading feedback. */
export const apiLoadingInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequest(request.url)) return next(request);

  const scope = request.context.get(API_LOADING_SCOPE);
  if (scope !== 'global') return next(request);

  const loading = inject(LoadingService);
  const requestId = loading.start(Symbol('http-req'), 'global');

  return next(request).pipe(
    finalize(() => {
      loading.stop(requestId);
    }),
  );
};
