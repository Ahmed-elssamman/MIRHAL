import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api, errorMessage, Profile } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { Preferences } from '@lifequest/utilities';
import { Icon, PageHeader, Skeleton } from '@lifequest/ui';
import { UnsavedForm, applyServerValidation, FormField } from '@lifequest/forms';
import { SecuritySettings } from './security';
@Component({
  selector: 'lq-settings',
  imports: [UnsavedForm, ReactiveFormsModule, PageHeader, Icon, FormField, SecuritySettings, Skeleton],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  private navigationBeforeEdit = this.i18n.showAdditionalNavigation();
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    theme: [this.auth.user()?.profile.theme ?? 'system'],
    language: [this.auth.user()?.profile.language ?? 'en'],
    profileVisibility: [this.auth.user()?.profile.profileVisibility ?? 'PRIVATE'],
    shareChallengeScore: [this.auth.user()?.profile.shareChallengeScore ?? true],
    shareStreak: [this.auth.user()?.profile.shareStreak ?? false],
    notificationsEnabled: [this.auth.user()?.profile.notificationsEnabled ?? true],
    reducedMotion: [this.auth.user()?.profile.reducedMotion ?? false],
    showAdditionalNavigation: [this.auth.user()?.profile.showAdditionalNavigation ?? this.i18n.showAdditionalNavigation()],
  });
  async save() {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');
    try {
      const profile = await this.api.patch<Profile>('profile', this.form.getRawValue());
      const user = this.auth.user();
      if (user) this.auth.setUser({ ...user, profile });
      this.navigationBeforeEdit = profile.showAdditionalNavigation ?? false;
      this.form.markAsPristine();
      this.saved.set(true);
    } catch (error) {
      this.i18n.setShowAdditionalNavigation(this.navigationBeforeEdit);
      this.form.controls.showAdditionalNavigation.setValue(this.navigationBeforeEdit);
      applyServerValidation(this.form, error);
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
