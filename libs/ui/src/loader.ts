import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoadingService } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';

@Component({
  selector: 'lq-global-loader',
  template: `
    @if (loading.showOverlay()) {
      <div
        role="status"
        aria-live="polite"
        [attr.aria-label]="i18n.t('Loading MIRHAL', 'جارٍ تحميل مِرحال')"
        class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-surface-50/85 dark:bg-surface-950/85 backdrop-blur-sm transition-opacity duration-300"
      >
        <!-- Branded MIRHAL Container -->
        <div
          class="relative flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-0/95 dark:bg-surface-900/95 shadow-xl border border-line"
        >
          <!-- Ambient Spinner Accent Ring -->
          <div
            class="absolute -inset-1 rounded-2xl border-2 border-transparent border-t-brand/60 animate-spin motion-reduce:hidden pointer-events-none"
          ></div>

          <!-- Official MIRHAL Mark SVG -->
          <div class="flex flex-col items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              class="size-14 select-none drop-shadow-sm transition-transform duration-300 motion-safe:animate-pulse"
              aria-hidden="true"
            >
              <rect width="64" height="64" rx="18" fill="#183a35" />
              <path
                d="M14 48V18l18 21 18-21v30"
                fill="none"
                stroke="#f5f7f4"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="5.5"
              />
              <circle cx="32" cy="39" r="3.4" fill="#86d7c2" />
            </svg>

            <div
              class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted select-none"
            >
              <span>مِرحال</span>
              <span class="text-brand">·</span>
              <span>MIRHAL</span>
            </div>
          </div>
        </div>
      </div>
    }

    @if (loading.showTopBar()) {
      <div
        role="progressbar"
        [attr.aria-label]="i18n.t('Loading page', 'جارٍ تحميل الصفحة')"
        aria-valuemin="0"
        aria-valuemax="100"
        class="fixed inset-x-0 top-0 z-[10000] h-1 overflow-hidden bg-brand/15 shadow-sm pointer-events-none"
      >
        <div class="loading-bar h-full bg-brand"></div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalLoader {
  readonly loading = inject(LoadingService);
  readonly i18n = inject(Preferences);
}
