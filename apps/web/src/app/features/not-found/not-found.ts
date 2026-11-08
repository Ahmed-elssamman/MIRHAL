import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Preferences } from '@mirhal/utilities';
import { Logo } from '@mirhal/ui';

@Component({
  selector: 'lq-not-found',
  imports: [TranslatePipe, RouterLink, Logo],
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <a routerLink="/"><lq-logo /></a>
      <p class="mt-12 text-sm font-semibold text-brand">404</p>
      <h1 class="mt-3 text-3xl font-semibold">
        {{ 'web.features.not-found.copy.this_page_could_not_be_found_dbc581f9' | translate }}
      </h1>
      <p class="mt-3 max-w-md text-sm leading-7 text-muted">
        {{
          'web.features.not-found.copy.check_the_address_or_return_to_the_mirhal_home_page_8638142e'
            | translate
        }}
      </p>
      <a routerLink="/" class="btn btn-primary mt-7">
        {{ 'web.features.not-found.copy.go_to_home_d93b3e07' | translate }}
      </a>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  readonly i18n = inject(Preferences);
}
