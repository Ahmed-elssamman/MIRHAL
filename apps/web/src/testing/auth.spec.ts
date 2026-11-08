import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  convertToParamMap,
} from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, authGuard, adminGuard, unauthGuard } from '@mirhal/auth';
import { Api, User } from '@mirhal/data-access';
import { sessionInterceptor } from '@mirhal/auth';
import { MessageService } from 'primeng/api';
const user: User = {
  id: 'u1',
  email: 'unit@example.test',
  role: 'USER',
  emailVerifiedAt: null,
  createdAt: '2026-09-01',
  profile: {
    displayName: 'Explorer',
    bio: '',
    timezone: 'UTC',
    language: 'en',
    theme: 'light',
    profileVisibility: 'PRIVATE',
    shareChallengeScore: true,
    shareStreak: false,
    notificationsEnabled: true,
    reducedMotion: false,
    preferredRoutine: 'morning',
    onboardingCompletedAt: null,
    avatarUrl: null,
  },
};
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([sessionInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      MessageService,
    ],
  });
});
afterEach(() => {
  TestBed.inject(HttpTestingController).verify();
  vi.unstubAllGlobals();
});
describe('Authentication state and navigation', () => {
  it('keeps registration authenticated and exposes a verification retry when delivery fails', async () => {
    const auth = TestBed.inject(AuthStore);
    const pending = auth.register({
      email: user.email,
      password: 'a-long-test-password',
      displayName: 'Explorer',
      timezone: 'UTC',
    });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/register')
      .flush({ user, verificationEmail: 'unavailable' });
    expect((await pending).verificationEmail).toBe('unavailable');
    expect(auth.user()).toEqual(user);
  });
  it('ignores a session response that arrives after session invalidation', async () => {
    const auth = TestBed.inject(AuthStore);
    const pending = auth.load();
    auth.clearSession();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/me').flush(user);
    expect(await pending).toBeNull();
    expect(auth.user()).toBeNull();
  });
  it('keeps the session visible when logout fails so the user can retry', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.setUser(user);
    const pending = auth.logout();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/logout')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.user()).toEqual(user);
  });
  it('persists the header language choice and preserves it on session reload', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.setUser(user);
    const pending = auth.changeLanguage();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/profile');
    expect(request.request.body).toEqual({ language: 'ar' });
    request.flush({ language: 'ar' });
    await pending;
    expect(auth.user()?.profile.language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    auth.setUser({ ...user, profile: { ...user.profile, language: 'ar' } });
    expect(document.documentElement.lang).toBe('ar');
  });
  it('coalesces concurrent session loading', async () => {
    const auth = TestBed.inject(AuthStore);
    const a = auth.load(),
      b = auth.load();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/me').flush(user);
    expect(await a).toEqual(user);
    expect(await b).toEqual(user);
  });
  it('redirects guests and prevents ordinary users entering administration', async () => {
    const route = {} as ActivatedRouteSnapshot,
      state = {} as RouterStateSnapshot;
    const guest = TestBed.runInInjectionContext(() => authGuard(route, state));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(
      TestBed.inject(Router).serializeUrl((await guest) as ReturnType<Router['createUrlTree']>),
    ).toBe('/auth/login');
    TestBed.inject(AuthStore).setUser(user);
    const denied = await TestBed.runInInjectionContext(() => adminGuard(route, state));
    expect(denied).not.toBe(true);
    TestBed.inject(AuthStore).setUser({ ...user, role: 'ADMIN' });
    expect(await TestBed.runInInjectionContext(() => adminGuard(route, state))).toBe(true);
  });
  it('preserves an invitation opened by a signed-in user without accepting it automatically', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.setUser({
      ...user,
      emailVerifiedAt: '2026-10-30',
      profile: { ...user.profile, onboardingCompletedAt: '2026-10-30' },
    });
    const route = {
      paramMap: convertToParamMap({ mode: 'register' }),
      queryParamMap: convertToParamMap({ inviteToken: 'invitation-token' }),
      data: {},
    } as ActivatedRouteSnapshot;
    const pending = TestBed.runInInjectionContext(() =>
      unauthGuard(route, {} as RouterStateSnapshot),
    );
    const tree = (await pending) as ReturnType<Router['createUrlTree']>;
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/friends?inviteToken=invitation-token');
  });
  it('clears stale sessions when a protected request expires and refresh fails', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.setUser(user);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const pending = TestBed.inject(Api)
      .get('goals')
      .catch((error: unknown) => error);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/goals')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await pending).toBeInstanceOf(HttpErrorResponse);
    expect(auth.user()).toBeNull();
    expect(auth.status()).toBe('unauthenticated');
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it('keeps the session when a refreshed request fails for a non-authentication reason', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.setUser(user);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const pending = TestBed.inject(Api)
      .get('goals')
      .catch((error: unknown) => error);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/goals').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 10));
    http.expectOne('/api/goals').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await pending).toBeInstanceOf(HttpErrorResponse);
    expect(auth.user()).toEqual(user);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('retries request when token refresh succeeds', async () => {
    const auth = TestBed.inject(AuthStore);
    auth.setUser(user);
    const pending = TestBed.inject(Api).get<{ items: [] }>('goals');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/goals')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    TestBed.inject(HttpTestingController).expectOne('/api/auth/refresh').flush({ user });
    await new Promise((resolve) => setTimeout(resolve, 10));
    TestBed.inject(HttpTestingController).expectOne('/api/goals').flush({ items: [] });
    expect(await pending).toEqual({ items: [] });
    expect(auth.status()).toBe('authenticated');
  });
  it('coalesces only safe reference reads', async () => {
    const api = TestBed.inject(Api);
    const a = api.get('life-areas'),
      b = api.get('life-areas');
    TestBed.inject(HttpTestingController).expectOne('/api/life-areas').flush([]);
    expect(await a).toEqual([]);
    expect(await b).toEqual([]);
    expect(await api.get('life-areas')).toEqual([]);
  });
});
