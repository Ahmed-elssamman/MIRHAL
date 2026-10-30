import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api, LoadingService } from '@lifequest/data-access';

describe('background loading indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), MessageService] });
  });
  afterEach(() => vi.useRealTimers());
  it('avoids flicker for quick requests', async () => {
    const loading = TestBed.inject(LoadingService);
    const pending = TestBed.inject(Api).get('fast');
    expect(loading.isLoading()).toBe(false);
    TestBed.inject(HttpTestingController).expectOne('/api/fast').flush({});
    await pending;
    vi.advanceTimersByTime(200);
    expect(loading.isLoading()).toBe(false);
  });
  it('stays visible until concurrent requests settle, including failures', async () => {
    const loading = TestBed.inject(LoadingService);
    const api = TestBed.inject(Api);
    const first = api.get('one');
    const second = api.get('two').catch(() => null);
    vi.advanceTimersByTime(150);
    expect(loading.isLoading()).toBe(true);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/one').flush({});
    await first;
    expect(loading.isLoading()).toBe(true);
    http.expectOne('/api/two').flush({}, { status: 503, statusText: 'Unavailable' });
    await second;
    expect(loading.isLoading()).toBe(false);
    loading.stop();
    expect(loading.isLoading()).toBe(false);
  });
  it('times out an unresponsive request, cancels it, and clears the indicator', async () => {
    const loading = TestBed.inject(LoadingService);
    const pending = TestBed.inject(Api).get('never').catch((error: unknown) => error);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/never');
    vi.advanceTimersByTime(90_000);
    const error = await pending;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('TimeoutError');
    expect(request.cancelled).toBe(true);
    expect(loading.isLoading()).toBe(false);
  });
});
