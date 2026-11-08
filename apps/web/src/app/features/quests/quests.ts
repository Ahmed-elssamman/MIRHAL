import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import {
  Api,
  Page,
  Area,
  Quest,
  QuestTemplate,
  Toasts,
} from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import {
  Pagination,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Progress,
} from '@lifequest/ui';
import { applyServerValidation, FormField, DiscardChanges, UnsavedForm } from '@lifequest/forms';
@Component({
  selector: 'lq-quests',
  imports: [
    TranslatePipe,
    Pagination,
    LocalizedDatePipe,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Icon,
    Progress,
    FormField,
    UnsavedForm,
  ],
  templateUrl: './quests.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  readonly discard = inject(DiscardChanges);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Quest>>('quests');
  readonly templates = this.api.resource<QuestTemplate[]>('quest-templates');
  readonly visibleTemplates = computed(() =>
    this.i18n.language() === 'en'
      ? (this.templates.data() ?? [])
      : (this.templates.data() ?? []).filter(
          (template) =>
            (!template.description || Boolean(template.descriptionAr.trim())) &&
            template.items.every((item) => Boolean(item.titleAr.trim())),
        ),
  );
  readonly areas = this.api.resource<Area[]>('life-areas');
  readonly open = signal(false);
  readonly busy = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    areaId: ['', Validators.required],
    difficulty: ['MEDIUM'],
    deadline: ['', Validators.required],
    items: ['', Validators.required],
    realReward: [''],
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
    this.form.reset({
      areaId: this.areas.data()?.[0]?.id ?? '',
      difficulty: 'MEDIUM',
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    this.error.set('');
    this.open.set(true);
  }
  async useTemplate(template: QuestTemplate) {
    await this.create();
    if (!this.open()) return;
    this.form.patchValue({
      title: this.i18n.t(template.title, template.titleAr),
      description: this.i18n.t(template.description, template.descriptionAr),
      areaId: template.areaId,
      difficulty: template.difficulty,
      items: template.items.map((item) => this.i18n.t(item.title, item.titleAr)).join('\n'),
    });
  }
  page(page: number) {
    void this.resource.load(`quests?page=${page}`);
  }
  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const values = this.form.getRawValue();
      await this.api.post('quests', {
        ...values,
        deadline: new Date(values.deadline + 'T23:59:00').toISOString(),
        items: values.items
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      this.form.markAsPristine();
      this.open.set(false);
      this.toasts.success(this.i18n.t('Your week has a new focus.', 'لأسبوعك تركيز جديد.'));
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async complete(quest: Quest, itemId: string) {
    if (this.busy()) return;
    this.busy.set(itemId);
    try {
      const result = await this.api.post<{ completed: boolean; awarded: number }>(
        `quests/${quest.id}/items/${itemId}/complete`,
      );
      this.toasts.success(
        result.completed
          ? this.i18n.t(
              'Quest complete. Take a moment to enjoy it.',
              'اكتملت المهمة. استمتع باللحظة.',
            )
          : this.i18n.t('A step closer.', 'خطوة أقرب.'),
        result.awarded ? `+${result.awarded} XP` : undefined,
      );
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
  expired(quest: Quest) {
    return new Date(quest.deadline) < new Date();
  }
}
