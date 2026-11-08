import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LoadingService } from '@mirhal/data-access';

@Component({
  selector: 'mirhal-global-loader, lq-global-loader',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading.showOverlay()) {
      <div
        role="status"
        aria-live="polite"
        [attr.aria-label]="'common.fallbacks.loading_mirhal_060e96e4' | translate"
        class="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-canvas/80 backdrop-blur-sm pointer-events-none transition-opacity duration-300 motion-safe:animate-[loader-fade-in_250ms_ease-out]"
      >
        <!-- Branded MIRHAL Container -->
        <div
          class="pointer-events-none flex flex-col items-center justify-center gap-3.5 rounded-2xl border border-line bg-surface p-7 shadow-xl motion-safe:animate-[loader-card-enter_250ms_ease-out]"
        >
          <img
            src="/mirhal-mark.svg"
            alt=""
            class="size-16 select-none will-change-transform motion-safe:animate-[loader-settle_2.4s_ease-in-out_infinite]"
            width="64"
            height="64"
          />

          <div
            class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted select-none"
          >
            <span>مِرحال</span>
            <span class="text-brand">·</span>
            <span>MIRHAL</span>
          </div>
        </div>
      </div>
    }

    @if (loading.showOverlay()) {
      <div
        role="progressbar"
        [attr.aria-label]="'common.loading' | translate"
        aria-valuemin="0"
        aria-valuemax="100"
        class="fixed inset-x-0 top-0 z-[10000] h-1 overflow-hidden bg-brand/15 shadow-sm "
      >
        <div class="loading-bar h-full bg-brand"></div>
      </div>
    }
  `,
})
export class GlobalLoader {
  readonly loading = inject(LoadingService);
}
