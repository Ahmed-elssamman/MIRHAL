import { unsavedChangesGuard } from '@lifequest/forms';
import { Routes } from '@angular/router';
import { authGuard, onboardingCompleteGuard, unauthGuard } from '@lifequest/auth';
import { NotFoundPage } from './features/not-found/not-found';
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.LandingPage),
  },
  { path: 'help', loadComponent: () => import('./features/help/help').then((m) => m.HelpPage) },
  { path: 'how-it-works', redirectTo: 'help' },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.OnboardingPage),
  },
  {
    path: 'auth/:mode',
    canActivate: [unauthGuard],
    loadComponent: () => import('../../../../libs/auth/src/auth-page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [onboardingCompleteGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'quests',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/quests/quests').then((m) => m.QuestsPage),
      },
      {
        path: 'rewards',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/rewards/rewards').then((m) => m.RewardsPage),
      },
      {
        path: 'achievements',
        loadComponent: () =>
          import('./features/achievements/achievements').then((m) => m.AchievementsPage),
      },
      {
        path: 'friends',
        loadComponent: () => import('./features/friends/friends').then((m) => m.FriendsPage),
      },
      {
        path: 'challenges',
        loadComponent: () =>
          import('./features/challenges/challenges').then((m) => m.ChallengesPage),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics').then((m) => m.AnalyticsPage),
      },
      {
        path: 'journey',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/journey/journey').then((m) => m.JourneyPage),
      },
      {
        path: 'profile',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage),
      },
      {
        path: 'settings',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
      },
      {
        path: 'feedback',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/feedback/feedback').then((m) => m.FeedbackPage),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.NotificationsPage),
      },
      {
        path: 'today',
        loadComponent: () => import('./features/today/today').then((m) => m.TodayPage),
      },
      {
        path: 'habit-lab',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/habit-lab/habit-lab').then((m) => m.HabitLabPage),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'goals',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/goals/goals').then((m) => m.GoalsPage),
      },
      {
        path: 'projects',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/projects/projects').then((m) => m.ProjectsPage),
      },
      {
        path: 'tasks',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/tasks/tasks').then((m) => m.TasksPage),
      },
      {
        path: 'habits',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/habits/habits').then((m) => m.HabitsPage),
      },
    ],
  },
  { path: '**', component: NotFoundPage },
];
