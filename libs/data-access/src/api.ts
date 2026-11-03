import { Injectable, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { ApiErrors } from './errors';
import { API_ERROR_TOAST, API_LOADING_SCOPE, LoadingScope } from './request-context';
import { Observable, firstValueFrom, timeout } from 'rxjs';
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
  private readonly inFlight = signal(0);
  private readonly navigating = signal(false);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private visibleSince = 0;
  readonly isLoading = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimers());
  }

  private clearTimers() {
    if (this.showTimer !== undefined) clearTimeout(this.showTimer);
    if (this.hideTimer !== undefined) clearTimeout(this.hideTimer);
    this.showTimer = undefined;
    this.hideTimer = undefined;
  }

  private updateVisibility() {
    const active = this.inFlight() > 0 || this.navigating();
    if (active) {
      if (this.hideTimer !== undefined) clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
      if (this.browser && !this.isLoading() && this.showTimer === undefined) {
        this.showTimer = setTimeout(() => {
          this.showTimer = undefined;
          if (this.inFlight() > 0 || this.navigating()) {
            this.visibleSince = Date.now();
            this.isLoading.set(true);
          }
        }, 150);
      }
      return;
    }

    if (this.showTimer !== undefined) clearTimeout(this.showTimer);
    this.showTimer = undefined;
    if (!this.isLoading()) return;

    const remaining = Math.max(0, 300 - (Date.now() - this.visibleSince));
    if (remaining === 0) {
      this.isLoading.set(false);
      this.visibleSince = 0;
    } else if (this.hideTimer === undefined) {
      this.hideTimer = setTimeout(() => {
        this.hideTimer = undefined;
        if (this.inFlight() === 0 && !this.navigating()) {
          this.isLoading.set(false);
          this.visibleSince = 0;
        }
      }, remaining);
    }
  }

  start() {
    this.inFlight.update((c) => c + 1);
    this.updateVisibility();
  }

  stop() {
    this.inFlight.update((c) => Math.max(0, c - 1));
    this.updateVisibility();
  }

  setNavigating(val: boolean) {
    this.navigating.set(val);
    this.updateVisibility();
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

  get<T>(path: string, options: ApiRequestOptions = {}) {
    if (path !== 'life-areas')
      return this.track(
        this.http.get<T>(`/api/${path}`, {
          withCredentials: true,
          context: this.context(options),
        }),
      );
    const cacheKey = `${path}:${options.notifyOnError ? 'toast' : 'silent'}`;
    const cached = this.publicReads.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value as Promise<T>;
    const value = this.track(
      this.http.get<T>(`/api/${path}`, {
        withCredentials: true,
        context: this.context(options),
      }),
    ).catch((error) => {
        this.publicReads.delete(cacheKey);
        throw error;
      });
    this.publicReads.set(cacheKey, { expires: Date.now() + 300000, value });
    return value;
  }
  post<T>(path: string, body: unknown = {}, options: ApiRequestOptions = {}) {
    return this.track(
      this.http.post<T>(`/api/${path}`, body, {
        withCredentials: true,
        context: this.context(options),
      })).then((result) => {
        this.celebrations.receive(result);
        return result;
      });
  }
  patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}) {
    return this.track(
      this.http.patch<T>(`/api/${path}`, body, {
        withCredentials: true,
        context: this.context(options),
      })).then(
        (result) => {
          this.celebrations.receive(result);
          return result;
        },
      );
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
