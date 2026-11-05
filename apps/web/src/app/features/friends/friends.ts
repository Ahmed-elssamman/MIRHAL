import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import { Api, Page, Friend, Toasts } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { Pagination, EmptyState, ErrorState, Icon, PageHeader, Skeleton } from '@lifequest/ui';
import { applyServerValidation, FormField } from '@lifequest/forms';
@Component({
  selector: 'lq-friends',
  imports: [
    TranslatePipe,
    Pagination,
    RouterLink,
    ReactiveFormsModule,
    DialogModule,
    PageHeader,
    EmptyState,
    ErrorState,
    Skeleton,
    Icon,
    FormField,
  ],
  templateUrl: './friends.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<Friend>>('friends');
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly busy = signal('');
  readonly error = signal('');
  readonly invitation = signal<{
    valid: boolean;
    inviterName?: string;
    reason?: string;
  } | null>(null);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  constructor() {
    const token = this.route.snapshot.queryParamMap.get('inviteToken');
    if (token) {
      void this.api
        .get<{ valid: boolean; inviterName?: string; reason?: string }>(
          `friends/invitations/resolve?token=${encodeURIComponent(token)}`,
        )
        .then((result) => this.invitation.set(result))
        .catch(() => this.invitation.set({ valid: false, reason: 'not-found' }));
    }
  }
  async respondToInvitation(action: 'accept' | 'decline') {
    const token = this.route.snapshot.queryParamMap.get('inviteToken');
    if (!token || this.busy()) return;
    this.busy.set('invitation');
    try {
      const result = await this.api.post<{ status: string }>(`friends/invitations/${action}`, {
        token,
      });
      if (result.status === 'awaiting_verification') {
        this.toasts.error(
          this.i18n.t(
            'Verify the invited email address before accepting this invitation.',
            'أكد البريد الإلكتروني المدعو قبل قبول الدعوة.',
          ),
        );
        return;
      }
      this.toasts.success(
        action === 'accept'
          ? this.i18n.t('You are now connected on MIRHAL.', 'أصبحتما على تواصل في مِرحال.')
          : this.i18n.t('Invitation declined.', 'تم رفض الدعوة.'),
      );
      this.invitation.set(null);
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { inviteToken: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
  page(page: number) {
    void this.resource.load(`friends?page=${page}`);
  }
  async invite() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await this.api.post<{
        channel: 'email' | 'friendship';
        emailStatus?: 'accepted';
      }>('friends', this.form.getRawValue());
      this.open.set(false);
      this.form.reset();
      if (result.channel === 'email' || result.emailStatus === 'accepted')
        this.toasts.success(
          this.i18n.t(
            'The email provider accepted your invitation. Your friend can check their inbox and spam folder.',
            'قبل مزود البريد الدعوة. يمكن لصديقك التحقق من الوارد والبريد غير المرغوب فيه.',
          ),
        );
      else
        this.toasts.success(
          this.i18n.t('A little company is on its way.', 'رفقة صغيرة في طريقها إليك.'),
        );
      await this.resource.load();
    } catch (error) {
      applyServerValidation(this.form, error);
      this.error.set(this.api.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async action(friend: Friend, action: string) {
    if (this.busy()) return;
    this.busy.set(friend.id);
    try {
      await this.api.post(`friends/${friend.id}/actions`, { action });
      this.toasts.success(this.i18n.t('Your connections are up to date.', 'تم تحديث اتصالاتك.'));
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set('');
    }
  }
  remove(friend: Friend, action: string) {
    this.confirm.confirm({
      header: this.i18n.t('Your space, your boundaries', 'مساحتك، حدودك'),
      message: this.i18n.t(
        `Would you like to ${action} this connection?`,
        `هل تريد ${action === 'block' ? 'حظر' : 'إزالة'} هذا الاتصال؟`,
      ),
      acceptLabel: this.i18n.t('Continue', 'متابعة'),
      rejectLabel: this.i18n.t('Keep connection', 'الاحتفاظ بالاتصال'),
      accept: () => void this.action(friend, action),
    });
  }
}
