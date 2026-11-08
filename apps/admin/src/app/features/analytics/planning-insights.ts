import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Api } from '@mirhal/data-access';
import { ErrorState, Progress } from '@mirhal/ui';
import { Preferences } from '@mirhal/utilities';
interface StatusCount {
  status: string;
  _count: number;
}
interface Insights {
  periodDays: number;
  planning: { kind: string; statuses: StatusCount[] }[];
  habits: StatusCount[];
  experiments: number;
  habitCompletionRate: number;
  scheduledActions: number;
  completedScheduledActions: number;
}
@Component({
  selector: 'lq-planning-insights',
  imports: [TranslatePipe, ErrorState, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else if (resource.data(); as data) {
      <section class="card mt-6 p-6">
        <h2 class="text-lg font-semibold">
          {{
            'admin.features.analytics.copy.small_actions_healthier_routines_8504e504' | translate
          }}
        </h2>
        <p class="my-4 text-xs leading-6 text-muted">
          {{
            'admin.features.analytics.copy.completion_across_current_active_schedules_in_the_last_30_days_a_pause_is_a_useful_adjustment_not_a_failure_b3cf2830'
              | translate
          }}
        </p>
        <div class="mb-3 flex justify-between text-sm">
          <span>{{
            'admin.features.analytics.copy.scheduled_habit_adherence_8af8cde5' | translate
          }}</span
          ><strong>{{ data.habitCompletionRate }}%</strong>
        </div>
        <lq-progress
          [value]="data.habitCompletionRate"
          [label]="'admin.features.analytics.copy.habit_adherence_3a12f796' | translate"
        />
        <div class="mt-5 flex flex-wrap gap-3">
          @for (item of data.habits; track item.status) {
            <span class="badge bg-brand-soft text-brand"
              >{{ status(item.status) }} · {{ item._count }}</span
            >
          }
        </div>
        <p class="mt-5 text-xs text-muted">
          {{ data.experiments }}
          {{
            'admin.features.analytics.copy.habit_lab_experiments_in_the_last_30_days_89d5bb64'
              | translate
          }}
        </p>
      </section>
      <section class="mt-6">
        <h2 class="mb-4 text-lg font-semibold">
          {{ 'admin.features.analytics.copy.from_intentions_to_outcomes_793b1004' | translate }}
        </h2>
        <div class="grid gap-4 md:grid-cols-3">
          @for (group of data.planning; track group.kind) {
            <article class="card p-5">
              <h3 class="mb-4 text-sm font-semibold">
                {{
                  i18n.t(
                    group.kind,
                    group.kind === 'goals'
                      ? 'الأهداف'
                      : group.kind === 'projects'
                        ? 'المشاريع'
                        : 'المهام'
                  )
                }}
              </h3>
              @for (item of group.statuses; track item.status) {
                <div class="flex min-h-10 justify-between gap-3 text-xs">
                  <span class="text-muted">{{ status(item.status) }}</span
                  ><strong>{{ item._count }}</strong>
                </div>
              } @empty {
                <p class="text-xs leading-6 text-muted">
                  {{
                    'admin.features.analytics.copy.new_intentions_will_appear_here_babb72fb'
                      | translate
                  }}
                </p>
              }
            </article>
          }
        </div>
      </section>
    }`,
})
export class PlanningInsights {
  readonly i18n = inject(Preferences);
  readonly resource = inject(Api).resource<Insights>('admin/insights');
  status(value: string) {
    return this.i18n.label(value);
  }
}
