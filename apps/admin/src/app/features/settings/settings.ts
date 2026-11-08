import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Api, Toasts } from '@mirhal/data-access';
import { PageHeader } from '@mirhal/ui';
import { FormField } from '@mirhal/forms';

@Component({
  selector: 'lq-admin-settings',
  imports: [ReactiveFormsModule, PageHeader, FormField, TranslatePipe],
  template: `<lq-page-header
      [eyebrow]="'adminSettings.eyebrow' | translate"
      [title]="'adminSettings.title' | translate"
      [description]="'adminSettings.description' | translate"
    />
    <section class="card max-w-3xl p-6">
      <form [formGroup]="form" (ngSubmit)="save()">
        <lq-field id="system-key" [label]="'adminSettings.setting' | translate">
          <select id="system-key" class="field" formControlName="key">
            <option value="support_email">{{ 'adminSettings.supportEmail' | translate }}</option>
            <option value="maintenance_message">
              {{ 'adminSettings.maintenanceMessage' | translate }}
            </option>
            <option value="registration_notice">
              {{ 'adminSettings.registrationNotice' | translate }}
            </option>
          </select>
        </lq-field>
        <lq-field id="system-value" [label]="'adminSettings.value' | translate">
          <textarea id="system-value" class="field" rows="3" formControlName="value"></textarea>
        </lq-field>
        <button class="btn btn-primary" type="submit" [disabled]="saving()">
          {{ 'adminSettings.save' | translate }}
        </button>
      </form>
      <div class="mt-7 space-y-3 border-t border-line pt-5">
        @for (setting of resource.data(); track setting.key) {
          <button
            class="block w-full rounded-xl bg-canvas p-4 text-start"
            (click)="form.patchValue({ key: setting.key, value: setting.value })"
          >
            <p class="text-xs font-medium">{{ setting.description }}</p>
            <p class="mt-2 text-xs leading-6 text-muted">
              {{ setting.value || ('adminSettings.notSet' | translate) }}
            </p>
          </button>
        }
      </div>
    </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  private readonly translations = inject(TranslateService);
  readonly resource =
    this.api.resource<{ key: string; value: string; description: string }[]>('admin/settings');
  readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({ key: ['support_email'], value: [''] });

  async save() {
    this.saving.set(true);
    try {
      const input = this.form.getRawValue();
      await this.api.patch(`admin/settings/${input.key}`, { value: input.value });
      this.toasts.success(this.translations.instant('adminSettings.updated'));
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.saving.set(false);
    }
  }
}
