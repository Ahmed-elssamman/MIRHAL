import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from './icon';

@Component({
  selector: 'mirhal-pagination, lq-pagination',
  imports: [TranslatePipe, Icon],
  template: `
    @if (pages() > 1) {
      <nav
        class="mt-6 flex items-center justify-between gap-3"
        [attr.aria-label]="'shared.ui.pagination' | translate"
      >
        <span class="text-xs text-muted"> {{ total() }} {{ 'shared.ui.items' | translate }} </span>
        <div class="flex items-center gap-3">
          <button
            class="icon-button border border-line"
            [disabled]="page() <= 1"
            (click)="change.emit(page() - 1)"
            [attr.aria-label]="'shared.ui.previousPage' | translate"
          >
            <lq-icon name="arrow-left" [size]="17" />
          </button>
          <span class="text-xs" aria-current="page">{{ page() }} / {{ pages() }}</span>
          <button
            class="icon-button border border-line"
            [disabled]="page() >= pages()"
            (click)="change.emit(page() + 1)"
            [attr.aria-label]="'shared.ui.nextPage' | translate"
          >
            <lq-icon name="arrow-right" [size]="17" />
          </button>
        </div>
      </nav>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  readonly page = input<number>(1);
  readonly total = input<number>(0);
  readonly limit = input<number>(25);
  readonly change = output<number>();

  readonly pages = computed(() => {
    const total = this.total();
    const limit = this.limit();
    if (!Number.isFinite(total) || !Number.isFinite(limit) || total <= 0 || limit <= 0) return 0;
    return Math.ceil(total / limit);
  });
}
