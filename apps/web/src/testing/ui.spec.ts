import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorState, GlobalLoader, Pagination, Progress, Skeleton } from '@mirhal/ui';
import { FormField } from '@mirhal/forms';
import { LocalizedDatePipe, Preferences } from '@mirhal/utilities';
import { Celebrations, LoadingService } from '@mirhal/data-access';
import { LevelCelebration } from '@mirhal/ui/level-celebration';
import { ActivityChart } from '../app/features/analytics/activity-chart';
import { provideRouter } from '@angular/router';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { MirhalTranslationLoader } from '@mirhal/i18n';
import { firstValueFrom } from 'rxjs';

describe('Accessible shared components', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        LocalizedDatePipe,
        provideRouter([]),
        provideTranslateService({ loader: provideTranslateLoader(MirhalTranslationLoader) }),
      ],
    });
    await firstValueFrom(TestBed.inject(TranslateService).use('ar'));
  });
  it('localizes standard habit units while preserving custom units', () => {
    const preferences = TestBed.inject(Preferences);
    preferences.language.set('ar');
    expect(preferences.habitUnit('times')).toBe('مرات');
    expect(preferences.habitUnit('minutes')).toBe('دقائق');
    expect(preferences.habitUnit('pages')).toBe('صفحات');
    expect(preferences.habitUnit('steps')).toBe('steps');
    preferences.language.set('en');
    expect(preferences.habitUnit('مرات')).toBe('times');
    expect(preferences.habitUnit('دقائق')).toBe('minutes');
    expect(preferences.habitUnit('صفحات')).toBe('pages');
  });
  it('renders reusable pagination with accessible boundaries and emits one page change', () => {
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('total', 60);
    fixture.componentRef.setInput('limit', 25);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    const current = fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLElement;
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const changes: number[] = [];
    fixture.componentInstance.change.subscribe((page) => changes.push(page));

    expect(nav.getAttribute('aria-label')).toBeTruthy();
    expect(current.textContent.trim()).toBe('2 / 3');
    expect(buttons.item(0).disabled).toBe(false);
    expect(buttons.item(1).disabled).toBe(false);
    buttons.item(0).click();
    fixture.detectChanges();

    expect(changes).toEqual([1]);
  });
  it('disables pagination at both boundaries and hides it when the page count is one', () => {
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('total', 30);
    fixture.componentRef.setInput('limit', 25);
    fixture.detectChanges();

    let buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(buttons.item(0).disabled).toBe(true);
    expect(buttons.item(1).disabled).toBe(false);

    fixture.componentRef.setInput('page', 2);
    fixture.detectChanges();
    buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(buttons.item(0).disabled).toBe(false);
    expect(buttons.item(1).disabled).toBe(true);

    fixture.componentRef.setInput('total', 25);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });
  it('safely hides pagination for empty results and invalid page sizes', () => {
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();

    fixture.componentRef.setInput('total', 30);
    fixture.componentRef.setInput('limit', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });
  it('updates translated pagination labels and direction when the language changes', async () => {
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('total', 50);
    fixture.detectChanges();
    const preferences = TestBed.inject(Preferences);
    const translations = TestBed.inject(TranslateService);

    preferences.setLanguage('en');
    await firstValueFrom(translations.use('en'));
    fixture.detectChanges();
    const previous = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(previous.getAttribute('aria-label')).toBe('Previous page');
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
      'Pagination',
    );
    expect(
      fixture.nativeElement.querySelectorAll('button').item(1).getAttribute('aria-label'),
    ).toBe('Next page');
    expect(document.documentElement.dir).toBe('ltr');

    preferences.setLanguage('ar');
    await firstValueFrom(translations.use('ar'));
    fixture.detectChanges();
    expect(previous.getAttribute('aria-label')).toBe('الصفحة السابقة');
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
      'التنقل بين الصفحات',
    );
    expect(
      fixture.nativeElement.querySelectorAll('button').item(1).getAttribute('aria-label'),
    ).toBe('الصفحة التالية');
    expect(document.documentElement.dir).toBe('rtl');
  });
  it('formats dates in the selected language without shifting date-only values', () => {
    const pipe = TestBed.inject(LocalizedDatePipe);
    const preferences = TestBed.inject(Preferences);
    preferences.language.set('ar');
    const arabic = pipe.transform('2026-10-04', 'MMM d, y');
    expect(arabic).not.toContain('Oct');
    preferences.language.set('en');
    expect(pipe.transform('2026-10-04', 'MMM d, y')).toContain('Oct 4, 2026');
  });
  it('localizes chart accessibility text in both directions', async () => {
    const fixture = TestBed.createComponent(ActivityChart);
    fixture.componentRef.setInput('items', [{ date: '2026-10-04', habits: 1, checkIn: true }]);
    const preferences = TestBed.inject(Preferences);
    preferences.language.set('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toContain(
      'خطوات العادات',
    );
    await firstValueFrom(TestBed.inject(TranslateService).use('en'));
    preferences.language.set('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toContain(
      'Habit actions',
    );
  });
  it('announces an earned level without a modal and allows dismissal', () => {
    const fixture = TestBed.createComponent(LevelCelebration);
    const state = TestBed.inject(Celebrations);
    state.receive({ levelUp: { number: 2, title: 'Finding rhythm', titleAr: 'مستمر' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('مستمر');
    TestBed.inject(Preferences).language.set('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain(
      'Finding rhythm',
    );
    expect(fixture.nativeElement.querySelector('[role=dialog]')).toBeNull();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
  });
  it('clamps progress while exposing a named accessible value', () => {
    const fixture = TestBed.createComponent(Progress);
    fixture.componentRef.setInput('value', 180);
    fixture.componentRef.setInput('label', 'Weekly quest');
    fixture.detectChanges();
    const progress = fixture.nativeElement.querySelector('[role=progressbar]') as HTMLElement;
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.getAttribute('aria-label')).toBe('Weekly quest');
    fixture.componentRef.setInput('value', -20);
    fixture.detectChanges();
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
  });
  it('uses localized accessible defaults for progress and loading', async () => {
    const preferences = TestBed.inject(Preferences);
    preferences.language.set('ar');
    const progress = TestBed.createComponent(Progress);
    progress.detectChanges();
    expect(
      progress.nativeElement.querySelector('[role=progressbar]').getAttribute('aria-label'),
    ).toBe('التقدم');
    const skeleton = TestBed.createComponent(Skeleton);
    skeleton.detectChanges();
    expect(
      skeleton.nativeElement.querySelector('[aria-busy=true]').getAttribute('aria-label'),
    ).toBe('جارٍ التحميل');
    preferences.setLanguage('en');
    await firstValueFrom(TestBed.inject(TranslateService).use('en'));
    progress.detectChanges();
    skeleton.detectChanges();
    expect(
      progress.nativeElement.querySelector('[role=progressbar]').getAttribute('aria-label'),
    ).toBe('Progress');
    expect(
      skeleton.nativeElement.querySelector('[aria-busy=true]').getAttribute('aria-label'),
    ).toBe('Loading');
  });
  it('emits retry from the accessible error state', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('message', 'Could not load');
    fixture.detectChanges();
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    fixture.nativeElement.querySelector('button').click();
    expect(retry).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Could not load',
    );
  });
  it('does not duplicate the projected input ID on field hosts', () => {
    const fixture = TestBed.createComponent(FormField);
    fixture.componentRef.setInput('id', 'habit-name');
    fixture.componentRef.setInput('label', 'Habit');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('id')).toBeNull();
    expect(fixture.nativeElement.querySelector('label').htmlFor).toBe('habit-name');
  });
  it('announces loading without interactive placeholders', () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-busy=true]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
  it('supports disabling skeleton animation via input or static class', () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.componentRef.setInput('animate', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.skeleton-static')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
  it('applies Arabic direction, theme and reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const preferences = TestBed.inject(Preferences);
    preferences.setLanguage('ar');
    preferences.setTheme('dark');
    preferences.setReducedMotion(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(preferences.t('Read', 'اقرأ')).toBe('اقرأ');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    preferences.setLanguage('en');
    preferences.setTheme('light');
    preferences.setReducedMotion(false);
    vi.unstubAllGlobals();
  });
  it('tracks the operating-system theme only while the preference is system', () => {
    const preferences = TestBed.inject(Preferences);
    preferences.setTheme('system');
    preferences.systemPrefersDark.set(true);
    expect(preferences.resolvedTheme()).toBe('dark');
    preferences.systemPrefersDark.set(false);
    expect(preferences.resolvedTheme()).toBe('light');
    preferences.setTheme('dark');
    preferences.systemPrefersDark.set(false);
    expect(preferences.resolvedTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    preferences.setTheme('light');
    expect(preferences.resolvedTheme()).toBe('light');
  });

  it('prevents flicker on fast operations by delaying display threshold', async () => {
    const loading = TestBed.inject(LoadingService);
    loading.reset();

    // Fast request finishes in 30ms (< 150ms delay)
    loading.start();
    expect(loading.isLoading()).toBe(true);
    expect(loading.showTopBar()).toBe(false);
    expect(loading.showOverlay()).toBe(false);

    await new Promise((r) => setTimeout(r, 40));
    loading.stop();
    expect(loading.isLoading()).toBe(false);

    // Give time to ensure it never popped up
    await new Promise((r) => setTimeout(r, 160));
    expect(loading.showTopBar()).toBe(false);
    expect(loading.showOverlay()).toBe(false);
  });

  it('renders official MIRHAL branded loader on blocking operations', async () => {
    const loading = TestBed.inject(LoadingService);
    loading.reset();

    const fixture = TestBed.createComponent(GlobalLoader);
    loading.startBlocking();

    // Wait past the blocking delay (50ms)
    await new Promise((r) => setTimeout(r, 70));
    fixture.detectChanges();

    expect(loading.showOverlay()).toBe(true);
    const element: HTMLElement = fixture.nativeElement;
    const overlay = element.querySelector('[role="status"]');
    expect(overlay).toBeTruthy();
    expect(element.querySelector('img[src="/mirhal-mark.svg"]')).toBeTruthy();
    expect(element.textContent).toContain('MIRHAL');
    expect(element.textContent).toContain('مِرحال');

    loading.stopBlocking();
    loading.reset();
  });
});
