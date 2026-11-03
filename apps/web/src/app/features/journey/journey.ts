import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { Api, Remote, errorMessage, Journey } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { ErrorState, Icon, PageHeader, ProgressRing, SectionTitle, Skeleton } from '@lifequest/ui';
import { applyServerValidation, FormField, DiscardChanges, UnsavedForm } from '@lifequest/forms';
@Component({
  selector: 'lq-journey',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePickerModule,
    PageHeader,
    ErrorState,
    Skeleton,
    Icon,
    ProgressRing,
    SectionTitle,
    FormField,
    UnsavedForm,
  ],
  templateUrl: './journey.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  readonly i18n = inject(Preferences);
  readonly resource = new Remote<Journey>(this.api, 'journey');
  readonly discard = inject(DiscardChanges);
  readonly month = signal(this.toMonthKey(new Date()));
  readonly selectedMonthDate = computed(() => {
    const [year = new Date().getFullYear(), month = new Date().getMonth() + 1] = this.month()
      .split('-')
      .map(Number);
    return new Date(year, month - 1, 1);
  });
  readonly minMonthDate = new Date(2020, 0, 1);
  readonly maxMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly now = new Date();
  readonly form = this.fb.nonNullable.group({
    biggestWin: [''],
    failureReason: [''],
    adjustment: [''],
    reward: [''],
  });
  constructor() {
    void this.load();
  }
  private toMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  selectMonth(date: Date | null) {
    if (date) void this.load(this.toMonthKey(date));
  }
  async load(month?: string) {
    if (this.form.dirty && !(await this.discard.confirm())) return;
    this.saved.set(false);
    await this.resource.load(month ? `journey?month=${month}` : 'journey');
    const data = this.resource.data();
    if (!data || this.resource.error()) return;
    const selected = data.summary.periodStart.slice(0, 7);
    this.month.set(selected);
    const reflection = data.reflections.find(
      (item) =>
        item.year === Number(selected.slice(0, 4)) && item.month === Number(selected.slice(5, 7)),
    );
    this.form.reset(
      reflection ?? { biggestWin: '', failureReason: '', adjustment: '', reward: '' },
    );
  }
  async save() {
    if (this.saving()) return;
    this.error.set('');
    this.saving.set(true);
    try {
      await this.api.post('journey/reflection', {
        ...this.form.getRawValue(),
        year: Number(this.month().slice(0, 4)),
        month: Number(this.month().slice(5, 7)),
      });
      this.form.markAsPristine();
      this.saved.set(true);
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
