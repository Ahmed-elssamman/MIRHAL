import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, Page, Toasts } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { Pagination, EmptyState, ErrorState, Icon, PageHeader } from '@lifequest/ui';
import { applyServerValidation, FormField } from '@lifequest/forms';
import { catalogs } from './catalogs';
type CatalogItem = {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  body?: string;
  bodyAr?: string;
  active?: boolean;
  published?: boolean;
  cost?: number;
  threshold?: number;
} & Record<string, string | number | boolean | null | undefined>;
@Component({
  selector: 'lq-admin-content',
  imports: [
    TranslatePipe,
    Pagination,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Icon,
    FormField,
  ],
  templateUrl: './content.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminContentPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly kind = String(this.route.snapshot.data['kind'] ?? '');
  readonly definition = this.definitionFor(this.kind);
  readonly resource = this.api.resource<Page<CatalogItem>>(`admin/${this.kind}`);
  readonly open = signal(false);
  readonly editing = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = new FormRecord<FormControl<string | number | boolean>>({});
  private definitionFor(kind: string) {
    const definition = catalogs[kind as keyof typeof catalogs];
    if (!definition) throw new Error(`Unknown admin content catalog: ${kind}`);
    return definition;
  }
  displayTitle(item: CatalogItem) {
    return this.i18n.t(
      item.title,
      item.titleAr ||
        this.i18n.t('Arabic title is not available yet.', 'ترجمة العنوان غير متاحة بعد.'),
    );
  }
  displaySummary(item: CatalogItem) {
    return this.i18n.t(
      item.description || item.body || '',
      item.descriptionAr ||
        item.bodyAr ||
        this.i18n.t('Arabic translation is not available yet.', 'الترجمة العربية غير متاحة بعد.'),
    );
  }
  constructor() {
    for (const field of this.definition.fields)
      this.form.addControl(
        field.key,
        new FormControl(field.value, {
          nonNullable: true,
          validators: field.required ? [Validators.required] : [],
        }),
      );
  }
  edit(item?: CatalogItem) {
    this.editing.set(item?.id ?? null);
    for (const field of this.definition.fields) {
      const control = this.form.controls[field.key];
      if (!control) throw new Error(`Missing admin content form control: ${field.key}`);
      control.setValue(item?.[field.key] ?? field.value);
    }
    this.error.set('');
    this.open.set(true);
  }
  page(page: number) {
    void this.resource.load(`admin/${this.kind}?page=${page}`);
  }
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const id = this.editing();
      if (id) await this.api.patch(`admin/${this.kind}/${id}`, this.form.getRawValue());
      else await this.api.post(`admin/${this.kind}`, this.form.getRawValue());
      this.open.set(false);
      this.toasts.success(this.i18n.t('Content saved and audited.', 'تم حفظ المحتوى وتسجيله.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
