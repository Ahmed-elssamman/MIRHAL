import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Area, errorMessage, Goal, Habit, Page, Toasts } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import {
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Progress,
  Skeleton,
} from '@lifequest/ui';
import {
  applyServerValidation,
  FormField,
  DiscardChanges,
  UnsavedForm,
  HabitScheduleFields,
} from '@lifequest/forms';
@Component({
  selector: 'lq-habits',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Skeleton,
    Icon,
    Progress,
    Pagination,
    FormField,
    UnsavedForm,
    HabitScheduleFields,
  ],
  templateUrl: './habits.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  readonly discard = inject(DiscardChanges);
  readonly i18n = inject(Preferences);
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly resource = this.api.resource<Page<Habit>>('habits');
  readonly areas = this.api.resource<Area[]>('life-areas');
  readonly goals = this.api.resource<Page<Goal>>('goals?limit=100');
  readonly open = signal(false);
  readonly editing = signal<Habit | null>(null);
  readonly saving = signal(false);
  readonly busy = signal('');
  readonly error = signal('');
  readonly filter = signal('all');
  readonly visible = computed(() => this.resource.data()?.items ?? []);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    areaId: ['', Validators.required],
    goalId: [''],
    scheduleDays: this.fb.nonNullable.control<number[]>([]),
    frequency: ['DAILY'],
    weeklyTarget: [3, [Validators.min(1), Validators.max(7)]],
    target: [1, [Validators.required, Validators.min(0.01)]],
    unit: [this.i18n.habitUnit('times'), Validators.required],
    difficulty: ['EASY'],
    preferredTime: ['morning'],
    minimumAction: [''],
    whyItMatters: [''],
    startDate: [''],
    commitment: ['flexible'],
    notes: [''],
    status: ['ACTIVE'],
  });
  constructor() {
    if (this.route?.snapshot.queryParamMap.get('quickAdd') === 'habit') void this.create();
  }
  async create() {
    if (!this.areas.data()) await this.areas.load();
    if (!this.areas.data()?.length) {
      this.toasts.error(
        this.i18n.t(
          'Life areas could not be loaded. Please try again.',
          'تعذر تحميل مجالات الحياة. حاول مرة أخرى.',
        ),
      );
      return;
    }
    this.editing.set(null);
    this.form.reset({
      areaId: this.areas.data()?.[0]?.id ?? '',
      frequency: 'DAILY',
      weeklyTarget: 3,
      target: 1,
      unit: this.i18n.habitUnit('times'),
      difficulty: 'EASY',
      preferredTime: 'morning',
    });
    this.error.set('');
    this.open.set(true);
  }
  edit(habit: Habit) {
    this.editing.set(habit);
    this.form.reset({
      ...habit,
      unit: this.i18n.habitUnit(habit.unit),
      goalId: habit.goalId ?? '',
      startDate: habit.startDate.slice(0, 10),
    });
    this.error.set('');
    this.open.set(true);
  }
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const { status, ...values } = this.form.getRawValue();
      const input = {
        ...values,
        goalId: values.goalId || null,
        startDate: values.startDate || undefined,
      };
      const editing = this.editing();
      if (editing) await this.api.patch(`habits/${editing.id}`, { ...input, status });
      else await this.api.post('habits', input);
      this.form.markAsPristine();
      this.open.set(false);
      this.toasts.success(this.i18n.t('A little rhythm, just for you.', 'إيقاع صغير، يناسبك.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async complete(habit: Habit, minimum = false) {
    if (this.busy()) return;
    this.busy.set(habit.id);
    try {
      const result = await this.api.post<{ awarded: number }>(`habits/${habit.id}/complete`, {
        minimum,
      });
      this.toasts.success(
        this.i18n.t('Showing up counts.', 'محاولتك تُحسب.'),
        `+${result.awarded} XP`,
      );
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
  async pause(habit: Habit) {
    try {
      await this.api.patch(`habits/${habit.id}`, {
        status: habit.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      });
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  setFilter(areaId: string) {
    this.filter.set(areaId);
    this.page(1);
  }
  page(page: number) {
    void this.resource.load(
      `habits?page=${page}${this.filter() === 'all' ? '' : '&areaId=' + encodeURIComponent(this.filter())}`,
    );
  }
}
