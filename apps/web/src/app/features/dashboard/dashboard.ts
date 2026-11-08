import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Api, Dashboard, Toasts } from '@mirhal/data-access';
import { LocalizedDatePipe, Preferences } from '@mirhal/utilities';
import {
  ErrorState,
  HabitRow,
  Icon,
  PageHeader,
  Progress,
  ProgressRing,
  SectionTitle,
  StatCard,
} from '@mirhal/ui';
@Component({
  selector: 'lq-dashboard',
  imports: [
    TranslatePipe,
    RouterLink,
    PageHeader,
    LocalizedDatePipe,
    Icon,
    ErrorState,
    StatCard,
    Progress,
    ProgressRing,
    SectionTitle,
    HabitRow,
  ],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Dashboard>('dashboard');
  readonly announcements =
    this.api.resource<
      { id: string; title: string; titleAr: string; body: string; bodyAr: string }[]
    >('announcements');
  readonly visibleAnnouncements = computed(() =>
    (this.announcements.data() ?? [])
      .filter(
        (announcement) =>
          this.i18n.language() === 'en' ||
          (Boolean(announcement.titleAr.trim()) && Boolean(announcement.bodyAr.trim())),
      )
      .slice(0, 1),
  );
  readonly busy = signal('');
  readonly firstName = computed(
    () => this.resource.data()?.profile.displayName.split(' ')[0] ?? '',
  );
  readonly activeQuest = computed(() =>
    this.resource.data()?.quests.find((quest) => !quest.completedAt),
  );
  async complete(id: string, minimum: boolean) {
    if (this.busy()) return;
    this.busy.set(id);
    try {
      const result = await this.api.post<{ awarded: number; achievements: string[] }>(
        `habits/${id}/complete`,
        { minimum },
      );
      this.toasts.success(
        this.i18n.t('A small step. A real win.', 'خطوة صغيرة. إنجاز حقيقي.'),
        `+${result.awarded} XP`,
      );
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
}
