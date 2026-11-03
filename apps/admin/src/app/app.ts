import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Preferences } from '@lifequest/utilities';
import { RouterOutlet } from '@angular/router';
import { Overlays } from '../../../../libs/ui/src/overlays';
import { GlobalLoader } from '../../../../libs/ui/src/loader';
@Component({
  selector: 'lq-root',
  imports: [RouterOutlet, Overlays, GlobalLoader],
  template: '<lq-global-loader /><router-outlet />@defer (on idle) { <lq-overlays /> }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly loading = inject(LoadingService);
  private readonly preferences = inject(Preferences);
  private readonly document = inject(DOCUMENT);
  private readonly translations = inject(TranslateService);
  private readonly router = inject(Router);
  private navigationId = 0;
  constructor() {
    effect(() => {
      this.preferences.language();
      this.document.title = this.translations.instant('admin.metadata.title');
      this.document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', this.translations.instant('admin.metadata.description'));
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigationId = event.id;
        this.loading.setNavigating(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        if (event.id === this.navigationId) this.loading.setNavigating(false);
      }
    });
  }
}
