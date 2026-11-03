import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, CheckIn, Habit, Page, Quest, Remote, Task, Toasts } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import {
  ErrorState,
  HabitRow,
  Icon,
  PageHeader,
  Pagination,
  Progress,
  SectionTitle,
  Skeleton,
} from '@lifequest/ui';
import { CheckInForm } from './check-in';
import { selectNextAction } from './next-action';
@Component({
  selector: 'lq-today',
  imports: [
    RouterLink,
    PageHeader,
    Pagination,
    ErrorState,
    Skeleton,
    Icon,
    Progress,
    SectionTitle,
    HabitRow,
    CheckInForm,
  ],
  templateUrl: './today.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly habits = this.api.resource<Page<Habit> & { date: string; completedCount: number }>(
    'habits?today=true&limit=10',
  );
  readonly tasks = this.api.resource<Page<Task>>('tasks?today=true&limit=8');
  readonly checkIns = this.api.resource<CheckIn[]>('check-ins');
  readonly quests = new Remote<Page<Quest>>(this.api, 'quests?limit=10');
  readonly questRequested = signal(false);
  readonly busy = signal('');
  readonly pendingTaskIds = signal<Set<string>>(new Set());
  readonly scheduled = computed(() => this.habits.data()?.items ?? []);
  readonly scheduledCount = computed(() => this.habits.data()?.total ?? 0);
  readonly completeCount = computed(() => this.habits.data()?.completedCount ?? 0);
  readonly checkedIn = computed(
    () =>
      this.checkIns.data()?.some((item) => item.date.slice(0, 10) === this.habits.data()?.date) ??
      false,
  );
  readonly todayTasks = computed(() => this.tasks.data()?.items ?? []);
  readonly nextAction = computed(() =>
    selectNextAction(this.todayTasks(), this.scheduled(), this.quests.data()?.items ?? []),
  );
  constructor() {
    effect(() => {
      if (this.questRequested() || !this.tasks.data() || !this.habits.data()) return;
      if (selectNextAction(this.todayTasks(), this.scheduled())) return;
      this.questRequested.set(true);
      void this.quests.load();
    });
  }
  habitPage(page: number) {
    void this.habits.load(`habits?today=true&limit=10&page=${page}`);
  }
  taskPage(page: number) {
    void this.tasks.load(`tasks?today=true&limit=8&page=${page}`);
  }
  async complete(id: string, minimum: boolean) {
    if (this.busy()) return;
    this.busy.set(id);
    try {
      const result = await this.api.post<{ awarded: number }>(`habits/${id}/complete`, { minimum });
      this.toasts.success(
        this.i18n.t('A little win, recorded.', 'إنجاز صغير، تم تسجيله.'),
        `+${result.awarded} XP`,
      );
      await this.habits.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
  async completeTask(id: string) {
    if (this.pendingTaskIds().has(id)) return;
    this.pendingTaskIds.update((set) => new Set(set).add(id));
    const previous = this.tasks.data();

    // Optimistically remove from today's list immediately (< 50ms acknowledgment)
    this.tasks.data.update((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.filter((item) => item.id !== id),
        total: Math.max(0, current.total - 1),
      };
    });

    try {
      const result = await this.api.patch<{ awarded: number }>(`tasks/${id}`, {
        status: 'COMPLETED',
      });
      this.toasts.success(
        this.i18n.t('One less thing on your mind.', 'شيء أقل يشغل بالك.'),
        result.awarded ? `+${result.awarded} XP` : undefined,
      );
    } catch (error) {
      // Rollback on failure
      this.tasks.data.set(previous);
      this.toasts.error(error);
    } finally {
      this.pendingTaskIds.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  }
  async completeQuestItem(questId: string, itemId: string) {
    if (this.busy()) return;
    this.busy.set(itemId);
    try {
      const result = await this.api.post<{ awarded: number }>(
        `quests/${questId}/items/${itemId}/complete`,
      );
      this.toasts.success(
        this.i18n.t('One more step in your journey.', 'خطوة أخرى في رحلتك.'),
        result.awarded ? `+${result.awarded} XP` : undefined,
      );
      await this.quests.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
}
