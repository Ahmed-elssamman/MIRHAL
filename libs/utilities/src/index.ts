import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Pipe,
  PipeTransform,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
@Injectable({ providedIn: 'root' })
export class Preferences {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly translations = inject(TranslateService, { optional: true });
  private navigationOwner: string | null = null;
  readonly language = signal<'en' | 'ar'>('ar');
  readonly theme = signal<'light' | 'dark' | 'system'>('system');
  readonly systemPrefersDark = signal(false);
  readonly showAdditionalNavigation = signal<boolean>(false);
  readonly resolvedTheme = computed(() =>
    this.theme() === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : this.theme(),
  );
  readonly rtl = computed(() => this.language() === 'ar');
  constructor() {
    const destroy = inject(DestroyRef);
    if (this.browser) {
      try {
        const language = localStorage.getItem('lq-language');
        if (language === 'ar' || language === 'en') this.language.set(language);
        const theme = localStorage.getItem('lq-theme');
        if (theme === 'dark' || theme === 'light') this.theme.set(theme);
        const showAdditional = localStorage.getItem('lq-show-additional-nav');
        if (showAdditional !== null) this.showAdditionalNavigation.set(showAdditional === 'true');
      } catch {
        /* Private browsing may disable storage. */
      }
      const scheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
      if (scheme) {
        this.systemPrefersDark.set(scheme.matches);
        const apply = (event: MediaQueryListEvent | MediaQueryList) => {
          this.systemPrefersDark.set(event.matches);
          this.apply();
        };
        if (scheme.addEventListener) {
          scheme.addEventListener('change', apply);
          destroy.onDestroy(() => scheme.removeEventListener('change', apply));
        } else {
          scheme.addListener(apply);
          destroy.onDestroy(() => scheme.removeListener(apply));
        }
      }
      this.apply();
    }
  }
  t(en: string, ar: string) {
    const key = `common.fallbacks.${this.fallbackKey(en)}`;
    const translated = this.translations?.instant(key);
    if (translated === (this.rtl() ? ar : en)) return translated;
    return this.rtl() ? ar : en;
  }
  private fallbackKey(value: string) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'copy';
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return `${slug}_${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
  habitUnit(value: string) {
    switch (value.trim().toLowerCase()) {
      case 'times':
      case 'مرات':
        return this.t('times', 'مرات');
      case 'minutes':
      case 'دقائق':
        return this.t('minutes', 'دقائق');
      case 'pages':
      case 'صفحات':
        return this.t('pages', 'صفحات');
      default:
        return value;
    }
  }
  label(value: string) {
    const key = 'common.labels.' + value.toLowerCase().replaceAll('-', '_');
    const translated = this.translations?.instant(key);
    if (translated && translated !== key) return translated;
    return this.rtl() ? value.replaceAll('_', ' ') : value.replaceAll('_', ' ').toLowerCase();
  }
  setLanguage(value: 'en' | 'ar') {
    this.language.set(value);
    this.persist('lq-language', value);
    this.apply();
    void this.translations?.use(value).subscribe({
      error: (error: unknown) => console.error('Could not load language translations.', error),
    });
  }
  setTheme(value: 'light' | 'dark' | 'system') {
    this.theme.set(value);
    this.persist('lq-theme', value);
    this.apply();
  }
  setShowAdditionalNavigation(value: boolean) {
    this.showAdditionalNavigation.set(value);
    this.persist('lq-show-additional-nav', String(value));
  }
  applyAccountNavigation(userId: string, value: boolean | null | undefined) {
    let fallback = this.showAdditionalNavigation();
    if (this.navigationOwner && this.navigationOwner !== userId) fallback = false;
    if (this.browser) {
      try {
        const owner = localStorage.getItem('lq-navigation-owner');
        if (owner && owner !== userId) fallback = false;
        localStorage.setItem('lq-navigation-owner', userId);
      } catch {
        // Storage may be unavailable; keep the in-memory preference for this session.
      }
    }
    this.navigationOwner = userId;
    this.setShowAdditionalNavigation(value ?? fallback);
  }
  setReducedMotion(value: boolean) {
    this.document.documentElement.classList.toggle('reduce-motion', value);
  }
  private persist(key: string, value: string) {
    if (this.browser) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Preferences remain available for this session. */
      }
    }
  }
  private apply() {
    const root = this.document.documentElement;
    root.lang = this.language();
    root.dir = this.rtl() ? 'rtl' : 'ltr';
    if (this.browser) {
      const dark = this.resolvedTheme() === 'dark';
      root.classList.toggle('dark', dark);
      root.dataset['themePreference'] = this.theme();
      root.style.colorScheme = dark ? 'dark' : 'light';
      this.document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#14211e' : '#0e7165');
    }
  }
}

@Pipe({ name: 'date', standalone: true, pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly preferences = inject(Preferences);
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();

  transform(value: Date | string | number | null | undefined, format = 'MMM d, y'): string {
    if (value === null || value === undefined || value === '') return '';
    const date =
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(
            Number(value.slice(0, 4)),
            Number(value.slice(5, 7)) - 1,
            Number(value.slice(8, 10)),
          )
        : value instanceof Date
          ? value
          : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const locale = this.preferences.language() === 'ar' ? 'ar-EG' : 'en-US';
    const key = `${locale}:${format}`;
    let formatter = this.formatters.get(key);
    if (!formatter) {
      const options: Intl.DateTimeFormatOptions =
        format === 'longDate'
          ? { dateStyle: 'long' }
          : format === 'MMM y'
            ? { month: 'short', year: 'numeric' }
            : format === 'EEEE, MMM d'
              ? { weekday: 'long', month: 'short', day: 'numeric' }
              : format === 'h:mm a'
                ? { hour: 'numeric', minute: '2-digit', hour12: true }
                : format === 'h:mm:ss a'
                  ? { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }
                  : format === 'MMM d, h:mm a'
                    ? {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      }
                    : {
                        month: 'short',
                        day: 'numeric',
                        ...(format === 'MMM d, y' ? { year: 'numeric' } : {}),
                      };
      formatter = new Intl.DateTimeFormat(locale, options);
      this.formatters.set(key, formatter);
    }
    return formatter.format(date);
  }
}
