import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Api } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { ErrorState, Icon, PageHeader, SectionTitle, Skeleton, StatCard } from '@lifequest/ui';
import { Overview } from '../../models';
@Component({
  selector: 'lq-admin-overview',
  imports: [
    RouterLink,
    DecimalPipe,
    TranslatePipe,
    PageHeader,
    ErrorState,
    Skeleton,
    Icon,
    SectionTitle,
    StatCard,
  ],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewPage {
  private readonly api = inject(Api);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Overview>('admin/overview');
}
