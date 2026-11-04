import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { ApiErrors } from './errors';
import { API_ERROR_TOAST, API_LOADING_SCOPE, LoadingScope } from './request-context';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Celebrations } from './celebrations';

export interface ApiRequestOptions {
  /** Global tracks the shared progress indicator; local state stays with the calling feature. */
  readonly loading?: LoadingScope;
  /** Uses the shared error toast only when the feature has no local error presentation. */
  readonly notifyOnError?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly inFlight = signal(0);
  private readonly blockingCount = signal(0);
  private readonly navigating = signal(false);
  // Smooth, debounced visual signals that prevent flickers
  readonly showTopBar = signal(false);
  readonly showOverlay = signal(false);
  readonly isLoading = computed(() => this.inFlight() > 0 || this.navigating());
  readonly isBlocking = computed(() => this.blockingCount() > 0);

  private showTopBarTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTopBarTimer: ReturnType<typeof setTimeout> | null = null;
  private topBarVisibleSince = 0;

  private showOverlayTimer: ReturnType<typeof setTimeout> | null = null;
  private hideOverlayTimer: ReturnType<typeof setTimeout> | null = null;
  private overlayVisibleSince = 0;

  // Centralized, configurable display thresholds
  readonly DISPLAY_DELAY_MS = 150;
  readonly MIN_VISIBLE_MS = 300;

  start() {
    this.inFlight.update((c) => c + 1);
    this.evaluateTopBarState();
  }

  stop() {
    this.inFlight.update((c) => Math.max(0, c - 1));
    this.evaluateTopBarState();
  }

  startBlocking() {
    this.blockingCount.update((c) => c + 1);
    this.evaluateOverlayState();
  }

  stopBlocking() {
    this.blockingCount.update((c) => Math.max(0, c - 1));
    this.evaluateOverlayState();
  }

  setNavigating(val: boolean) {
    this.navigating.set(val);
    this.evaluateTopBarState();
    this.evaluateOverlayState();
  }

  private evaluateTopBarState() {
    if (!isPlatformBrowser(this.platformId)) return;

    const shouldShow = this.inFlight() > 0 || this.navigating();

    if (shouldShow) {
      if (this.hideTopBarTimer) {
        clearTimeout(this.hideTopBarTimer);
        this.hideTopBarTimer = null;
      }
      if (!this.showTopBar() && !this.showTopBarTimer) {
        this.showTopBarTimer = setTimeout(() => {
          this.showTopBarTimer = null;
          this.showTopBar.set(true);
          this.topBarVisibleSince = Date.now();
        }, this.DISPLAY_DELAY_MS);
      }
    } else {
      if (this.showTopBarTimer) {
        clearTimeout(this.showTopBarTimer);
        this.showTopBarTimer = null;
      }
      if (this.showTopBar() && !this.hideTopBarTimer) {
        const elapsed = Date.now() - this.topBarVisibleSince;
        const remaining = Math.max(0, this.MIN_VISIBLE_MS - elapsed);
        this.hideTopBarTimer = setTimeout(() => {
          this.hideTopBarTimer = null;
          this.showTopBar.set(false);
          this.topBarVisibleSince = 0;
        }, remaining);
      }
    }
  }

  private evaluateOverlayState() {
    if (!isPlatformBrowser(this.platformId)) return;

    const shouldShow = this.blockingCount() > 0 || this.navigating();

    if (shouldShow) {
      if (this.hideOverlayTimer) {
        clearTimeout(this.hideOverlayTimer);
        this.hideOverlayTimer = null;
      }
      if (!this.showOverlay() && !this.showOverlayTimer) {
        const delay = this.blockingCount() > 0 ? 50 : 250;
        this.showOverlayTimer = setTimeout(() => {
          this.showOverlayTimer = null;
          this.showOverlay.set(true);
          this.overlayVisibleSince = Date.now();
        }, delay);
      }
    } else {
      if (this.showOverlayTimer) {
        clearTimeout(this.showOverlayTimer);
        this.showOverlayTimer = null;
      }
      if (this.showOverlay() && !this.hideOverlayTimer) {
        const elapsed = Date.now() - this.overlayVisibleSince;
        const remaining = Math.max(0, this.MIN_VISIBLE_MS - elapsed);
        this.hideOverlayTimer = setTimeout(() => {
          this.hideOverlayTimer = null;
          this.showOverlay.set(false);
          this.overlayVisibleSince = 0;
        }, remaining);
      }
    }
  }

  reset() {
    if (this.showTopBarTimer) clearTimeout(this.showTopBarTimer);
    if (this.hideTopBarTimer) clearTimeout(this.hideTopBarTimer);
    if (this.showOverlayTimer) clearTimeout(this.showOverlayTimer);
    if (this.hideOverlayTimer) clearTimeout(this.hideOverlayTimer);
    this.inFlight.set(0);
    this.blockingCount.set(0);
    this.navigating.set(false);
    this.showTopBar.set(false);
    this.showOverlay.set(false);
  }
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly celebrations = inject(Celebrations);
  private readonly errors = inject(ApiErrors);
  private readonly publicReads = new Map<string, { expires: number; value: Promise<unknown> }>();

  private context(options: ApiRequestOptions = {}) {
    return new HttpContext()
      .set(API_ERROR_TOAST, options.notifyOnError ?? false)
      .set(API_LOADING_SCOPE, options.loading ?? 'silent');
  }

  errorMessage(error: unknown) {
    return this.errors.message(error);
  }

  private track<T>(request: Observable<T>): Promise<T> {
    return firstValueFrom(request.pipe(timeout({ first: 90_000 })));
  }

  get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const context = this.context(options);
    if (path === 'life-areas') {
      const cacheKey = `${path}:${options.loading ?? 'silent'}:${options.notifyOnError ? 'toast' : 'silent'}`;
      const cached = this.publicReads.get(cacheKey);
      if (cached && cached.expires > Date.now()) return cached.value as Promise<T>;
      const value = this.track(
        this.http.get<T>(`/api/${path}`, { withCredentials: true, context }),
      ).catch((error) => {
        this.publicReads.delete(cacheKey);
        throw error;
      });
      this.publicReads.set(cacheKey, { expires: Date.now() + 300000, value });
      return value;
    }

    return this.track(this.http.get<T>(`/api/${path}`, { withCredentials: true, context }));
  }
  post<T>(path: string, body: unknown = {}, options: ApiRequestOptions = {}) {
    return this.track(
      this.http.post<T>(`/api/${path}`, body, {
        withCredentials: true,
        context: this.context(options),
      }),
    ).then((result) => {
      this.celebrations.receive(result);
      return result;
    });
  }
  patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}) {
    return this.track(
      this.http.patch<T>(`/api/${path}`, body, {
        withCredentials: true,
        context: this.context(options),
      }),
    ).then((result) => {
      this.celebrations.receive(result);
      return result;
    });
  }
  put<T>(path: string, body: unknown = {}, options: ApiRequestOptions = {}) {
    return this.track(
      this.http.put<T>(`/api/${path}`, body, {
        withCredentials: true,
        context: this.context(options),
      }),
    );
  }
  delete<T>(path: string, options: ApiRequestOptions = {}) {
    return this.track(
      this.http.delete<T>(`/api/${path}`, {
        withCredentials: true,
        context: this.context(options),
      }),
    );
  }
  resource<T>(path: string) {
    const resource = new Remote<T>(this, path);
    void resource.load();
    return resource;
  }
}
export class Remote<T> {
  readonly data = signal<T | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private request = 0;
  constructor(
    private readonly api: Api,
    private path: string,
  ) {}
  refreshIfLoading() {
    if (this.loading()) void this.load();
  }
  async load(path = this.path) {
    const request = ++this.request;
    this.path = path;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.get<T>(path);
      if (request === this.request) this.data.set(data);
    } catch (error) {
      if (request === this.request) this.error.set(this.api.errorMessage(error));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
@Injectable({ providedIn: 'root' })
export class Toasts {
  private readonly messages = inject(MessageService);
  private readonly errors = inject(ApiErrors);
  success(summary: string, detail?: string) {
    this.messages.add({ severity: 'success', summary, detail, life: 3500 });
  }
  error(error: unknown) {
    this.messages.add({ severity: 'error', summary: this.errors.message(error), life: 6000 });
  }
}
