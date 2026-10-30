import { Injectable, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { errorMessage } from './errors';
export { errorMessage } from './errors';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Celebrations } from './celebrations';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly inFlight = signal(0);
  private readonly navigating = signal(false);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly isLoading = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private updateVisibility() {
    const active = this.inFlight() > 0 || this.navigating();
    if (!active) {
      this.clearTimer();
      this.isLoading.set(false);
    } else if (this.browser && !this.isLoading() && this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        if (this.inFlight() > 0 || this.navigating()) this.isLoading.set(true);
      }, 150);
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
  readonly loadingService = inject(LoadingService);
  private readonly publicReads = new Map<string, { expires: number; value: Promise<unknown> }>();

  private track<T>(request: Observable<T>): Promise<T> {
    this.loadingService.start();
    return firstValueFrom(request.pipe(timeout({ first: 90_000 }))).finally(() => this.loadingService.stop());
  }

  get<T>(path: string) {
    if (path !== 'life-areas')
      return this.track(this.http.get<T>(`/api/${path}`, { withCredentials: true }));
    const cached = this.publicReads.get(path);
    if (cached && cached.expires > Date.now()) return cached.value as Promise<T>;
    const value = this.track(
      this.http.get<T>(`/api/${path}`, { withCredentials: true }),
    ).catch((error) => {
        this.publicReads.delete(path);
        throw error;
      });
    this.publicReads.set(path, { expires: Date.now() + 300000, value });
    return value;
  }
  post<T>(path: string, body: unknown = {}) {
    return this.track(
      this.http.post<T>(`/api/${path}`, body, { withCredentials: true })).then((result) => {
        this.celebrations.receive(result);
        return result;
      });
  }
  patch<T>(path: string, body: unknown) {
    return this.track(
      this.http.patch<T>(`/api/${path}`, body, { withCredentials: true })).then(
        (result) => {
          this.celebrations.receive(result);
          return result;
        },
      );
  }
  put<T>(path: string, body: unknown = {}) {
    return this.track(this.http.put<T>(`/api/${path}`, body, { withCredentials: true }));
  }
  delete<T>(path: string) {
    return this.track(this.http.delete<T>(`/api/${path}`, { withCredentials: true }));
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
      if (request === this.request) this.error.set(errorMessage(error));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
@Injectable({ providedIn: 'root' })
export class Toasts {
  private readonly messages = inject(MessageService);
  success(summary: string, detail?: string) {
    this.messages.add({ severity: 'success', summary, detail, life: 3500 });
  }
  error(error: unknown) {
    this.messages.add({ severity: 'error', summary: errorMessage(error), life: 6000 });
  }
}
