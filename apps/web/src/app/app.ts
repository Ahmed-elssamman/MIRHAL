import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Preferences } from '@lifequest/utilities';
import { Celebrations, LoadingService } from '@lifequest/data-access';
import { LevelCelebration } from '@lifequest/ui/level-celebration';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Overlays } from '../../../../libs/ui/src/overlays';
import { GlobalLoader } from '../../../../libs/ui/src/loader';
@Component({
  selector: 'lq-root',
  imports: [RouterOutlet, Overlays, LevelCelebration, GlobalLoader],
  template: `
    <lq-global-loader />
    <router-outlet />
    @defer (on idle) {
      <lq-overlays />
    }
    @defer (when celebrations.level()) {
      <lq-level-celebration />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly celebrations = inject(Celebrations);
  readonly preferences = inject(Preferences);
  readonly loading = inject(LoadingService);
  readonly updates = inject(PwaUpdates);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly translations = inject(TranslateService);
  private navigationId = 0;
  constructor() {
    effect(() => {
      const english = this.preferences.language() === 'en';
      this.updateMetadata(english);
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
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
    const title = this.translations.instant(
      path === '/help' ? 'metadata.helpTitle' : 'metadata.title',
    );
    const description = this.translations.instant(
      path === '/help' ? 'metadata.helpDescription' : 'metadata.description',
    );

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
