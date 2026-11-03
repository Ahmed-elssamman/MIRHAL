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
@Injectable({ providedIn: 'root' })
export class Preferences {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
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
    return this.rtl() ? ar : en;
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
    const labels: Record<string, string> = {
      ACTIVE: 'نشط',
      PLANNED: 'مخطط',
      PAUSED: 'متوقف',
      COMPLETED: 'مكتمل',
      ARCHIVED: 'مؤرشف',
      SCHEDULED: 'مجدول',
      INVITED: 'بانتظار الرد',
      ACCEPTED: 'مقبول',
      REJECTED: 'مرفوض',
      CANCELLED: 'ملغى',
      DRAFT: 'مسودة',
      PENDING: 'معلق',
      BLOCKED: 'محظور',
      HIGH: 'عالية',
      MEDIUM: 'متوسطة',
      LOW: 'منخفضة',
      SUBMITTED: 'مُرسل',
      REVIEWING: 'قيد المراجعة',
      IN_PROGRESS: 'جارٍ العمل',
      RESOLVED: 'تم الحل',
      CLOSED: 'مغلق',
      SUSPENDED: 'موقوف',
      DELETED: 'محذوف',
      USER: 'مستخدم',
      ADMIN: 'مدير',
      SUPER_ADMIN: 'مدير عام',
      MODERATOR: 'مشرف',
      SUPPORT: 'دعم',
      CONTENT_MANAGER: 'مدير محتوى',
      ANALYST: 'محلل',
      SCORE: 'منافسة النقاط',
      CONSISTENCY: 'منافسة الالتزام',
      IMPROVEMENT: 'منافسة التحسن',
      TARGET: 'تحدي الهدف',
      STREAK: 'تحدي الاستمرارية',
      COOPERATIVE: 'تحدٍ تعاوني',
      TODO: 'للقيام به',
      BUG: 'مشكلة تقنية',
      SUGGESTION: 'اقتراح',
      UX: 'تجربة الاستخدام',
      FEATURE: 'طلب ميزة',
      CONTENT: 'المحتوى',
      COMPLAINT: 'شكوى',
      OTHER: 'أخرى',
      signup: 'تسجيل حساب',
      onboarding_completed: 'إكمال البداية',
      goal_created: 'إنشاء هدف',
      project_created: 'إنشاء مشروع',
      task_completed: 'إكمال مهمة',
      habit_created: 'إنشاء عادة',
      habit_completed: 'إكمال عادة',
      daily_checkin_completed: 'تسجيل التأمل اليومي',
      quest_completed: 'إكمال مهمة أسبوعية',
      challenge_created: 'إنشاء تحدٍ',
      challenge_joined: 'الانضمام لتحدٍ',
      challenge_completed: 'إكمال تحدٍ',
      level_up: 'مستوى جديد',
      achievement_unlocked: 'إنجاز جديد',
      reward_redeemed: 'استبدال مكافأة',
      feedback_submitted: 'إرسال ملاحظة',
      personal: 'شخصية',
      drinks: 'مشروبات',
      food: 'طعام',
      movies: 'أفلام',
      gaming: 'ألعاب',
      books: 'كتب',
      shopping: 'تسوق',
      outings: 'خروجات',
      entertainment: 'ترفيه',
      relaxation: 'استرخاء',
      experiences: 'تجارب',
      technology: 'تقنية',
      fashion: 'أزياء',
    };
    return this.rtl()
      ? (labels[value] ?? value.replaceAll('_', ' '))
      : value.replaceAll('_', ' ').toLowerCase();
  }
  setLanguage(value: 'en' | 'ar') {
    this.language.set(value);
    this.persist('lq-language', value);
    this.apply();
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
