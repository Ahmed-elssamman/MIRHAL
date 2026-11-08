import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { KeyValuePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Api, Toasts } from '@mirhal/data-access';
import { AuthStore } from '@mirhal/auth';
import { LocalizedDatePipe, Preferences } from '@mirhal/utilities';
import { ErrorState, Icon, PageHeader } from '@mirhal/ui';
import { AdminUser } from '../../models';
const countLabels: Record<string, [string, string]> = {
  goals: ['Goals', 'الأهداف'],
  projects: ['Projects', 'المشاريع'],
  tasks: ['Tasks', 'المهام'],
  habits: ['Habits', 'العادات'],
  habitLogs: ['Habit logs', 'سجلات العادات'],
  checkIns: ['Check-ins', 'المراجعات اليومية'],
  participations: ['Challenges', 'التحديات'],
  redemptions: ['Reward redemptions', 'استبدالات المكافآت'],
};
@Component({
  selector: 'lq-admin-user-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    LocalizedDatePipe,
    KeyValuePipe,
    PageHeader,
    ErrorState,
    Icon,
  ],
  template: `<lq-page-header
      [eyebrow]="'admin.features.users.copy.privacy_respecting_support_07c4054f' | translate"
      [title]="
        resource.data()?.profile?.displayName ??
        ('admin.features.users.copy.an_explorer_s_account_7ac92782' | translate)
      "
      [description]="
        'admin.features.users.copy.account_access_and_aggregate_activity_private_reflections_and_habit_details_are_not_included_bca5b700'
          | translate
      "
      ><a routerLink="/users" class="btn btn-secondary"
        ><lq-icon name="arrow-left" [size]="16" />{{
          'admin.features.users.copy.all_people_0a28306f' | translate
        }}</a
      ></lq-page-header
    >
    @if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else if (resource.data(); as user) {
      <section class="card mb-6 p-6">
        <div class="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p class="text-sm font-semibold">{{ user.email }}</p>
            <p class="mt-2 text-xs text-muted">
              {{ 'admin.features.users.copy.joined_f8f2b670' | translate }}
              {{ user.createdAt | date: 'longDate' }} ·
              {{ user.profile.timezone }}
            </p>
            <span class="badge mt-3 bg-brand-soft text-brand"
              >{{ i18n.label(user.role) }} · {{ i18n.label(user.status) }}</span
            >
          </div>
          @if (['SUPER_ADMIN', 'ADMIN'].includes(auth.user()?.role ?? '')) {
            <button class="btn btn-secondary text-xs" (click)="changeStatus(user)">
              {{
                user.status === 'ACTIVE'
                  ? ('admin.features.users.copy.suspend_account_627ba0e8' | translate)
                  : ('admin.features.users.copy.reactivate_account_f5567166' | translate)
              }}
            </button>
          }
        </div>
        @if (auth.user()?.role === 'SUPER_ADMIN') {
          <label class="field-label mt-6" for="staff-role">{{
            'admin.features.users.copy.account_role_ce2a45fc' | translate
          }}</label
          ><select
            id="staff-role"
            #role
            class="field max-w-sm"
            [value]="user.role"
            (change)="changeRole(user, role.value)"
          >
            @for (item of roles; track item) {
              <option [value]="item">{{ i18n.label(item) }}</option>
            }
          </select>
        }
      </section>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (item of user._count | keyvalue; track item.key) {
          <div class="card p-5">
            <p class="eyebrow">{{ countLabel(item.key) }}</p>
            <p class="mt-3 text-3xl font-semibold">{{ item.value }}</p>
          </div>
        }
      </div>
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserDetailPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(ConfirmationService);
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<AdminUser>(
    `admin/users/${this.route.snapshot.paramMap.get('id')}`,
  );
  readonly roles = [
    'USER',
    'SUPER_ADMIN',
    'ADMIN',
    'MODERATOR',
    'SUPPORT',
    'CONTENT_MANAGER',
    'ANALYST',
  ];
  countLabel(key: string) {
    const label = countLabels[key];
    return label ? this.i18n.t(...label) : key;
  }
  changeStatus(user: AdminUser) {
    this.confirm.confirm({
      header: this.i18n.t('Update account access', 'تحديث وصول الحساب'),
      message: this.i18n.t(
        'This action will end existing sessions and be recorded in the audit trail.',
        'سينهي هذا الإجراء الجلسات الحالية ويُسجل في سجل التدقيق.',
      ),
      accept: () =>
        void this.update(user.id, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
    });
  }
  changeRole(user: AdminUser, role: string) {
    this.confirm.confirm({
      header: this.i18n.t('Change account role', 'تغيير دور الحساب'),
      message: this.i18n.t(
        `Assign ${this.i18n.label(role)} access? This changes permissions.`,
        `تعيين صلاحية ${this.i18n.label(role)}؟ سيغير هذا الأذونات.`,
      ),
      accept: () => void this.update(user.id, { role }),
    });
  }
  async update(id: string, input: unknown) {
    try {
      await this.api.patch(`admin/users/${id}`, input);
      this.toasts.success(this.i18n.t('Access updated and audited.', 'تم تحديث الوصول وتسجيله.'));
      await this.resource.load();
    } catch (error) {
      this.toasts.error(error);
    }
  }
}
