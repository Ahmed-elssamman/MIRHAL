import { TestBed } from '@angular/core/testing';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { MirhalTranslationLoader } from '@mirhal/i18n';
import { Preferences } from '@mirhal/utilities';
import { beforeEach, describe, expect, it } from 'vitest';

function translationKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    translationKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('shared ngx-translate dictionaries', () => {
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

  it('keeps Arabic and English key structures aligned', async () => {
    const loader = new MirhalTranslationLoader();
    const [arabic, english] = await Promise.all([
      firstValueFrom(loader.getTranslation('ar')),
      firstValueFrom(loader.getTranslation('en')),
    ]);
    expect(translationKeys(arabic).sort()).toEqual(translationKeys(english).sort());
  });

  it('loads both languages and switches the translated value at runtime', async () => {
    const translations = TestBed.inject(TranslateService);
    const preferences = TestBed.inject(Preferences);

    await firstValueFrom(translations.use('en'));
    expect(translations.instant('settings.title')).toBe('Make yourself at home.');
    expect(translations.instant('auth.brandAdmin')).toBe('MIRHAL ADMINISTRATION');
    expect(translations.instant('auth.placeholders.email')).toBe('you@example.com');
    expect(translations.instant('common.productName')).toBe('MIRHAL');
    expect(translations.instant('common.xp')).toBe('XP');
    expect(translations.instant('shared.ui.completeHabit', { name: 'Walk' })).toBe('Complete Walk');
    expect(preferences.label('IN_PROGRESS')).toBe('in progress');
    expect(translations.instant('web.landing.pillars.direction.title')).toBe(
      'A direction that matters',
    );
    expect(translations.instant('web.features.help.redesign.slides.1.title')).toBe(
      'Start with a small intention',
    );
    expect(translations.instant('web.features.help.redesign.feedbackTitle')).toBe(
      'Your feedback can make MIRHAL better.',
    );
    expect(translations.instant('web.checkIn.moods.bright')).toBe('Bright');
    expect(translations.instant('web.feedback.categories.usability')).toBe('Make it easier to use');
    expect(translations.instant('web.challenges.modes.cooperative')).toBe('Better together');
    expect(translations.instant('web.challenges.sharing.progress')).toBe(
      'Share my progress percentage',
    );
    expect(translations.instant('web.habitLab.guidance.experiment.title')).toBe(
      'Try a smaller experiment',
    );
    expect(translations.instant('web.profile.avatars.dawn')).toBe('Dawn');
    expect(translations.instant('web.navigation.yourJourney')).toBe('YOUR JOURNEY');

    await firstValueFrom(translations.use('ar'));
    expect(translations.instant('settings.title')).toBe('اجعلها مساحتك المريحة.');
    expect(translations.instant('shared.ui.completeHabit', { name: 'المشي' })).toBe('إتمام المشي');
    expect(translations.instant('auth.brandAdmin')).toBe('إدارة رحلة التوازن');
    expect(preferences.label('IN_PROGRESS')).toBe('جارٍ العمل');
    expect(translations.instant('web.onboarding.steps.area.text')).toBe(
      'اختر جانباً واحداً من حياتك لتبدأ به. يمكنك إضافة مجالات أخرى أو تغييرها لاحقاً.',
    );
    expect(translations.instant('web.checkIn.moods.bright')).toBe('مشرق');
    expect(translations.instant('web.feedback.categories.usability')).toBe('اجعل الاستخدام أسهل');
    expect(translations.instant('web.challenges.modes.cooperative')).toBe('أفضل معاً');
    expect(translations.instant('web.challenges.sharing.progress')).toBe('مشاركة نسبة التقدم');
    expect(translations.instant('web.habitLab.guidance.experiment.title')).toBe('جرّب تجربة أصغر');
    expect(translations.instant('web.profile.avatars.dawn')).toBe('الفجر');
    expect(translations.instant('web.navigation.yourJourney')).toBe('رحلتك');
    expect(translations.instant('web.features.help.redesign.slides.1.title')).toBe(
      'ابدأ بنية صغيرة',
    );
    expect(translations.instant('web.features.help.redesign.feedbackTitle')).toBe(
      'رأيك يقدر يخلّي مِرحال أفضل.',
    );
    expect(translations.instant('web.features.landing.copy.begin_your_journey_55d0b609')).toBe(
      'ابدأ رحلتك',
    );
  });

  it('routes legacy bilingual copy through the shared catalog when available', async () => {
    const preferences = TestBed.inject(Preferences);
    const translations = TestBed.inject(TranslateService);

    preferences.setLanguage('en');
    await firstValueFrom(translations.use('en'));
    expect(preferences.t('Begin your journey', 'ابدأ رحلتك')).toBe('Begin your journey');
    preferences.setLanguage('ar');
    await firstValueFrom(translations.use('ar'));
    expect(preferences.t('Begin your journey', 'ابدأ رحلتك')).toBe('ابدأ رحلتك');
  });

  it('keeps the persisted language preference and document direction in sync', async () => {
    const preferences = TestBed.inject(Preferences);
    const translations = TestBed.inject(TranslateService);

    preferences.setLanguage('en');
    await firstValueFrom(translations.use('en'));

    expect(preferences.language()).toBe('en');
    expect(translations.currentLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
