import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ERROR_TOAST, Api, apiErrorInterceptor } from '@lifequest/data-access';
import { sessionInterceptor } from '@lifequest/auth';

@Component({ standalone: true, template: '' })
class LoginRoute {}

describe('API error toast policy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor, sessionInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'auth/login', component: LoginRoute }]),
        MessageService,
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('keeps local error UI requests silent and only toasts opted-in failures once', async () => {
    const api = TestBed.inject(Api);
    const messages = TestBed.inject(MessageService);
    const add = vi.spyOn(messages, 'add');
    const http = TestBed.inject(HttpTestingController);

    const locallyHandled = api.get('local-error').catch((error: unknown) => error);
    const localRequest = http.match('/api/local-error')[0];
    if (!localRequest) throw await locallyHandled;
    localRequest.flush(
      { message: 'A local error.' },
      { status: 503, statusText: 'Unavailable' },
    );
    await locallyHandled;
    expect(add).not.toHaveBeenCalled();

    const centrallyHandled = api
      .get('toast-error', { notifyOnError: true })
      .catch((error: unknown) => error);
    const request = http.match('/api/toast-error')[0];
    if (!request) throw await centrallyHandled;
    expect(request.request.context.get(API_ERROR_TOAST)).toBe(true);
    request.flush(
      { message: 'A centralized error.' },
      { status: 503, statusText: 'Unavailable' },
    );
    await centrallyHandled;
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('toasts once after a failed session refresh on an opted-in request', async () => {
    const add = vi.spyOn(TestBed.inject(MessageService), 'add');
    const pending = TestBed.inject(Api)
      .get('private', { notifyOnError: true })
      .catch((error: unknown) => error);
    const http = TestBed.inject(HttpTestingController);

    const privateRequest = http.match('/api/private')[0];
    if (!privateRequest) throw await pending;
    privateRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    await pending;

    expect(add).toHaveBeenCalledTimes(1);
  });
});
