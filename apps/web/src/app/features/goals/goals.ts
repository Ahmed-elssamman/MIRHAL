import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Milestones } from './milestones';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Area, Goal, Page, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import {
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Progress,
} from '@lifequest/ui';
import { applyServerValidation, FormField, DiscardChanges, UnsavedForm } from '@lifequest/forms';
@Component({
  selector: 'lq-goals',
  imports: [
    TranslatePipe,
    Milestones,
    LocalizedDatePipe,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Icon,
    Progress,
    Pagination,
    FormField,
    UnsavedForm,
  ],
  templateUrl: './goals.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  private readonly fb = inject(FormBuilder);
  readonly discard = inject(DiscardChanges);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Goal>>('goals');
  readonly areas = this.api.resource<Area[]>('life-areas');
  readonly open = signal(false);
  readonly editing = signal<Goal | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    areaId: ['', Validators.required],
    priority: ['MEDIUM'],
    strategy: ['MANUAL'],
    manualProgress: [0],
    numericValue: [0],
    numericTarget: [100],
    targetDate: [''],
    notes: [''],
    startDate: [''],
    unit: [''],
    status: ['ACTIVE'],
  });
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
      priority: 'MEDIUM',
      strategy: 'MANUAL',
      numericTarget: 100,
      manualProgress: 0,
      numericValue: 0,
    });
    this.error.set('');
    this.open.set(true);
  }
  edit(goal: Goal) {
    this.editing.set(goal);
    this.form.reset({
      ...goal,
      numericTarget: goal.numericTarget ?? 100,
      unit: goal.unit ?? '',
      startDate: goal.startDate?.slice(0, 10) ?? '',
      targetDate: goal.targetDate?.slice(0, 10) ?? '',
    });
    this.error.set('');
    this.open.set(true);
  }
  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const { status, ...values } = this.form.getRawValue();
    const input = {
      ...values,
      startDate: values.startDate || null,
      unit: values.unit || null,
      targetDate: values.targetDate || null,
      numericTarget: values.strategy === 'NUMERIC' ? values.numericTarget : null,
    };
    try {
      const editing = this.editing();
      if (editing) await this.api.patch(`goals/${editing.id}`, { ...input, status });
      else await this.api.post('goals', input);
      this.form.markAsPristine();
      this.open.set(false);
      this.toasts.success(
        this.i18n.t('A meaningful direction, set.', 'اتجاه ذو معنى، أصبح جاهزاً.'),
      );
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async archive(goal: Goal) {
    try {
      await this.api.patch(`goals/${goal.id}`, {
        status: goal.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
      });
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
  page(page: number) {
    void this.resource.load(`goals?page=${page}`);
  }
}
