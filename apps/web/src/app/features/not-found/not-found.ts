import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Preferences } from '@lifequest/utilities';
import { Logo } from '@lifequest/ui';

@Component({
  selector: 'lq-not-found',
  imports: [RouterLink, Logo],
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <a routerLink="/"><lq-logo /></a>
      <p class="mt-12 text-sm font-semibold text-brand">404</p>
      <h1 class="mt-3 text-3xl font-semibold">
        {{ i18n.t('This page could not be found.', 'لم نعثر على هذه الصفحة.') }}
      </h1>
      <p class="mt-3 max-w-md text-sm leading-7 text-muted">
        {{
          i18n.t(
            'Check the address or return to the MIRHAL home page.',
            'تحقق من العنوان أو عد إلى الصفحة الرئيسية لمِرحال.'
          )
        }}
      </p>
      <a routerLink="/" class="btn btn-primary mt-7">
        {{ i18n.t('Go to home', 'العودة للرئيسية') }}
      </a>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  readonly i18n = inject(Preferences);
}
