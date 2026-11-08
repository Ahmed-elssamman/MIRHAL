import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Area, Page, QuestTemplate, Toasts } from '@mirhal/data-access';
import { Preferences } from '@mirhal/utilities';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@mirhal/ui';
import { applyServerValidation, DiscardChanges, FormField, UnsavedForm } from '@mirhal/forms';
@Component({
  selector: 'lq-admin-quests',
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    DialogModule,
    EmptyState,
    ErrorState,
    PageHeader,
    Pagination,
    FormField,
    UnsavedForm,
  ],
  templateUrl: './quests.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminQuestsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly discard = inject(DiscardChanges);
  readonly resource = this.api.resource<Page<QuestTemplate>>('admin/quest-templates');
  readonly areas = this.api.resource<Area[]>('life-areas');
  readonly open = signal(false);
  readonly editing = signal<QuestTemplate | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    titleAr: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', Validators.required],
    descriptionAr: ['', Validators.required],
    areaId: ['', Validators.required],
    difficulty: ['MEDIUM'],
    active: [true],
    items: ['', Validators.required],
    itemsAr: ['', Validators.required],
  });
  edit(item?: QuestTemplate) {
    this.editing.set(item ?? null);
    this.error.set('');
    this.form.reset(
      item
        ? {
            ...item,
            items: item.items.map((step) => step.title).join('\n'),
            itemsAr: item.items.map((step) => step.titleAr).join('\n'),
          }
        : { areaId: this.areas.data()?.[0]?.id ?? '', difficulty: 'MEDIUM', active: true },
    );
    this.open.set(true);
  }
  async save() {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const items = value.items
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const itemsAr = value.itemsAr
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length !== itemsAr.length) {
      this.error.set(
        this.i18n.t(
          'Add one Arabic step for each English step.',
          'أضف خطوة عربية مقابل كل خطوة إنجليزية.',
        ),
      );
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const input = { ...value, items, itemsAr };
      const editing = this.editing();
      if (editing) await this.api.patch(`admin/quest-templates/${editing.id}`, input);
      else await this.api.post('admin/quest-templates', input);
      this.form.markAsPristine();
      this.open.set(false);
      await this.resource.load();
      this.toasts.success(
        this.i18n.t('Inspiration published and audited.', 'تم نشر الإلهام وتسجيل التعديل.'),
      );
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  page(page: number) {
    void this.resource.load(`admin/quest-templates?page=${page}`);
  }
}
