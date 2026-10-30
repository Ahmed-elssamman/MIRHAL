import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Api, errorMessage, Toasts } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Icon } from '@lifequest/ui';
import { applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-security-settings',
  imports: [LocalizedDatePipe, ReactiveFormsModule, DialogModule, Icon, FormField],
  templateUrl: './security.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecuritySettings {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  readonly capabilities = this.api.resource<{ emailDelivery: boolean }>('auth/capabilities');
  readonly sessions =
    this.api.resource<{ id: string; createdAt: string; expiresAt: string }[]>('account/sessions');
  readonly deleting = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    password: ['', Validators.required],
    confirmation: ['', Validators.pattern(/^DELETE$/)],
  });
  async export() {
    this.busy.set(true);
    try {
      const data = await this.api.post('account/export');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mirhal-my-journey.json';
      a.click();
      URL.revokeObjectURL(url);
      this.toasts.success(
        this.i18n.t('Your journey, ready to take with you.', 'رحلتك جاهزة لتأخذها معك.'),
      );
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(false);
    }
  }
  async logoutAll() {
    await this.api.post('auth/logout-all');
    this.auth.user.set(null);
    await this.router.navigate(['/auth/login']);
  }
  async verify() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const result = await this.api.post<{
        status: 'accepted' | 'already-verified' | 'rate-limited';
      }>('auth/resend-verification');
      if (result.status === 'accepted')
        this.toasts.success(
          this.i18n.t(
            'The email provider accepted the request. Check your inbox and spam folder.',
            'قبل مزود البريد الطلب. تحقق من الوارد والبريد غير المرغوب فيه.',
          ),
        );
      else if (result.status === 'already-verified')
        this.toasts.success(
          this.i18n.t('Your email is already verified.', 'بريدك الإلكتروني مؤكد بالفعل.'),
        );
      else
        this.toasts.error(
          this.i18n.t(
            'The request limit was reached. Please wait before trying again.',
            'وصلت إلى حد الطلبات. انتظر قليلاً قبل المحاولة مجدداً.',
          ),
        );
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(false);
    }
  }
  async remove() {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.api.post('account/delete', this.form.getRawValue());
      this.auth.user.set(null);
      await this.router.navigate(['/']);
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
