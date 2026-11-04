import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_LOADING_SCOPE,
  Api,
  apiLoadingInterceptor,
  LoadingService,
} from '@lifequest/data-access';

describe('scoped loading indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiLoadingInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
  });
  afterEach(() => vi.useRealTimers());
  it('keeps ordinary page reads silent instead of flashing the global indicator', async () => {
    const loading = TestBed.inject(LoadingService);
    const pending = TestBed.inject(Api).get('fast');
    expect(loading.isLoading()).toBe(false);
    TestBed.inject(HttpTestingController).expectOne('/api/fast').flush({});
    await pending;
    vi.advanceTimersByTime(200);
    expect(loading.isLoading()).toBe(false);
  });
  it('keeps a revealed progress bar visible long enough to avoid a brief flash', () => {
    const loading = TestBed.inject(LoadingService);
    loading.start();
    vi.advanceTimersByTime(150);
    expect(loading.isLoading()).toBe(true);
    expect(loading.showTopBar()).toBe(true);

    loading.stop();
    vi.advanceTimersByTime(299);
    expect(loading.isLoading()).toBe(false);
    expect(loading.showTopBar()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(loading.isLoading()).toBe(false);
    expect(loading.showTopBar()).toBe(false);
  });
  it('keeps feature resources local while their page skeleton owns loading feedback', () => {
    const loading = TestBed.inject(LoadingService);
    const resource = TestBed.inject(Api).resource<{ ready: boolean }>('page-data');

    vi.advanceTimersByTime(200);
    expect(resource.loading()).toBe(true);
    expect(loading.isLoading()).toBe(false);

    TestBed.inject(HttpTestingController).expectOne('/api/page-data').flush({ ready: true });
    expect(loading.isLoading()).toBe(false);
  });
  it('stays visible until explicitly global concurrent requests settle, including failures', async () => {
    const loading = TestBed.inject(LoadingService);
    const api = TestBed.inject(Api);
    const first = api.get('one', { loading: 'global' });
    const second = api.get('two', { loading: 'global' }).catch(() => null);
    vi.advanceTimersByTime(150);
    expect(loading.isLoading()).toBe(true);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/one').flush({});
    await first;
    expect(loading.isLoading()).toBe(true);
    http.expectOne('/api/two').flush({}, { status: 503, statusText: 'Unavailable' });
    await second;
    expect(loading.isLoading()).toBe(false);
    expect(loading.showTopBar()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(loading.isLoading()).toBe(false);
    expect(loading.showTopBar()).toBe(false);
    loading.stop();
    expect(loading.isLoading()).toBe(false);
  });
  it('times out an unresponsive request, cancels it, and clears the indicator', async () => {
    const loading = TestBed.inject(LoadingService);
    const pending = TestBed.inject(Api)
      .get('never', { loading: 'global' })
      .catch((error: unknown) => error);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/never');
    vi.advanceTimersByTime(90_000);
    const error = await pending;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('TimeoutError');
    expect(request.cancelled).toBe(true);
    expect(loading.isLoading()).toBe(false);
  });

  it('tracks direct HttpClient requests opted into global loading and releases cancelled requests', () => {
    const loading = TestBed.inject(LoadingService);
    const subscription = TestBed.inject(HttpClient)
      .get('/api/direct', {
        context: new HttpContext().set(API_LOADING_SCOPE, 'global'),
      })
      .subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/direct');

    vi.advanceTimersByTime(150);
    expect(loading.isLoading()).toBe(true);
    subscription.unsubscribe();

    expect(request.cancelled).toBe(true);
    expect(loading.isLoading()).toBe(false);
    expect(loading.showTopBar()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(loading.isLoading()).toBe(false);
    expect(loading.showTopBar()).toBe(false);
  });
});
