import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Api, Dashboard } from '@mirhal/data-access';
import { Preferences } from '@mirhal/utilities';
import {
  ErrorState,
  Icon,
  PageHeader,
  Progress,
  ProgressRing,
  SectionTitle,
  StatCard,
} from '@mirhal/ui';
import { ActivityChart } from './activity-chart';
@Component({
  selector: 'lq-analytics',
  imports: [
    TranslatePipe,
    RouterLink,
    PageHeader,
    ErrorState,
    Icon,
    Progress,
    ProgressRing,
    SectionTitle,
    StatCard,
    ActivityChart,
  ],
  templateUrl: './analytics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  private readonly api = inject(Api);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Dashboard>('analytics');
}
