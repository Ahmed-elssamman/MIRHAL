import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Api } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { ErrorState, Icon, PageHeader, Skeleton, StatCard } from '@lifequest/ui';
import { Health } from '../../models';
@Component({
  selector: 'lq-admin-health',
  imports: [
    TranslatePipe,LocalizedDatePipe, PageHeader, ErrorState, Skeleton, Icon, StatCard],
  template: `<lq-page-header
      [eyebrow]="('admin.features.health.copy.keep_the_foundations_healthy_03308ec4' | translate)"
      [title]="('admin.features.health.copy.a_pulse_on_the_system_6b48dd80' | translate)"
      [description]="
        ('admin.features.health.copy.application_and_database_checks_plus_email_configuration_status_8cab9dd4' | translate)
      "
      ><button class="btn btn-secondary" (click)="resource.load()">
        <lq-icon name="refresh" [size]="16" />{{ ('admin.features.health.copy.check_now_4f0e0677' | translate) }}
      </button></lq-page-header
    >
    @if (resource.loading() && !resource.data()) {
      <lq-skeleton />
    } @else if (resource.error()) {
      <lq-error [message]="resource.error()" (retry)="resource.load()" />
    } @else if (resource.data(); as data) {
      <section class="mb-6 flex items-center gap-4 rounded-2xl bg-mint p-7 text-mint-ink">
        <lq-icon name="circle-check" [size]="36" />
        <div>
          <h2 class="text-lg font-semibold">
            {{ ('admin.features.health.copy.application_is_responding_2c70ec50' | translate) }}
          </h2>
          <p class="mt-2 text-xs">
            {{ ('admin.features.health.copy.database_connectivity_verified_at_7d270df2' | translate) }}
            {{ data.timestamp | date: 'h:mm:ss a' }}
          </p>
        </div>
      </section>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <lq-stat
          [label]="('admin.features.health.copy.database_f09430d8' | translate)"
          [value]="('admin.features.health.copy.connected_7bf69370' | translate)"
          icon="activity"
        /><lq-stat
          [label]="('admin.features.health.copy.email_configuration_c601c6b9' | translate)"
          [value]="emailStatus(data.email.status)"
          [suffix]="emailProvider(data.email.provider)"
          icon="mail"
        /><lq-stat
          [label]="('admin.features.health.copy.version_5dcdd537' | translate)"
          [value]="data.version"
          icon="flag"
        /><lq-stat
          [label]="('admin.features.health.copy.environment_07245a9a' | translate)"
          [value]="environmentName(data.environment)"
          icon="shield"
        /><lq-stat
          [label]="('admin.features.health.copy.uptime_42d976f9' | translate)"
          [value]="data.uptime"
          [suffix]="('admin.features.health.copy.s_f60c4582' | translate)"
          icon="sun"
        />
      </div>
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHealthPage {
  private readonly api = inject(Api);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Health>('admin/health');
  emailStatus(status: Health['email']['status']) {
    if (status === 'configured') return this.i18n.t('Configured', 'مهيأ');
    if (status === 'disabled') return this.i18n.t('Disabled', 'معطل');
    return this.i18n.t('Incomplete', 'غير مكتمل');
  }
  emailProvider(provider: string) {
    if (provider === 'file') return this.i18n.t('Local file', 'ملف محلي');
    if (provider === 'smtp') return 'SMTP';
    if (provider === 'resend') return 'Resend';
    return this.i18n.t('Unknown', 'غير معروف');
  }
  environmentName(value: string) {
    if (value === 'production') return this.i18n.t('Production', 'إنتاج');
    if (value === 'test') return this.i18n.t('Test', 'اختبار');
    return this.i18n.t('Development', 'تطوير');
  }
}
