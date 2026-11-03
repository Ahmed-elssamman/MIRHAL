import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { LoadingService } from './api';
import { API_LOADING_SCOPE } from './request-context';

/** Tracks explicitly global requests and always releases them on completion or cancellation. */
export const apiLoadingInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(API_LOADING_SCOPE) !== 'global') return next(request);

  const loading = inject(LoadingService);
  loading.start();
  return next(request).pipe(finalize(() => loading.stop()));
};
