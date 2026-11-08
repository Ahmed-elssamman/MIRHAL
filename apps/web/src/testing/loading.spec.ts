import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_LOADING_SCOPE,
  Api,
  apiLoadingInterceptor,
  isApiRequest,
  LoadingService,
} from '@lifequest/data-access';

describe('Centralized API-driven loading architecture', () => {
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

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  describe('LoadingService unit behavior & concurrency', () => {
    it('activates loading tracking on first eligible request and tracks concurrency safely', () => {
      const loading = TestBed.inject(LoadingService);
      expect(loading.isLoading()).toBe(false);

      const req1 = loading.start();
      expect(loading.isLoading()).toBe(true);
      expect(loading.activeCount()).toBe(1);

      const req2 = loading.start();
      expect(loading.isLoading()).toBe(true);
      expect(loading.activeCount()).toBe(2);

      // Completing one request keeps loading active while others remain
      loading.stop(req1);
      expect(loading.isLoading()).toBe(true);
      expect(loading.activeCount()).toBe(1);

      // Completing last request releases loading state
      loading.stop(req2);
      expect(loading.isLoading()).toBe(false);
      expect(loading.activeCount()).toBe(0);
    });

    it('remains idempotent and never becomes negative or stuck on repeated cleanup', () => {
      const loading = TestBed.inject(LoadingService);
      const reqId = loading.start();
      expect(loading.activeCount()).toBe(1);

      loading.stop(reqId);
      expect(loading.activeCount()).toBe(0);

      // Repeated cleanup with same ID does not decrement below zero
      loading.stop(reqId);
      expect(loading.activeCount()).toBe(0);
      expect(loading.isLoading()).toBe(false);

      // Extra anonymous stop calls do not corrupt state
      loading.stop();
      expect(loading.activeCount()).toBe(0);
      expect(loading.isLoading()).toBe(false);
    });

    it('tracks blocking requests distinctly and supports reset', () => {
      const loading = TestBed.inject(LoadingService);
      const bId = loading.startBlocking();
      expect(loading.isBlocking()).toBe(true);
      expect(loading.isLoading()).toBe(true);

      loading.stopBlocking(bId);
      expect(loading.isBlocking()).toBe(false);

      loading.startBlocking();
      loading.reset();
      expect(loading.isLoading()).toBe(false);
      expect(loading.isBlocking()).toBe(false);
      expect(loading.showOverlay()).toBe(false);
      expect(loading.showTopBar()).toBe(false);
    });
  });

  describe('Anti-flickering and timing configuration', () => {
    it('does not flash the global loader when a request completes before the show delay', () => {
      const loading = TestBed.inject(LoadingService);
      const id = loading.start();
      expect(loading.isLoading()).toBe(true);

      // Advance by 100ms (less than DISPLAY_DELAY_MS of 250ms)
      vi.advanceTimersByTime(100);
      expect(loading.showOverlay()).toBe(false);
      expect(loading.showTopBar()).toBe(false);

      // Fast request finishes early
      loading.stop(id);
      expect(loading.isLoading()).toBe(false);

      // Even after the original delay passes, the loader was never revealed
      vi.advanceTimersByTime(300);
      expect(loading.showOverlay()).toBe(false);
      expect(loading.showTopBar()).toBe(false);
    });

    it('shows the global loader after the delay and keeps it visible for minimum duration', () => {
      const loading = TestBed.inject(LoadingService);
      const id = loading.start();

      // At 249ms: not yet visible
      vi.advanceTimersByTime(249);
      expect(loading.showOverlay()).toBe(false);

      // At 250ms: show timer fires
      vi.advanceTimersByTime(1);
      expect(loading.showOverlay()).toBe(true);
      expect(loading.showTopBar()).toBe(true);

      // Request completes 50ms after appearing (total 300ms)
      vi.advanceTimersByTime(50);
      loading.stop(id);
      expect(loading.isLoading()).toBe(false);

      // Should remain visible to satisfy MIN_VISIBLE_MS (500ms total visible time, remaining = 450ms)
      vi.advanceTimersByTime(449);
      expect(loading.showOverlay()).toBe(true);
      expect(loading.showTopBar()).toBe(true);

      // Now minimum duration is satisfied, smoothly hides
      vi.advanceTimersByTime(1);
      expect(loading.showOverlay()).toBe(false);
      expect(loading.showTopBar()).toBe(false);
    });

    it('keeps the loader visible across overlapping concurrent requests without restarting', () => {
      const loading = TestBed.inject(LoadingService);
      const r1 = loading.start();
      vi.advanceTimersByTime(250);
      expect(loading.showOverlay()).toBe(true);

      // Second request arrives while first is active
      const r2 = loading.start();
      vi.advanceTimersByTime(200);

      // First request completes, but second is still active
      loading.stop(r1);
      expect(loading.isLoading()).toBe(true);
      expect(loading.showOverlay()).toBe(true);

      // Second completes after satisfying duration
      vi.advanceTimersByTime(400);
      loading.stop(r2);
      expect(loading.isLoading()).toBe(false);

      vi.advanceTimersByTime(1);
      expect(loading.showOverlay()).toBe(false);
    });
  });

  describe('HTTP Interceptor & Scoped Policies', () => {
    it('identifies API URLs correctly and ignores static assets', () => {
      expect(isApiRequest('/api/dashboard')).toBe(true);
      expect(isApiRequest('https://api.mirhal.app/habits')).toBe(true);
      expect(isApiRequest('/api/v1/users')).toBe(true);
      expect(isApiRequest('/assets/i18n/ar.json')).toBe(false);
      expect(isApiRequest('/mirhal-mark.svg')).toBe(false);
      expect(isApiRequest('/styles.css')).toBe(false);
      expect(isApiRequest('/bundle.js')).toBe(false);
      expect(isApiRequest('/fonts/inter.woff2')).toBe(false);
    });

    it('tracks GLOBAL requests through the interceptor and releases them on success', async () => {
      const loading = TestBed.inject(LoadingService);
      const http = TestBed.inject(HttpClient);
      const ctrl = TestBed.inject(HttpTestingController);

      let completed = false;
      http
        .get('/api/resource', { context: new HttpContext().set(API_LOADING_SCOPE, 'global') })
        .subscribe(() => {
          completed = true;
        });

      expect(loading.isLoading()).toBe(true);
      ctrl.expectOne('/api/resource').flush({ success: true });
      expect(completed).toBe(true);
      expect(loading.isLoading()).toBe(false);
    });

    it('does not activate global loading for LOCAL and SILENT requests', () => {
      const loading = TestBed.inject(LoadingService);
      const http = TestBed.inject(HttpClient);
      const ctrl = TestBed.inject(HttpTestingController);

      http
        .get('/api/local-data', { context: new HttpContext().set(API_LOADING_SCOPE, 'local') })
        .subscribe();
      expect(loading.isLoading()).toBe(false);
      ctrl.expectOne('/api/local-data').flush({});

      http
        .get('/api/silent-poll', { context: new HttpContext().set(API_LOADING_SCOPE, 'silent') })
        .subscribe();
      expect(loading.isLoading()).toBe(false);
      ctrl.expectOne('/api/silent-poll').flush({});
    });

    it('releases loading tracking when an API request fails with an HTTP error', () => {
      const loading = TestBed.inject(LoadingService);
      const http = TestBed.inject(HttpClient);
      const ctrl = TestBed.inject(HttpTestingController);

      let caughtError = false;
      http
        .get('/api/error-test', { context: new HttpContext().set(API_LOADING_SCOPE, 'global') })
        .subscribe({
          error: () => {
            caughtError = true;
          },
        });

      expect(loading.isLoading()).toBe(true);
      ctrl
        .expectOne('/api/error-test')
        .flush({ message: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });

      expect(caughtError).toBe(true);
      expect(loading.isLoading()).toBe(false);
    });

    it('releases loading tracking when a request is cancelled or unsubscribed', () => {
      const loading = TestBed.inject(LoadingService);
      const http = TestBed.inject(HttpClient);
      const ctrl = TestBed.inject(HttpTestingController);

      const subscription = http
        .get('/api/cancel-test', { context: new HttpContext().set(API_LOADING_SCOPE, 'global') })
        .subscribe();

      expect(loading.isLoading()).toBe(true);
      const req = ctrl.expectOne('/api/cancel-test');

      subscription.unsubscribe();
      expect(req.cancelled).toBe(true);
      expect(loading.isLoading()).toBe(false);
    });

    it('defaults Api.resource and Api.get to global loading so pages rely on the centralized system', async () => {
      const loading = TestBed.inject(LoadingService);
      const api = TestBed.inject(Api);
      const ctrl = TestBed.inject(HttpTestingController);

      const resource = api.resource<{ name: string }>('user-profile');
      expect(loading.isLoading()).toBe(true);

      ctrl.expectOne('/api/user-profile').flush({ name: 'Ahmed' });
      await Promise.resolve();
      expect(resource.data()?.name).toBe('Ahmed');
      expect(loading.isLoading()).toBe(false);
    });
  });
});
