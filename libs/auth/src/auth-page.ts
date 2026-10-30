import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api, errorMessage } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { Icon, Logo } from '@lifequest/ui';
import { FormField } from '@lifequest/forms';
import { AuthStore } from './index';
@Component({
  selector: 'lq-auth-page',
  imports: [RouterLink, ReactiveFormsModule, Icon, Logo, FormField],
  templateUrl: './auth-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  readonly i18n = inject(Preferences);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly mode = computed(() => this.params().get('mode') ?? 'login');
  readonly isAdmin = this.route.snapshot.data['admin'] === true;
  private readonly auth = inject(AuthStore);
  private readonly api = inject(Api);
  readonly capabilities = this.api.resource<{ emailDelivery: boolean }>('auth/capabilities');
  readonly settings = this.api.resource<{ key: string; value: string }[]>('public-settings');
  readonly notice = computed(
    () => this.settings.data()?.find((item) => item.key === 'registration_notice')?.value ?? '',
  );
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly inviteToken = computed(() => {
    const qp = this.route.snapshot.queryParamMap;
    return qp.get('inviteToken') || (this.mode() === 'register' ? qp.get('token') : null) || '';
  });
  readonly invitationInfo = signal<{
    valid: boolean;
    inviterName?: string;
    email?: string;
    reason?: string;
  } | null>(null);

  readonly invitationBanner = computed(() => {
    const info = this.invitationInfo();
    if (!info) return null;
    if (info.valid && info.inviterName) {
      return {
        title: this.i18n.t(
          `You've been invited by ${info.inviterName}!`,
          `تمت دعوتك بواسطة ${info.inviterName}!`,
        ),
        message: this.i18n.t(
          'Create your account to start your shared journey on MIRHAL.',
          'أنشئ حسابك لتبدآ رحلتكما المشتركة على مِرحال.',
        ),
      };
    }
    if (info.reason === 'expired') {
      return {
        title: this.i18n.t('Invitation expired', 'انتهت صلاحية الدعوة'),
        message: this.i18n.t(
          'This invitation link has expired, but you can still create an account to start your journey.',
          'انتهت صلاحية رابط الدعوة هذا، ولكن لا يزال بإمكانك إنشاء حساب لبدء رحلتك.',
        ),
      };
    }
    if (info.reason === 'already-used') {
      return {
        title: this.i18n.t('Invitation already used', 'تم استخدام الدعوة بالفعل'),
        message: this.i18n.t(
          'This invitation has already been accepted. Sign in with your existing account.',
          'تم قبول هذه الدعوة بالفعل. سجل الدخول باستخدام حسابك الحالي.',
        ),
      };
    }
    return null;
  });

  constructor() {
    const token = this.inviteToken();
    if (token) {
      this.api
        .get<{ valid: boolean; inviterName?: string; email?: string; reason?: string }>(
          `friends/invitations/resolve?token=${encodeURIComponent(token)}`,
        )
        .then((res) => {
          this.invitationInfo.set(res);
          if (res.valid && res.email && !this.form.controls.email.value) {
            this.form.patchValue({ email: res.email });
          }
        })
        .catch(() => null);
    }
  }

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'register':
        return this.i18n.t('Your next chapter starts here.', 'فصلك القادم يبدأ هنا.');
      case 'forgot-password':
        return this.i18n.t('Let’s get you back in.', 'لنعد إلى رحلتك.');
      case 'reset-password':
        return this.i18n.t('A fresh start.', 'بداية جديدة.');
      case 'verify-email':
        return this.i18n.t('Make it official.', 'لنؤكد بريدك الإلكتروني.');
      default:
        return this.i18n.t(
          this.isAdmin ? 'Welcome to the control room.' : 'Welcome back, explorer.',
          this.isAdmin ? 'مرحباً في مركز الإدارة.' : 'مرحباً بعودتك، أيها المستكشف.',
        );
    }
  });
  async submit() {
    if (this.busy()) return;
    this.error.set('');
    this.success.set('');
    const input = this.form.getRawValue();
    const mode = this.mode();
    if (
      ['login', 'register', 'forgot-password'].includes(mode) &&
      this.form.controls.email.invalid
    ) {
      this.error.set(this.i18n.t('Enter a valid email address.', 'أدخل بريداً إلكترونياً صحيحاً.'));
      return;
    }
    if (['login', 'register', 'reset-password'].includes(mode) && input.password.length < 12) {
      this.error.set(
        this.i18n.t(
          'Use a password with at least 12 characters.',
          'استخدم كلمة مرور من 12 حرفاً على الأقل.',
        ),
      );
      return;
    }
    if (mode === 'register' && input.displayName.trim().length < 2) {
      this.error.set(this.i18n.t('Tell us what to call you.', 'أخبرنا باسمك.'));
      return;
    }
    this.busy.set(true);
    try {
      if (mode === 'forgot-password') {
        await this.api.post('auth/forgot-password', { email: input.email });
        this.success.set(
          this.i18n.t(
            'For privacy, we respond the same way whether or not that email is linked to an account. If eligible, check your inbox and spam folder for the recovery link.',
            'حفاظاً على الخصوصية، تكون الاستجابة واحدة سواء ارتبط البريد بحساب أم لا. إذا كان مؤهلاً، فتحقق من الوارد والبريد غير المرغوب فيه لرابط الاستعادة.',
          ),
        );
      } else if (mode === 'reset-password' || mode === 'verify-email') {
        const token = this.route.snapshot.queryParamMap.get('token');
        await this.api.post(`auth/${mode}`, {
          token,
          ...(mode === 'reset-password' ? { password: input.password } : {}),
        });
        this.success.set(
          this.i18n.t(
            'You’re all set. Sign in to continue your journey.',
            'كل شيء جاهز. سجل دخولك لمتابعة الرحلة.',
          ),
        );
      } else {
        const inviteToken =
          mode === 'register' && this.inviteToken() ? this.inviteToken() : undefined;
        const registration =
          mode === 'register'
            ? await this.auth.register({
                ...input,
                inviteToken,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              })
            : undefined;
        const user = registration?.user ?? (await this.auth.login(input.email, input.password));
        if (this.isAdmin && user.role === 'USER') {
          await this.auth.logout();
          this.error.set(
            this.i18n.t(
              'This account does not have administrator access.',
              'هذا الحساب لا يملك صلاحية الإدارة.',
            ),
          );
          return;
        }
        await this.router.navigate([
          this.isAdmin
            ? '/overview'
            : user.profile.onboardingCompletedAt
              ? '/today'
              : '/onboarding',
        ]);
      }
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
