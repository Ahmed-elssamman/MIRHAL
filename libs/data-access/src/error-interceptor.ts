import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Toasts } from './api';
import { API_ERROR_TOAST } from './request-context';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const toasts = inject(Toasts);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (request.context.get(API_ERROR_TOAST)) toasts.error(error);
      return throwError(() => error);
    }),
  );
};
