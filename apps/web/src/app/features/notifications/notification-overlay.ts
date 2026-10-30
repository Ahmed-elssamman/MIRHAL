import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { Api, Notification, Page, Remote, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Icon } from '@lifequest/ui';

@Component({
  selector: 'lq-notification-overlay',
  imports: [DialogModule, RouterLink, LocalizedDatePipe, Icon],
  template: `
    <p-dialog
      [visible]="true"
      (visibleChange)="!$event && close.emit()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closeOnEscape]="true"
      [style]="{ width: 'min(34rem, calc(100vw - 1.5rem))' }"
      [header]="i18n.t('A few things to know.', 'بعض الأشياء لتعرفها.')"
      [appendTo]="'body'"
    >
      @if (resource.loading() && !resource.data()) {
        <div
          class="space-y-3"
          aria-busy="true"
          [attr.aria-label]="i18n.t('Loading notifications', 'جارٍ تحميل الإشعارات')"
        >
          <div class="skeleton h-16"></div>
          <div class="skeleton h-16"></div>
          <div class="skeleton h-16"></div>
        </div>
      } @else if (resource.error()) {
        <div role="alert" class="rounded-xl border border-line p-4">
          <p class="text-sm text-muted">{{ resource.error() }}</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="resource.load()">
            {{ i18n.t('Try again', 'حاول مجدداً') }}
          </button>
        </div>
      } @else {
        @if (unreadCount()) {
          <button
            type="button"
            class="mb-3 min-h-11 text-xs font-semibold text-brand"
            (click)="readAll()"
            [disabled]="working()"
          >
            {{ i18n.t('Mark all as read', 'تحديد الكل كمقروء') }}
          </button>
        }
        <div class="max-h-[min(65vh,34rem)] space-y-2 overflow-y-auto">
          @for (item of resource.data()?.items; track item.id) {
            <a
              [routerLink]="item.href || '/dashboard'"
              (click)="openItem(item)"
              class="flex min-h-16 items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-hover"
              [class.bg-brand-soft]="!item.readAt"
            >
              <span
                class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand"
              >
                <lq-icon [name]="iconFor(item.type)" [size]="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold">{{ item.title }}</span>
                <span class="mt-1 block text-xs leading-5 text-muted">{{ item.body }}</span>
                <span class="mt-1 block text-[10px] text-muted">{{
                  item.createdAt | date: 'MMM d, h:mm a'
                }}</span>
              </span>
              @if (!item.readAt) {
                <span
                  class="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
                  [attr.aria-label]="i18n.t('Unread', 'غير مقروء')"
                ></span>
              }
            </a>
          } @empty {
            <div class="rounded-xl border border-line px-5 py-8 text-center">
              <lq-icon name="bell" class="text-brand" [size]="24" />
              <p class="mt-3 text-sm font-semibold">
                {{ i18n.t('A little quiet is good, too.', 'قليل من الهدوء جيد أيضاً.') }}
              </p>
              <p class="mt-1 text-xs leading-5 text-muted">
                {{
                  i18n.t(
                    'Your invitations and milestones will find a home here.',
                    'ستجد دعواتك وإنجازاتك مكاناً هنا.'
                  )
                }}
              </p>
            </div>
          }
        </div>
      }
      <a routerLink="/notifications" class="btn btn-secondary mt-4 w-full" (click)="close.emit()">
        {{ i18n.t('All notifications', 'كل الإشعارات') }}
        <lq-icon [name]="i18n.rtl() ? 'arrow-left' : 'arrow-right'" [size]="16" />
      </a>
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationOverlay {
  readonly close = output<void>();
  readonly i18n = inject(Preferences);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly resource = new Remote<Page<Notification>>(this.api, 'notifications?limit=6');
  readonly working = computed(() => this.resource.loading());
  readonly unreadCount = computed(
    () => this.resource.data()?.items.filter((item) => !item.readAt).length ?? 0,
  );

  constructor() {
    void this.resource.load();
  }

  iconFor(type: string) {
    return type.includes('CHALLENGE')
      ? 'users'
      : type === 'REWARD'
        ? 'gift'
        : type === 'ACHIEVEMENT'
          ? 'award'
          : 'bell';
  }

  async openItem(item: Notification) {
    if (item.readAt) return;
    try {
      await this.api.patch(`notifications/${item.id}/read`, {});
    } catch (error) {
      this.toasts.error(error);
    }
  }

  async readAll() {
    if (this.working()) return;
    try {
      await this.api.post('notifications/read-all');
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
}
