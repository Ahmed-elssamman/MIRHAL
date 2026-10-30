import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Preferences } from '@lifequest/utilities';
import { Celebrations, LoadingService } from '@lifequest/data-access';
import { LevelCelebration } from '../../../../libs/ui/src/level-celebration';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Overlays } from '../../../../libs/ui/src/overlays';
@Component({
  selector: 'lq-root',
  imports: [RouterOutlet, Overlays, LevelCelebration],
  template: `
    @if (loading.isLoading()) {
      <div
        role="progressbar"
        [attr.aria-label]="preferences.t('Loading page', 'جارٍ تحميل الصفحة')"
        class="fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden bg-brand/20 shadow-sm"
      >
        <div class="loading-bar h-full bg-brand"></div>
      </div>
    }
    <router-outlet />@defer (on idle) { <lq-overlays /> } @defer (when celebrations.level()) { <lq-level-celebration /> }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly celebrations = inject(Celebrations);
  readonly preferences = inject(Preferences);
  readonly loading = inject(LoadingService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  constructor() {
    effect(() => {
      const english = this.preferences.language() === 'en';
      this.updateMetadata(english);
    });
    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.loading.setNavigating(true);
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.loading.setNavigating(false);
          this.updateMetadata(this.preferences.language() === 'en');
        }
      });
  }

  private updateMetadata(english: boolean) {
    const path = (this.router.url.split(/[?#]/, 1)[0] ?? '').replace(/\/$/, '') || '/';
    const publicPage = path === '/' || path === '/help';
    const title =
      path === '/help'
        ? english
          ? 'How MIRHAL Works | Personal Growth, One Step at a Time'
          : 'كيف يعمل مِرحال | نمو شخصي خطوة بخطوة'
        : english
          ? 'MIRHAL | Your Life. Your Journey.'
          : 'مِرحال | حياتك، رحلتك';
    const description =
      path === '/help'
        ? english
          ? 'Learn how MIRHAL brings goals, projects, habits, and daily reflection together to support steady personal growth.'
          : 'تعرّف على كيفية جمع مِرحال بين الأهداف والمشروعات والعادات والتأمل اليومي لدعم نموك خطوة بخطوة.'
        : english
          ? 'MIRHAL helps you bring goals, habits, and everyday progress together, and grow at your own pace.'
          : 'مِرحال يساعدك على جمع أهدافك وعاداتك وتقدمك اليومي، والنمو وفق وتيرتك.';

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'robots',
      content: publicPage ? 'index,follow' : 'noindex,nofollow',
    });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:locale', content: english ? 'en_US' : 'ar_EG' });
    this.document.documentElement.lang = english ? 'en' : 'ar';
    this.document.documentElement.dir = english ? 'ltr' : 'rtl';
  }
}
