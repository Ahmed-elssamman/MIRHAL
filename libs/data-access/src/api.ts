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

  // Concurrency-safe active request tracking via Sets
  private readonly globalRequests = signal<Set<string | symbol>>(new Set());
  private readonly blockingRequests = signal<Set<string | symbol>>(new Set());
  private readonly localRequests = signal<Set<string | symbol>>(new Set());
  private readonly navigating = signal(false);

  // Smooth, debounced visual signals that prevent flickers
  readonly showTopBar = signal(false);
  readonly showOverlay = signal(false);
  readonly isLoading = computed(
    () => this.globalRequests().size > 0 || this.blockingRequests().size > 0 || this.navigating(),
  );
  readonly isBlocking = computed(() => this.blockingRequests().size > 0);
  readonly activeCount = computed(() => this.globalRequests().size);

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private visibleSince = 0;

  // Centralized, configurable display thresholds
  readonly DISPLAY_DELAY_MS = 250;
  readonly MIN_VISIBLE_MS = 500;
  readonly HIDE_TRANSITION_MS = 250;

  /**
   * Registers a new active request with concurrency-safe ID tracking.
   * Defaults to 'global' scope. Returns the request ID.
   */
  start(id: string | symbol = Symbol('request'), scope: LoadingScope = 'global'): string | symbol {
    if (scope === 'silent') return id;

    if (scope === 'local') {
      this.localRequests.update((set) => new Set(set).add(id));
      return id;
    }

    this.globalRequests.update((set) => new Set(set).add(id));
    this.evaluateVisualState();
    return id;
  }

  /**
   * Safely releases a request from active tracking.
   * If no ID is passed, safely removes any active request (backward compatibility).
   * Concurrency-safe and idempotent (calling multiple times will never make count negative).
   */
  stop(id?: string | symbol): void {
    if (id !== undefined) {
      this.localRequests.update((set) => {
        if (!set.has(id)) return set;
        const next = new Set(set);
        next.delete(id);
        return next;
      });
      this.blockingRequests.update((set) => {
        if (!set.has(id)) return set;
        const next = new Set(set);
        next.delete(id);
        return next;
      });
      this.globalRequests.update((set) => {
        if (!set.has(id)) return set;
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    } else {
      this.globalRequests.update((set) => {
        if (set.size === 0) return set;
        const next = new Set(set);
        const first = next.values().next().value;
        if (first !== undefined) next.delete(first);
        return next;
      });
    }

    this.evaluateVisualState();
  }

  startBlocking(id: string | symbol = Symbol('blocking')): string | symbol {
    this.blockingRequests.update((set) => new Set(set).add(id));
    this.evaluateVisualState();
    return id;
  }

  stopBlocking(id?: string | symbol): void {
    if (id !== undefined) {
      this.blockingRequests.update((set) => {
        if (!set.has(id)) return set;
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    } else {
      this.blockingRequests.update((set) => {
        if (set.size === 0) return set;
        const next = new Set(set);
        const first = next.values().next().value;
        if (first !== undefined) next.delete(first);
        return next;
      });
    }
    this.evaluateVisualState();
  }

  setNavigating(val: boolean) {
    this.navigating.set(val);
    this.evaluateVisualState();
  }

  private evaluateVisualState() {
    if (!isPlatformBrowser(this.platformId)) return;

    const hasGlobalWork =
      this.globalRequests().size > 0 || this.blockingRequests().size > 0 || this.navigating();

    if (hasGlobalWork) {
      // Cancel pending hide timer if new work arrives
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }

      // Schedule show timer if not already visible and not already scheduled
      if (!this.showOverlay() && !this.showTimer) {
        const delay = this.blockingRequests().size > 0 ? 50 : this.DISPLAY_DELAY_MS;
        this.showTimer = setTimeout(() => {
          this.showTimer = null;
          this.showOverlay.set(true);
          this.showTopBar.set(true);
          this.visibleSince = Date.now();
        }, delay);
      }
    } else {
      // No active global work
      if (this.showTimer) {
        clearTimeout(this.showTimer);
        this.showTimer = null;
      }

      if ((this.showOverlay() || this.showTopBar()) && !this.hideTimer) {
        const elapsed = Date.now() - this.visibleSince;
        const remaining = Math.max(0, this.MIN_VISIBLE_MS - elapsed);
        this.hideTimer = setTimeout(() => {
          this.hideTimer = null;
          this.showOverlay.set(false);
          this.showTopBar.set(false);
          this.visibleSince = 0;
        }, remaining);
      }
    }
  }

  reset() {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.showTimer = null;
    this.hideTimer = null;
    this.visibleSince = 0;
    this.globalRequests.set(new Set());
    this.blockingRequests.set(new Set());
    this.localRequests.set(new Set());
    this.navigating.set(false);
    this.showOverlay.set(false);
    this.showTopBar.set(false);
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
      .set(API_LOADING_SCOPE, options.loading ?? 'global');
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
  resource<T>(path: string, options: ApiRequestOptions = { loading: 'global' }) {
    const resource = new Remote<T>(this, path, options);
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
    private readonly options: ApiRequestOptions = { loading: 'global' },
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
      const data = await this.api.get<T>(path, this.options);
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
