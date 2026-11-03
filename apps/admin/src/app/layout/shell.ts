import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { TranslatePipe } from '@ngx-translate/core';
import { Toasts } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { Preferences } from '@lifequest/utilities';
import { Icon, Logo } from '@lifequest/ui';

@Component({
  selector: 'lq-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgTemplateOutlet, DrawerModule, Icon, Logo, TranslatePipe],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  readonly open = signal(false);
  readonly groups = [
    {
      titleKey: 'admin.navigation.workspace',
      items: [
        { path: 'overview', labelKey: 'admin.navigation.overview', icon: 'home', roles: [] },
        { path: 'users', labelKey: 'admin.navigation.people', icon: 'users', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
        { path: 'analytics', labelKey: 'admin.navigation.activityInsights', icon: 'chart', roles: ['SUPER_ADMIN', 'ADMIN', 'ANALYST'] },
        { path: 'challenges', labelKey: 'admin.navigation.challenges', icon: 'swords', roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST'] },
        { path: 'feedback', labelKey: 'admin.navigation.feedbackInbox', icon: 'message', roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'] },
      ],
    },
    {
      titleKey: 'admin.navigation.productContent',
      items: [
        { path: 'quests', labelKey: 'admin.navigation.weeklyQuests', icon: 'flag', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'] },
        { path: 'content/rewards', labelKey: 'admin.navigation.rewards', icon: 'gift', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'] },
        { path: 'content/achievements', labelKey: 'admin.navigation.achievements', icon: 'award', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'] },
        { path: 'content/help', labelKey: 'admin.navigation.helpContent', icon: 'help', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'] },
        { path: 'content/announcements', labelKey: 'admin.navigation.announcements', icon: 'bell', roles: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER'] },
      ],
    },
    {
      titleKey: 'admin.navigation.operations',
      items: [
        { path: 'audit-logs', labelKey: 'admin.navigation.auditTrail', icon: 'shield', roles: ['SUPER_ADMIN', 'ADMIN', 'ANALYST'] },
        { path: 'health', labelKey: 'admin.navigation.systemHealth', icon: 'activity', roles: [] },
        { path: 'settings', labelKey: 'admin.navigation.configuration', icon: 'settings', roles: ['SUPER_ADMIN', 'ADMIN'] },
      ],
    },
  ];

  allowed(roles: string[]) {
    return !roles.length || roles.includes(this.auth.user()?.role ?? '');
  }

  async logout() {
    try {
      await this.auth.logout();
      await this.router.navigate(['/auth/login']);
    } catch (error) {
      this.toasts.error(error);
    }
  }
}
