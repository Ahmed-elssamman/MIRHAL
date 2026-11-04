import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Router, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { Api, Notification, Page, Remote, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Icon } from '@lifequest/ui';

@Component({
  selector: 'lq-notification-overlay',
  imports: [
    TranslatePipe,DialogModule, RouterLink, LocalizedDatePipe, Icon],
  template: `
    <p-dialog
      [visible]="true"
      (visibleChange)="!$event && close.emit()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closeOnEscape]="true"
      [style]="{ width: 'min(34rem, calc(100vw - 1.5rem))' }"
      [header]="('web.features.notifications.copy.a_few_things_to_know_9a51a76b' | translate)"
      [appendTo]="'body'"
    >
      @if (resource.loading() && !resource.data()) {
        <div
          class="space-y-3"
          aria-busy="true"
          [attr.aria-label]="('web.features.notifications.copy.loading_notifications_d98d753f' | translate)"
        >
          <div class="skeleton h-16"></div>
          <div class="skeleton h-16"></div>
          <div class="skeleton h-16"></div>
        </div>
      } @else if (resource.error()) {
        <div role="alert" class="rounded-xl border border-line p-4">
          <p class="text-sm text-muted">{{ resource.error() }}</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="resource.load()">
            {{ ('common.copy.try_again_213e90fa' | translate) }}
          </button>
        </div>
      } @else {
        @if (resource.data()?.total) {
          <button
            type="button"
            class="mb-3 min-h-11 text-xs font-semibold text-brand"
            (click)="readAll()"
            [disabled]="working()"
          >
            {{ ('web.features.notifications.copy.mark_all_as_read_6d267c97' | translate) }}
          </button>
        }
        <div class="max-h-[min(65vh,34rem)] space-y-2 overflow-y-auto">
          @for (item of resource.data()?.items; track item.id) {
            <button
              type="button"
              (click)="openItem(item)"
              [disabled]="pendingIds().has(item.id)"
              class="flex min-h-16 w-full items-start gap-3 rounded-xl border border-line p-3 text-start transition-colors hover:bg-hover"
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
                  [attr.aria-label]="('web.features.notifications.copy.unread_0eb8c982' | translate)"
                ></span>
              }
            </button>
          } @empty {
            <div class="rounded-xl border border-line px-5 py-8 text-center">
              <lq-icon name="bell" class="text-brand" [size]="24" />
              <p class="mt-3 text-sm font-semibold">
                {{ ('web.features.notifications.copy.a_little_quiet_is_good_too_a9b1cbb1' | translate) }}
              </p>
              <p class="mt-1 text-xs leading-5 text-muted">
                {{
                  ('web.features.notifications.copy.your_invitations_and_milestones_will_find_a_home_here_7fca0749' | translate)
                }}
              </p>
            </div>
          }
        </div>
      }
      <a routerLink="/notifications" class="btn btn-secondary mt-4 w-full" (click)="close.emit()">
        {{ ('web.features.notifications.copy.all_notifications_7b3946e0' | translate) }}
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
  private readonly router = inject(Router);
  readonly resource = new Remote<Page<Notification>>(this.api, 'notifications?limit=6');
  readonly readingAll = signal(false);
  readonly pendingIds = signal<Set<string>>(new Set());
  readonly working = computed(() => this.resource.loading() || this.readingAll());
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
    if (item.href && item.href.startsWith('/') && !item.href.startsWith('//')) {
      this.close.emit();
      void this.router.navigateByUrl(item.href);
    }
    if (item.readAt || this.pendingIds().has(item.id)) return;
    this.pendingIds.update((ids) => new Set(ids).add(item.id));
    try {
      await this.api.patch(`notifications/${item.id}/read`, {});
      this.resource.data.update((page) => page && ({
        ...page,
        items: page.items.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry),
      }));
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.pendingIds.update((ids) => { const next = new Set(ids); next.delete(item.id); return next; });
    }
  }

  async readAll() {
    if (this.working()) return;
    this.readingAll.set(true);
    try {
      await this.api.post('notifications/read-all');
      const readAt = new Date().toISOString();
      this.resource.data.update((page) => page && ({ ...page, items: page.items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })) }));
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.readingAll.set(false);
    }
  }
}
