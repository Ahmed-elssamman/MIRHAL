import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Page, Notification, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Pagination, EmptyState, ErrorState, Icon, PageHeader, Skeleton } from '@lifequest/ui';
@Component({
  selector: 'lq-notifications',
  imports: [
    Pagination,
    RouterLink,
    LocalizedDatePipe,
    PageHeader,
    Pagination,
    EmptyState,
    ErrorState,
    Skeleton,
    Icon,
  ],
  template: `<lq-page-header
      [eyebrow]="i18n.t('LITTLE UPDATES FROM YOUR JOURNEY', 'تحديثات صغيرة من رحلتك')"
      [title]="i18n.t('A few things to know.', 'بعض الأشياء لتعرفها.')"
      [description]="
        i18n.t(
          'Review your notifications, open related updates, and mark them as read.',
          'راجع إشعاراتك، وافتح التحديثات المرتبطة بها، وحددها كمقروءة.'
        )
      "
      ><button class="btn btn-secondary" (click)="readAll()">
        {{ i18n.t('Mark all as read', 'تحديد الكل كمقروء') }}
      </button></lq-page-header
    >
    @if (resource.loading() && !resource.data()) {
      <lq-skeleton />
    } @else if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else {
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
                [attr.aria-label]="i18n.t('Unread', 'غير مقروء')"
              ></span>
            }
          </a>
        } @empty {
          <lq-empty
            icon="bell"
            [title]="i18n.t('A little quiet is good, too.', 'قليل من الهدوء جيد أيضاً.')"
            [description]="
              i18n.t(
                'Your invitations and milestones will find a home here.',
                'ستجد دعواتك وإنجازاتك مكاناً هنا.'
              )
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
