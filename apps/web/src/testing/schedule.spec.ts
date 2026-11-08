import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { HabitScheduleFields } from '@mirhal/forms';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { MirhalTranslationLoader } from '@mirhal/i18n';
import { firstValueFrom } from 'rxjs';

describe('Reusable habit schedule fields', () => {
  it('lets a keyboard button choose days and marks unsaved work dirty', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: provideTranslateLoader(MirhalTranslationLoader) }),
      ],
    });
    await firstValueFrom(TestBed.inject(TranslateService).use('en'));
    const fixture = TestBed.createComponent(HabitScheduleFields);
    const frequency = new FormControl('DAILY', { nonNullable: true });
    const days = new FormControl<number[]>([], { nonNullable: true });
    fixture.componentRef.setInput('prefix', 'test-habit');
    fixture.componentRef.setInput('frequency', frequency);
    fixture.componentRef.setInput('scheduleDays', days);
    fixture.componentRef.setInput('weeklyTarget', new FormControl(3, { nonNullable: true }));
    await fixture.whenStable();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'CUSTOM';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain(
      'Choose at least one day',
    );
    const monday: HTMLButtonElement = fixture.nativeElement.querySelectorAll('button')[1];
    monday.click();
    await fixture.whenStable();
    expect(days.value).toEqual([1]);
    expect(days.dirty).toBe(true);
    expect(monday.getAttribute('aria-pressed')).toBe('true');
    monday.click();
    await fixture.whenStable();
    expect(days.value).toEqual([]);
    select.value = 'WEEKLY';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').getAttribute('max')).toBe('7');
  });
});
