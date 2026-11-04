import { PlanningInsights } from './planning-insights';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Api } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { ErrorState, PageHeader, Skeleton, StatCard } from '@lifequest/ui';
import { Overview } from '../../models';
@Component({
  selector: 'lq-admin-analytics',
  imports: [
    TranslatePipe,PlanningInsights, PageHeader, ErrorState, Skeleton, StatCard],
  template: `<lq-page-header
      [eyebrow]="('admin.features.analytics.copy.useful_signals_respectful_data_b7b35725' | translate)"
      [title]="('admin.features.analytics.copy.understand_what_helps_people_grow_e7e13799' | translate)"
      [description]="
        ('admin.features.analytics.copy.aggregate_product_activity_no_journals_moods_or_private_habit_details_1d95973b' | translate)
      "
    />
    @if (resource.loading() && !resource.data()) {
      <lq-skeleton />
    } @else if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else if (resource.data(); as data) {
      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        <lq-stat
          [label]="('admin.features.analytics.copy.active_in_30_days_fb21930c' | translate)"
          [value]="data.activeUsers"
          icon="users"
        /><lq-stat
          [label]="('admin.features.analytics.copy.returning_people_46e8d7b0' | translate)"
          [value]="data.returningUsers"
          icon="refresh"
        /><lq-stat
          [label]="('admin.features.analytics.copy.habit_actions_in_30_days_0bba39bb' | translate)"
          [value]="data.habitCompletions"
          icon="sprout"
        />
      </div>
      <section class="card p-6">
        <h2 class="mb-6 text-lg font-semibold">
          {{ ('admin.features.analytics.copy.meaningful_product_events_62892305' | translate) }}
        </h2>
        <div class="space-y-5">
          @for (event of data.events; track event.name) {
            <div>
              <div class="mb-2 flex justify-between text-xs">
                <span>{{ i18n.label(event.name) }}</span
                ><span class="font-semibold text-brand">{{ event._count }}</span>
              </div>
              <div class="h-2 rounded-full bg-line">
                <div
                  class="h-2 origin-left rounded-full bg-brand"
                  [style.transform]="'scaleX(' + event._count / max(data) + ')'"
                ></div>
              </div>
            </div>
          } @empty {
            <p class="text-xs text-muted">
              {{
                ('admin.features.analytics.copy.events_will_appear_as_people_use_mirhal_ea962a8c' | translate)
              }}
            </p>
          }
        </div>
        <p class="mt-6 text-[10px] leading-6 text-muted">
          {{
            ('admin.features.analytics.copy.counts_are_aggregated_from_internal_events_no_third_party_behavioral_tracking_is_used_0919567c' | translate)
          }}
        </p>
      </section>
    }
    <section
      id="planning-insights"
      [attr.aria-label]="('admin.features.analytics.copy.planning_insights_b2156829' | translate)"
    >
      @defer (on viewport) {
        <lq-planning-insights />
      } @placeholder {
        <div class="mt-6"><lq-skeleton /></div>
      }
    </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAnalyticsPage {
  private readonly api = inject(Api);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Overview>('admin/overview');
  max(data: Overview) {
    return Math.max(1, ...data.events.map((item) => item._count));
  }
}
