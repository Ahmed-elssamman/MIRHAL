import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Habit, Page, Toasts } from '@lifequest/data-access';
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
  HabitScheduleFields,
  DiscardChanges,
  UnsavedForm,
} from '@lifequest/forms';
@Component({
  selector: 'lq-habit-lab',
  imports: [
    TranslatePipe,
    RouterLink,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    Pagination,
    EmptyState,
    ErrorState,
    Skeleton,
    Icon,
    Progress,
    FormField,
    HabitScheduleFields,
    UnsavedForm,
  ],
  templateUrl: './habit-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitLabPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  readonly discard = inject(DiscardChanges);
  readonly open = signal(false);
  readonly i18n = inject(Preferences);
  readonly guidance = [
    { icon: 'search', titleKey: 'web.habitLab.guidance.notice.title', textKey: 'web.habitLab.guidance.notice.text' },
    { icon: 'flask', titleKey: 'web.habitLab.guidance.experiment.title', textKey: 'web.habitLab.guidance.experiment.text' },
    { icon: 'sprout', titleKey: 'web.habitLab.guidance.keep.title', textKey: 'web.habitLab.guidance.keep.text' },
  ];
  readonly resource = this.api.resource<Page<Habit>>('habits');
  readonly selected = signal<Habit | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(2)]],
    hypothesis: ['', [Validators.required, Validators.minLength(2)]],
    adjustment: ['', [Validators.required, Validators.minLength(2)]],
    target: [1, Validators.min(0.01)],
    minimumAction: [''],
    preferredTime: ['morning'],
    frequency: ['DAILY'],
    scheduleDays: this.fb.nonNullable.control<number[]>([]),
    weeklyTarget: [3, [Validators.min(1), Validators.max(7)]],
    commitment: ['flexible'],
    action: ['ADJUST'],
  });
  diagnose(habit: Habit, gentler = false) {
    this.selected.set(habit);
    this.open.set(true);
    this.form.reset({
      reason: habit.failureReason,
      hypothesis: habit.nextExperiment,
      adjustment: gentler
        ? this.i18n.t('Try a smaller step at a better time.', 'جرّب خطوة أصغر في وقت أنسب.')
        : '',
      target:
        gentler && habit.target > 1 ? Math.max(1, Math.floor(habit.target / 3)) : habit.target,
      minimumAction: habit.minimumAction,
      preferredTime: habit.preferredTime,
      frequency: habit.frequency,
      scheduleDays: habit.scheduleDays,
      weeklyTarget:
        gentler && habit.frequency === 'WEEKLY' && habit.weeklyTarget > 1
          ? habit.weeklyTarget - 1
          : habit.weeklyTarget,
      commitment: habit.commitment,
      action: 'ADJUST',
    });
    this.error.set('');
  }
  async save() {
    const habit = this.selected();
    if (!habit || this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.post(`habits/${habit.id}/experiments`, this.form.getRawValue());
      this.form.markAsPristine();
      this.open.set(false);
      this.selected.set(null);
      this.toasts.success(
        this.i18n.t(
          'A new experiment. A little more understanding.',
          'تجربة جديدة. وفهم أعمق قليلاً.',
        ),
      );
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  page(page: number) {
    void this.resource.load(`habits?page=${page}`);
  }
}
