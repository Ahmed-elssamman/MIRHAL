import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Page, Feedback, Toasts } from '@mirhal/data-access';
import { LocalizedDatePipe, Preferences } from '@mirhal/utilities';
import { Pagination, ErrorState, Icon, PageHeader, SectionTitle } from '@mirhal/ui';
import { UnsavedForm, applyServerValidation, FormField } from '@mirhal/forms';
@Component({
  selector: 'lq-feedback',
  imports: [
    TranslatePipe,
    UnsavedForm,
    Pagination,
    LocalizedDatePipe,
    ReactiveFormsModule,
    PageHeader,
    ErrorState,
    Icon,
    SectionTitle,
    FormField,
  ],
  templateUrl: './feedback.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Feedback>>('feedback');
  readonly saving = signal(false);
  readonly success = signal(false);
  readonly uploading = signal('');
  private readonly toasts = inject(Toasts);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    category: ['SUGGESTION'],
    priority: ['MEDIUM'],
    anonymous: [false],
  });
  readonly categories = [
    { id: 'BUG', key: 'web.feedback.categories.bug' },
    { id: 'SUGGESTION', key: 'web.feedback.categories.suggestion' },
    { id: 'UX', key: 'web.feedback.categories.usability' },
    { id: 'FEATURE', key: 'web.feedback.categories.feature' },
    { id: 'CONTENT', key: 'web.feedback.categories.content' },
    { id: 'COMPLAINT', key: 'web.feedback.categories.complaint' },
    { id: 'OTHER', key: 'web.feedback.categories.other' },
  ];
  page(page: number) {
    void this.resource.load(`feedback?page=${page}`);
  }
  async attach(id: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file || this.uploading()) return;
    this.uploading.set(id);
    try {
      const form = new FormData();
      form.append('file', file);
      await this.api.post(`feedback/${id}/attachments`, form);
      await this.resource.load();
      this.toasts.success(this.i18n.t('Screenshot attached.', 'أُرفقت لقطة الشاشة.'));
    } catch (error) {
      this.toasts.error(error);
    } finally {
      input.value = '';
      this.uploading.set('');
    }
  }
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.post('feedback', this.form.getRawValue());
      this.success.set(true);
      this.form.reset({ category: 'SUGGESTION', priority: 'MEDIUM', anonymous: false });
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
