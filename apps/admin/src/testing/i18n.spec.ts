import { TestBed } from '@angular/core/testing';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { MirhalTranslationLoader } from '@lifequest/i18n';
import { Preferences } from '@lifequest/utilities';
import { beforeEach, describe, expect, it } from 'vitest';

function keys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('Admin shared translations', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(MirhalTranslationLoader),
          fallbackLang: 'en',
        }),
      ],
    });
  });

  it('loads matching Arabic and English catalog structures', async () => {
    const loader = new MirhalTranslationLoader();
    const [ar, en] = await Promise.all([
      firstValueFrom(loader.getTranslation('ar')),
      firstValueFrom(loader.getTranslation('en')),
    ]);
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('switches Admin copy at runtime and synchronizes persisted document direction', async () => {
    const translations = TestBed.inject(TranslateService);
    const preferences = TestBed.inject(Preferences);

    preferences.setLanguage('en');
    await firstValueFrom(translations.use('en'));
    expect(translations.instant('admin.navigation.overview')).toBe('Overview');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('lq-language')).toBe('en');

    preferences.setLanguage('ar');
    await firstValueFrom(translations.use('ar'));
    expect(translations.instant('admin.navigation.overview')).toBe('نظرة عامة');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('lq-language')).toBe('ar');
  });
});
