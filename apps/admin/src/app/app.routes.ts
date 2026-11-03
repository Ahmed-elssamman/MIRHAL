import { unsavedChangesGuard } from '@lifequest/forms';
import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { adminGuard, AuthStore, unauthGuard } from '@lifequest/auth';
const access: CanActivateFn = (route) => {
  const user = inject(AuthStore).user();
  const roles = route.data['roles'] as string[] | undefined;
  return !roles || roles.includes(user?.role ?? '')
    ? true
    : inject(Router).createUrlTree(['/overview']);
};
const manage = ['SUPER_ADMIN', 'ADMIN'];
const content = [...manage, 'CONTENT_MANAGER'];
export const routes: Routes = [
  {
    path: 'auth/:mode',
    data: { admin: true },
    canActivate: [unauthGuard],
    loadComponent: () => import('../../../../libs/auth/src/auth-page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/overview/overview').then((m) => m.AdminOverviewPage),
      },
      {
        path: 'users',
        canActivate: [access],
        data: { roles: [...manage, 'SUPPORT'] },
        loadComponent: () => import('./features/users/users').then((m) => m.AdminUsersPage),
      },
      {
        path: 'users/:id',
        canActivate: [access],
        data: { roles: [...manage, 'SUPPORT'] },
        loadComponent: () =>
          import('./features/users/user-detail').then((m) => m.AdminUserDetailPage),
      },
      {
        path: 'feedback',
        canActivate: [access],
        data: { roles: [...manage, 'SUPPORT', 'MODERATOR'] },
        loadComponent: () =>
          import('./features/feedback/feedback').then((m) => m.AdminFeedbackPage),
      },
      {
        path: 'challenges',
        canActivate: [access],
        data: { roles: [...manage, 'MODERATOR', 'ANALYST'] },
        loadComponent: () =>
          import('./features/challenges/challenges').then((m) => m.AdminChallengesPage),
      },
      {
        path: 'analytics',
        canActivate: [access],
        data: { roles: [...manage, 'ANALYST'] },
        loadComponent: () =>
          import('./features/analytics/analytics').then((m) => m.AdminAnalyticsPage),
      },
      {
        path: 'quests',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [access],
        data: { roles: content },
        loadComponent: () => import('./features/quests/quests').then((m) => m.AdminQuestsPage),
      },
      ...['rewards', 'achievements', 'help', 'announcements'].map((kind) => ({
        path: `content/${kind}`,
        canActivate: [access],
        data: { roles: content, kind },
        loadComponent: () => import('./features/content/content').then((m) => m.AdminContentPage),
      })),
      {
        path: 'audit-logs',
        canActivate: [access],
        data: { roles: [...manage, 'ANALYST'] },
        loadComponent: () => import('./features/audit/audit').then((m) => m.AdminAuditPage),
      },
      {
        path: 'health',
        loadComponent: () => import('./features/health/health').then((m) => m.AdminHealthPage),
      },
      {
        path: 'settings',
        canActivate: [access],
        data: { roles: manage },
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.AdminSettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
