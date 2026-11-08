import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Api, ApiErrors, Remote, Celebrations } from '@mirhal/data-access';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

describe('HTTP state and race handling', () => {
  let language: 'en' | 'ar';
  beforeEach(() => {
    language = 'en';
    const messages = {
      en: {
        'errors.offline': 'You seem to be offline. Check your connection and try again.',
        'errors.generic': 'We could not complete that action. Please try again.',
        'errors.accessDenied': 'This action is not available to your account right now.',
        'errors.server.emailPasswordIncorrect': 'Email or password is incorrect.',
        'errors.server.linkExpiredAlreadyBeenUsed':
          'This link has expired or has already been used.',
        'errors.server.invitationNoLongerActive': 'This invitation is no longer active.',
      },
      ar: {
        'errors.offline': 'يبدو أنك غير متصل. تحقق من اتصالك وحاول مجدداً.',
        'errors.generic': 'تعذر إتمام الإجراء الآن. حاول مرة أخرى.',
        'errors.accessDenied': 'هذا الإجراء غير متاح لحسابك حالياً.',
        'errors.server.emailPasswordIncorrect': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        'errors.server.linkExpiredAlreadyBeenUsed': 'انتهت صلاحية هذا الرابط أو استُخدم بالفعل.',
        'errors.server.invitationNoLongerActive': 'هذه الدعوة لم تعد نشطة.',
      },
    };
    const translations = {
      get currentLang() {
        return () => language;
      },
      instant: (key: string) => messages[language][key as keyof (typeof messages)['en']] ?? key,
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: translations },
      ],
    });
  });
  it('attaches credentials and supplies resource loading/success state', async () => {
    const api = TestBed.inject(Api);
    const remote = new Remote<{ title: string }>(api, 'goals');
    const pending = remote.load();
    expect(remote.loading()).toBe(true);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/goals');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ title: 'Grow' });
    await pending;
    expect(remote.data()?.title).toBe('Grow');
    expect(remote.loading()).toBe(false);
  });
  it('ignores stale requests when filtering changes quickly', async () => {
    const remote = new Remote<string[]>(TestBed.inject(Api), 'habits');
    const first = remote.load();
    const second = remote.load('habits?areaId=mind');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/habits?areaId=mind').flush(['Read']);
    await second;
    http.expectOne('/api/habits').flush(['Walk']);
    await first;
    expect(remote.data()).toEqual(['Read']);
  });
  it('preserves successful data on errors and supports retry', async () => {
    const remote = new Remote<string[]>(TestBed.inject(Api), 'goals');
    const http = TestBed.inject(HttpTestingController);
    let pending = remote.load();
    http.expectOne('/api/goals').flush(['Goal']);
    await pending;
    pending = remote.load();
    http
      .expectOne('/api/goals')
      .flush({ message: 'Try again later.' }, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(remote.error()).toBe('Try again later.');
    expect(remote.data()).toEqual(['Goal']);
    pending = remote.load();
    http.expectOne('/api/goals').flush([]);
    await pending;
    expect(remote.error()).toBe('');
    expect(remote.data()).toEqual([]);
  });
  it('maps network and unexpected errors to safe messages', () => {
    const errors = TestBed.inject(ApiErrors);
    expect(errors.message(new HttpErrorResponse({ status: 0 }))).toContain('offline');
    expect(errors.message(new Error('private stack trace'))).not.toContain('private');
  });
  it('explains Arabic network and authorization errors without exposing internals', () => {
    language = 'ar';
    const errors = TestBed.inject(ApiErrors);
    expect(errors.message(new HttpErrorResponse({ status: 0 }))).toContain('غير متصل');
    expect(errors.message(new HttpErrorResponse({ status: 403 }))).toContain('غير متاح');
    expect(errors.message(new Error('private detail'))).not.toContain('private');
  });
  it('preserves specific authentication and recovery guidance in Arabic', () => {
    language = 'ar';
    const errors = TestBed.inject(ApiErrors);
    expect(
      errors.message(
        new HttpErrorResponse({
          status: 401,
          error: { message: 'Email or password is incorrect.' },
        }),
      ),
    ).toBe('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    expect(
      errors.message(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'This link has expired or has already been used.' },
        }),
      ),
    ).toBe('انتهت صلاحية هذا الرابط أو استُخدم بالفعل.');
    expect(
      errors.message(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'This invitation is no longer active.' },
        }),
      ),
    ).toBe('هذه الدعوة لم تعد نشطة.');
  });
  it('shows only server-reported level transitions and keeps duplicate actions quiet', async () => {
    const api = TestBed.inject(Api);
    const celebrations = TestBed.inject(Celebrations);
    const http = TestBed.inject(HttpTestingController);
    const complete = api.post('habits/example/complete');
    http
      .expectOne('/api/habits/example/complete')
      .flush({ awarded: 30, levelUp: { number: 2, title: 'Finding rhythm', titleAr: 'مستمر' } });
    await complete;
    expect(celebrations.level()?.number).toBe(2);
    celebrations.dismiss();
    const duplicate = api.post('habits/example/complete');
    http.expectOne('/api/habits/example/complete').flush({ awarded: 0, duplicate: true });
    await duplicate;
    expect(celebrations.level()).toBeNull();
  });
});
