import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Api, Page, Notification, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Pagination, EmptyState, ErrorState, Icon, PageHeader } from '@lifequest/ui';
@Component({
  selector: 'lq-notifications',
  imports: [
    TranslatePipe,
    Pagination,
    RouterLink,
    LocalizedDatePipe,
    PageHeader,
    Pagination,
    EmptyState,
    ErrorState,
    Icon,
  ],
  template: `<lq-page-header
      [eyebrow]="('web.features.notifications.copy.little_updates_from_your_journey_947cd12c' | translate)"
      [title]="('web.features.notifications.copy.a_few_things_to_know_9a51a76b' | translate)"
      [description]="
        ('web.features.notifications.copy.review_your_notifications_open_related_updates_and_mark_them_as_read_2f485fb7' | translate)
      "
      ><button class="btn btn-secondary" (click)="readAll()">
        {{ ('web.features.notifications.copy.mark_all_as_read_6d267c97' | translate) }}
      </button></lq-page-header
    >
    @if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else if (resource.data()) {
      <div class="space-y-3">
        @for (item of resource.data()?.items; track item.id) {
          <a
            [routerLink]="item.href || '/dashboard'"
            (click)="read(item.id)"
            class="card flex items-start gap-4 p-5"
            [class.bg-brand-soft]="!item.readAt"
            ><span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand"
              ><lq-icon
                [name]="
                  item.type.includes('CHALLENGE')
                    ? 'swords'
                    : item.type === 'REWARD'
                      ? 'gift'
                      : item.type === 'ACHIEVEMENT'
                        ? 'award'
                        : 'bell'
                "
            /></span>
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-semibold">{{ item.title }}</h2>
              <p class="mt-2 text-xs leading-6 text-muted">{{ item.body }}</p>
              <p class="mt-2 text-[10px] text-muted">
                {{ item.createdAt | date: 'MMM d, h:mm a' }}
              </p>
            </div>
            @if (!item.readAt) {
              <span
                class="mt-2 size-2 shrink-0 rounded-full bg-brand"
                [attr.aria-label]="('web.features.notifications.copy.unread_0eb8c982' | translate)"
              ></span>
            }
          </a>
        } @empty {
          <lq-empty
            icon="bell"
            [title]="('web.features.notifications.copy.a_little_quiet_is_good_too_a9b1cbb1' | translate)"
            [description]="
              ('web.features.notifications.copy.your_invitations_and_milestones_will_find_a_home_here_7fca0749' | translate)
            "
          />
        }
      </div>
    }
    @if (resource.data(); as page) {
      <lq-pagination
        [page]="page.page"
        [total]="page.total"
        [limit]="page.limit"
        (change)="this.page($event)"
      />
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Notification>>('notifications');
  page(page: number) {
    void this.resource.load(`notifications?page=${page}`);
  }
  async read(id: string) {
    try {
      await this.api.patch(`notifications/${id}/read`, {});
    } catch (error) {
      this.toasts.error(error);
    }
  }
  async readAll() {
    try {
      await this.api.post('notifications/read-all');
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
}
