import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Preferences } from '@mirhal/utilities';
@Component({
  selector: 'lq-activity-chart',
  imports: [TranslatePipe],
  template: `<figure>
    <svg
      viewBox="0 0 700 180"
      role="img"
      [attr.aria-label]="
        label() ??
        ('web.features.analytics.copy.habit_actions_over_the_last_28_days_green_dots_indicate_daily_check_ins_1f0a6b44'
          | translate)
      "
      class="w-full"
    >
      <line x1="12" y1="145" x2="690" y2="145" stroke="currentColor" class="text-line" />
      @for (day of bars(); track day.date) {
        <rect
          [attr.x]="day.x"
          [attr.y]="145 - day.height"
          width="13"
          [attr.height]="day.height"
          rx="4"
          class="fill-brand/75"
        >
          <title>{{ day.date }}: {{ day.habits }}</title>
        </rect>
        @if (day.checkIn) {
          <circle [attr.cx]="day.x + 6.5" cy="160" r="2.5" class="fill-brand" />
        }
      }
    </svg>
    <figcaption class="mt-1 flex justify-between text-[10px] text-muted">
      <span>{{ items()[0]?.date }}</span
      ><span>{{ items()[items().length - 1]?.date }}</span>
    </figcaption>
  </figure>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityChart {
  readonly i18n = inject(Preferences);
  readonly items = input.required<{ date: string; habits: number; checkIn: boolean }[]>();
  readonly label = input<string>();
  readonly bars = computed(() => {
    const max = Math.max(1, ...this.items().map((item) => item.habits));
    return this.items().map((item, i) => ({
      ...item,
      x: 14 + i * (670 / Math.max(1, this.items().length)),
      height: (item.habits / max) * 120,
    }));
  });
}
