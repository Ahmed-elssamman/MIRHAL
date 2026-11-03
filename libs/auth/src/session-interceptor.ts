import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from './index';

const AUTH_EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/me',
  '/auth/capabilities',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/public-settings',
  '/friends/invitations/resolve',
];

function isAuthExcluded(url: string): boolean {
  return AUTH_EXCLUDED_PATHS.some((path) => url.includes(path));
}

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isAuthExcluded(request.url)
      ) {
        return from(auth.refresh()).pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              return next(request);
            }
            auth.clearSession();
            void router.navigate(['/auth/login']);
            return throwError(() => error);
          }),
          catchError(() => {
            auth.clearSession();
            void router.navigate(['/auth/login']);
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
