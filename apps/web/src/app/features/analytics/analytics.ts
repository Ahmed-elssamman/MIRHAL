import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { Api, Dashboard } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import {
  ErrorState,
  Icon,
  PageHeader,
  Progress,
  ProgressRing,
  SectionTitle,
  Skeleton,
  StatCard,
} from '@lifequest/ui';
import { ActivityChart } from './activity-chart';
@Component({
  selector: 'lq-analytics',
  imports: [
    TranslatePipe,
    RouterLink,
    PageHeader,
    ErrorState,
    Skeleton,
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
  factor(key: string) {
    const names: Record<string, [string, string]> = {
      habits: ['Habit consistency', 'استمرارية العادات'],
      quests: ['Weekly quests', 'المهام الأسبوعية'],
      goals: ['Goal progress', 'تقدم الأهداف'],
      checkIns: ['Daily reflection', 'التأمل اليومي'],
      projects: ['Project progress', 'تقدم المشروعات'],
      recovery: ['Recovery intentions', 'نوايا التعافي'],
    };
    const value = names[key];
    return value ? this.i18n.t(value[0], value[1]) : key;
  }
}
