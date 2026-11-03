import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState, Progress, Skeleton } from '@lifequest/ui';
import { FormField } from '@lifequest/forms';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Celebrations } from '@lifequest/data-access';
import { LevelCelebration } from '../../../../libs/ui/src/level-celebration';
import { ActivityChart } from '../app/features/analytics/activity-chart';
import { provideRouter } from '@angular/router';

describe('Accessible shared components', () => {
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
  it('formats dates in the selected language without shifting date-only values', () => {
    TestBed.configureTestingModule({ providers: [LocalizedDatePipe] });
    const pipe = TestBed.inject(LocalizedDatePipe);
    const preferences = TestBed.inject(Preferences);
    preferences.language.set('ar');
    const arabic = pipe.transform('2026-10-04', 'MMM d, y');
    expect(arabic).not.toContain('Oct');
    preferences.language.set('en');
    expect(pipe.transform('2026-10-04', 'MMM d, y')).toContain('Oct 4, 2026');
  });
  it('localizes chart accessibility text in both directions', () => {
    const fixture = TestBed.createComponent(ActivityChart);
    fixture.componentRef.setInput('items', [{ date: '2026-10-04', habits: 1, checkIn: true }]);
    const preferences = TestBed.inject(Preferences);
    preferences.language.set('ar');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toContain(
      'خطوات العادات',
    );
    preferences.language.set('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toContain(
      'Habit actions',
    );
  });
  it('announces an earned level without a modal and allows dismissal', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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
  it('uses localized accessible defaults for progress and loading', () => {
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
    preferences.language.set('en');
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
});
