import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Api, Page } from '@lifequest/data-access';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { AccessibleTable, ErrorState, Icon, PageHeader, Pagination, Skeleton } from '@lifequest/ui';
import { AdminUser } from '../../models';
@Component({
  selector: 'lq-admin-users',
  imports: [
    TranslatePipe,
    RouterLink,
    LocalizedDatePipe,
    FormsModule,
    TableModule,
    AccessibleTable,
    PageHeader,
    ErrorState,
    Skeleton,
    Icon,
    Pagination,
  ],
  templateUrl: './users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPage {
  private readonly api = inject(Api);
  readonly i18n = inject(Preferences);
  readonly resource = this.api.resource<Page<AdminUser>>('admin/users');
  readonly search = signal('');
  readonly status = signal('');
  find(page = 1) {
    void this.resource.load(
      `admin/users?page=${page}&search=${encodeURIComponent(this.search())}&status=${this.status()}`,
    );
  }
}
