import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Page, Toasts } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { EmptyState, ErrorState, Icon, PageHeader, Pagination, Skeleton } from '@lifequest/ui';
import { AdminChallenge } from '../../models';
@Component({
  selector: 'lq-admin-challenges',
  imports: [
    TranslatePipe,
    LocalizedDatePipe,
    FormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Skeleton,
    Icon,
    Pagination,
  ],
  template: `<lq-page-header
      [eyebrow]="('admin.features.challenges.copy.fair_play_thoughtful_moderation_d82d8f97' | translate)"
      [title]="('admin.features.challenges.copy.keep_shared_journeys_healthy_2a66d72f' | translate)"
      [description]="
        ('admin.features.challenges.copy.inspect_lifecycle_and_participation_without_exposing_private_behavioral_details_d2976394' | translate)
      "
    />
    <form class="mb-6 flex flex-wrap items-end gap-3" (ngSubmit)="page(1)">
      <div class="min-w-0 flex-1">
        <label class="field-label" for="challenge-search">{{
          ('admin.features.challenges.copy.find_a_challenge_6415ac68' | translate)
        }}</label>
        <input
          id="challenge-search"
          name="search"
          class="field"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          maxlength="160"
        />
      </div>
      <div>
        <label class="field-label" for="challenge-status">{{ ('common.copy.status_005ef20f' | translate) }}</label>
        <select
          id="challenge-status"
          name="status"
          class="field"
          [ngModel]="status()"
          (ngModelChange)="status.set($event); page(1)"
        >
          <option value="">{{ ('admin.features.challenges.copy.all_stages_7f58b21b' | translate) }}</option>
          @for (stage of statuses; track stage) {
            <option [value]="stage">{{ i18n.label(stage) }}</option>
          }
        </select>
      </div>
      <button class="btn btn-secondary" type="submit">{{ ('common.copy.search_c646a2c9' | translate) }}</button>
    </form>
    @if (resource.loading() && !resource.data()) {
      <lq-skeleton />
    } @else if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else {
      <div class="grid gap-5 md:grid-cols-2">
        @for (item of resource.data()?.items; track item.id) {
          <article class="card p-6">
            <div class="mb-4 flex justify-between">
              <span class="badge bg-brand-soft text-brand">{{ i18n.label(item.mode) }}</span
              ><span class="badge bg-canvas text-muted">{{ i18n.label(item.status) }}</span>
            </div>
            <h2 class="text-lg font-semibold">{{ item.title }}</h2>
            <p class="mt-3 text-xs text-muted">
              {{ item._count.participants }} {{ ('admin.features.challenges.copy.participants_8fd01987' | translate) }} ·
              {{ item.startDate | date: 'MMM d' }} – {{ item.endDate | date: 'MMM d' }}
            </p>
            @if (
              !['COMPLETED', 'CANCELLED'].includes(item.status) && auth.user()?.role !== 'ANALYST'
            ) {
              <button
                class="btn btn-secondary mt-5 w-full text-xs"
                (click)="selected.set(item); reason.set('')"
              >
                <lq-icon name="shield" [size]="15" />{{
                  ('admin.features.challenges.copy.moderate_challenge_21e161b9' | translate)
                }}
              </button>
            }
          </article>
        } @empty {
          <lq-empty
            icon="swords"
            [title]="('admin.features.challenges.copy.no_shared_journeys_yet_681c8800' | translate)"
            [description]="
              ('admin.features.challenges.copy.challenges_will_appear_as_people_connect_ce83b10f' | translate)
            "
          />
        }
      </div>
    }
    @if (resource.data(); as data) {
      <lq-pagination
        [page]="data.page"
        [total]="data.total"
        [limit]="data.limit"
        (change)="page($event)"
      />
    }
    <p-dialog
      [closeAriaLabel]="('common.copy.close_cd86acc3' | translate)"
      [header]="('admin.features.challenges.copy.cancel_with_a_clear_reason_8b9cf3d1' | translate)"
      [visible]="!!selected()"
      (visibleChange)="!$event && selected.set(null)"
      [modal]="true"
      [style]="{ width: '32rem' }"
      ><p class="mb-4 text-xs leading-6 text-muted">
        {{
          ('admin.features.challenges.copy.this_stops_the_challenge_for_all_participants_the_reason_is_retained_in_the_audit_trail_d20fa870' | translate)
        }}
      </p>
      <label class="field-label" for="moderation-reason">{{
        ('admin.features.challenges.copy.reason_at_least_10_characters_9009a291' | translate)
      }}</label
      ><textarea
        id="moderation-reason"
        class="field"
        rows="4"
        [ngModel]="reason()"
        (ngModelChange)="reason.set($event)"
      ></textarea
      ><button
        class="btn btn-primary mt-5 w-full"
        [disabled]="busy() || reason().length < 10"
        (click)="cancel()"
      >
        {{ ('admin.features.challenges.copy.cancel_and_record_reason_851b0c5d' | translate) }}
      </button></p-dialog
    >`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminChallengesPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly auth = inject(AuthStore);
  readonly resource = this.api.resource<Page<AdminChallenge>>('admin/challenges');
  readonly search = signal('');
  readonly status = signal('');
  readonly statuses = [
    'DRAFT',
    'INVITED',
    'ACCEPTED',
    'SCHEDULED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
  ];
  readonly selected = signal<AdminChallenge | null>(null);
  readonly reason = signal('');
  readonly busy = signal(false);
  page(page: number) {
    const query = new URLSearchParams({ page: String(page), search: this.search() });
    if (this.status()) query.set('status', this.status());
    void this.resource.load('admin/challenges?' + query);
  }
  async cancel() {
    const selected = this.selected();
    if (!selected) return;
    this.busy.set(true);
    try {
      await this.api.post(`admin/challenges/${selected.id}/cancel`, { reason: this.reason() });
      this.selected.set(null);
      this.toasts.success(this.i18n.t('Moderation recorded.', 'تم تسجيل الإشراف.'));
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
