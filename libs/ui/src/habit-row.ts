import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HabitSummary } from '@mirhal/data-access';
import { Preferences } from '@mirhal/utilities';
import { Icon } from './icon';

@Component({
  selector: 'mirhal-habit-row, lq-habit-row',
  imports: [TranslatePipe, Icon],
  template: `
    <div class="flex items-center gap-3 rounded-xl px-1 py-3.5 sm:gap-4">
      <button
        class="flex size-8 shrink-0 items-center justify-center rounded-[10px] border transition-colors"
        [class]="
          habit().completedToday
            ? 'border-mint bg-mint text-mint-ink'
            : 'border-line bg-surface hover:border-brand hover:text-brand'
        "
        [disabled]="busy() || habit().completedToday"
        [attr.aria-label]="'shared.ui.completeHabit' | translate: { name: habit().name }"
        (click)="complete.emit(false)"
      >
        @if (habit().completedToday) {
          <lq-icon name="check" [size]="17" />
        }
      </button>
      <span
        class="hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex"
        [class]="'area-' + habit().area.slug"
      >
        <lq-icon [name]="habit().area.icon" [size]="17" />
      </span>
      <div class="min-w-0 flex-1">
        <p
          dir="auto"
          class="line-clamp-2 break-words text-[13px] font-medium sm:truncate"
          [class.text-muted]="habit().completedToday"
        >
          {{ habit().name }}
        </p>
        <p class="mt-1 text-[10px] text-muted">
          <bdi>{{ habit().target }} {{ i18n.habitUnit(habit().unit) }}</bdi>
          <span class="mx-1">·</span>
          {{ i18n.t(habit().area.name, habit().area.nameAr) }}
        </p>
      </div>
      @if (!habit().completedToday) {
        <button
          class="min-h-10 px-1 text-[10px] font-medium text-brand sm:px-2"
          [disabled]="busy()"
          (click)="complete.emit(true)"
        >
          {{ 'shared.ui.copy.tiny_version_a8882185' | translate }}
        </button>
      }
      <span
        class="flex shrink-0 items-center gap-1 text-[10px] font-semibold"
        [class]="habit().completedToday ? 'text-mint-ink' : 'text-muted'"
      >
        <lq-icon name="zap" [size]="12" />{{ habit().xpReward }}
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitRow {
  readonly habit = input.required<HabitSummary>();
  readonly busy = input(false);
  readonly complete = output<boolean>();
  readonly i18n = inject(Preferences);
}
