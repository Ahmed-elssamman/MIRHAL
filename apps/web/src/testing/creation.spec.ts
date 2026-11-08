import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from '@mirhal/data-access';
import { DiscardChanges } from '@mirhal/forms';
import { Preferences } from '@mirhal/utilities';
import { GoalsPage } from '../app/features/goals/goals';
import { HabitsPage } from '../app/features/habits/habits';
import { QuestsPage } from '../app/features/quests/quests';

describe('Creation while reference data is still loading', () => {
  const error = vi.fn();
  beforeEach(() => {
    error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Toasts, useValue: { error } },
        { provide: DiscardChanges, useValue: {} },
        {
          provide: Preferences,
          useValue: { t: (english: string) => english, habitUnit: (value: string) => value },
        },
      ],
    });
  });
  for (const Page of [GoalsPage, HabitsPage, QuestsPage]) {
    it(`${Page.name} waits for life areas before opening a valid editor`, async () => {
      const page = TestBed.runInInjectionContext(() => new Page());
      const pending = page.create();
      expect(page.open()).toBe(false);
      TestBed.inject(HttpTestingController)
        .expectOne('/api/life-areas')
        .flush([{ id: 'growth' }]);
      await pending;
      expect(page.open()).toBe(true);
      expect(page.form.controls.areaId.value).toBe('growth');
      expect(page.form.controls.areaId.valid).toBe(true);
      expect(error).not.toHaveBeenCalled();
    });
    it(`${Page.name} explains unavailable life areas and can retry`, async () => {
      const page = TestBed.runInInjectionContext(() => new Page());
      const http = TestBed.inject(HttpTestingController);
      const pending = page.create();
      http.expectOne('/api/life-areas').flush({}, { status: 503, statusText: 'Unavailable' });
      await pending;
      expect(page.open()).toBe(false);
      expect(error).toHaveBeenCalled();
      const retry = page.create();
      http.expectOne('/api/life-areas').flush([{ id: 'growth' }]);
      await retry;
      expect(page.open()).toBe(true);
    });
  }
});
