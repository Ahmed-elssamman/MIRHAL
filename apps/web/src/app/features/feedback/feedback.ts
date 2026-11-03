import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, Page, errorMessage, Feedback, Toasts } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Pagination, ErrorState, Icon, PageHeader, SectionTitle, Skeleton } from '@lifequest/ui';
import { UnsavedForm, applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-feedback',
  imports: [
    UnsavedForm,
    Pagination,
    LocalizedDatePipe,
    ReactiveFormsModule,
    PageHeader,
    ErrorState,
    Icon,
    SectionTitle,
    FormField,
    Skeleton,
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
    { id: 'BUG', en: 'Something is broken', ar: 'شيء لا يعمل' },
    { id: 'SUGGESTION', en: 'A little suggestion', ar: 'اقتراح صغير' },
    { id: 'UX', en: 'Make it easier to use', ar: 'اجعل الاستخدام أسهل' },
    { id: 'FEATURE', en: 'A feature I would love', ar: 'ميزة أود إضافتها' },
    { id: 'CONTENT', en: 'Content feedback', ar: 'ملاحظات على المحتوى' },
    { id: 'COMPLAINT', en: 'A concern to raise', ar: 'شكوى أو قلق' },
    { id: 'OTHER', en: 'Something else', ar: 'شيء آخر' },
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
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
