import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Feedback, Page, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '@lifequest/ui';
import { applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-admin-feedback',
  imports: [
    TranslatePipe,
    LocalizedDatePipe,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Skeleton,
    Pagination,
    FormField,
  ],
  templateUrl: './feedback.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFeedbackPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Feedback>>('admin/feedback');
  readonly selected = signal<Feedback | null>(null);
  readonly filter = signal('ALL');
  readonly visible = computed(() => this.resource.data()?.items ?? []);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly statuses = [
    'SUBMITTED',
    'REVIEWING',
    'PLANNED',
    'IN_PROGRESS',
    'RESOLVED',
    'REJECTED',
    'CLOSED',
  ];
  readonly form = this.fb.nonNullable.group({
    status: ['REVIEWING'],
    priority: ['MEDIUM'],
    reply: [''],
    internal: [false],
  });
  edit(item: Feedback) {
    this.selected.set(item);
    this.form.reset({ status: item.status, priority: item.priority, reply: '', internal: false });
    this.error.set('');
  }
  async save() {
    const item = this.selected();
    if (!item) return;
    this.saving.set(true);
    try {
      await this.api.patch(`admin/feedback/${item.id}`, this.form.getRawValue());
      this.selected.set(null);
      this.toasts.success(this.i18n.t('Conversation updated.', 'تم تحديث المحادثة.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  setFilter(category: string) {
    this.filter.set(category);
    this.page(1);
  }
  page(page: number) {
    void this.resource.load(
      `admin/feedback?page=${page}${this.filter() === 'ALL' ? '' : '&category=' + this.filter()}`,
    );
  }
}
