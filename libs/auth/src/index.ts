import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, exhaustMap, filter, from, timer } from 'rxjs';
import { Injectable, inject, signal, PLATFORM_ID, DestroyRef } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { Api, User, Celebrations, errorMessage } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(Api);
  private readonly celebrations = inject(Celebrations);
  private readonly preferences = inject(Preferences);
  readonly user = signal<User | null>(null);
  readonly status = signal<AuthStatus>('initializing');
  readonly verificationDeliveryFailed = signal(false);
  dismissVerificationNotice() {
    this.verificationDeliveryFailed.set(false);
  }
  readonly languageSaving = signal(false);
  readonly languageError = signal('');
  private loading?: Promise<User | null>;
  private refreshing?: Promise<boolean>;
  private revision = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      timer(30 * 60_000, 30 * 60_000)
        .pipe(
          filter(() => !!this.user()),
          exhaustMap(() => from(this.refresh()).pipe(catchError(() => EMPTY))),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();
    }
  }

  async load(): Promise<User | null> {
    if (this.status() === 'authenticated' && this.user()) return this.user();
    if (this.loading) return this.loading;
    const revision = this.revision;
    this.loading = this.api
      .get<User>('auth/me')
      .then((user) => {
        if (revision === this.revision) {
          this.setUser(user);
        }
        return this.user();
      })
      .catch(() => {
        if (revision === this.revision) {
          this.user.set(null);
          this.status.set('unauthenticated');
        }
        return null;
      })
      .finally(() => {
        this.loading = undefined;
      });
    return this.loading;
  }

  async refresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    const revision = this.revision;
    this.refreshing = this.api
      .post<{ user: User }>('auth/refresh')
      .then((result) => {
        if (revision === this.revision && result?.user) {
          this.setUser(result.user);
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        this.refreshing = undefined;
      });
    return this.refreshing;
  }

  setUser(user: User) {
    this.revision++;
    this.user.set(user);
    this.status.set('authenticated');
    this.preferences.setLanguage(user.profile.language);
    this.preferences.setTheme(user.profile.theme);
    this.preferences.setReducedMotion(user.profile.reducedMotion);
  }

  async changeLanguage() {
    if (this.languageSaving() || !this.user()) return;
    this.languageSaving.set(true);
    this.languageError.set('');
    const language = this.preferences.rtl() ? 'en' : 'ar';
    try {
      await this.api.patch('profile', { language });
      this.user.update((user) =>
        user ? { ...user, profile: { ...user.profile, language } } : null,
      );
      this.preferences.setLanguage(language);
    } catch (error) {
      this.languageError.set(errorMessage(error));
    } finally {
      this.languageSaving.set(false);
    }
  }

  async login(email: string, password: string) {
    const result = await this.api.post<{ user: User }>('auth/login', { email, password });
    this.setUser(result.user);
    return result.user;
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    timezone: string;
    language?: 'ar' | 'en';
    inviteToken?: string;
  }) {
    const result = await this.api.post<{
      user: User;
      verificationEmail: 'accepted' | 'disabled' | 'unavailable';
    }>('auth/register', { ...input, language: input.language ?? this.preferences.language() });
    this.setUser(result.user);
    this.verificationDeliveryFailed.set(result.verificationEmail === 'unavailable');
    return result;
  }

  async logout() {
    await this.api.post('auth/logout');
    this.clearSession();
  }

  clearSession() {
    this.revision++;
    this.user.set(null);
    this.status.set('unauthenticated');
    this.verificationDeliveryFailed.set(false);
    this.celebrations.dismiss();
  }
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const user = await auth.load();
  return user ? true : router.createUrlTree(['/auth/login']);
};

export const onboardingCompleteGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const user = await auth.load();
  if (!user) return router.createUrlTree(['/auth/login']);
  return user.profile.onboardingCompletedAt ? true : router.createUrlTree(['/onboarding']);
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const user = await auth.load();
  return user && user.role !== 'USER' ? true : router.createUrlTree(['/auth/login']);
};

export const unauthGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const user = await auth.load();
  if (!user) return true;
  const mode = route.paramMap.get('mode') ?? 'login';
  if (mode === 'login' || mode === 'register') {
    const isAdmin = route.data['admin'] === true;
    return router.createUrlTree([
      isAdmin && user.role !== 'USER'
        ? '/overview'
        : user.profile.onboardingCompletedAt
          ? '/today'
          : '/onboarding',
    ]);
  }
  return true;
};
