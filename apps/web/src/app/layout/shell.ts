import { Avatar } from '@lifequest/ui';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DrawerModule } from 'primeng/drawer';
import { Toasts } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { LocalizedDatePipe, Preferences } from '@lifequest/utilities';
import { Icon, Logo } from '@lifequest/ui';
import { NotificationOverlay } from '../features/notifications/notification-overlay';
import { InstallExperience } from '../pwa/install-experience';
import { PwaInstallation } from '../pwa/install';
@Component({
  selector: 'lq-shell',
  imports: [
    Avatar,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LocalizedDatePipe,
    NgTemplateOutlet,
    DrawerModule,
    Icon,
    Logo,
    NotificationOverlay,
    InstallExperience,
  ],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  readonly auth = inject(AuthStore);
  readonly i18n = inject(Preferences);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  readonly install = inject(PwaInstallation);
  readonly menuOpen = signal(false);
  readonly moreOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly loggingOut = signal(false);
  readonly online = signal(true);
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly today = new Date();
  readonly navigation = [
    {
      label: 'YOUR JOURNEY',
      ar: 'رحلتك',
      items: [
        { path: '/today', title: 'Today', ar: 'اليوم', icon: 'calendar' },
        { path: '/tasks', title: 'Tasks', ar: 'المهام', icon: 'tasks' },
        { path: '/habits', title: 'Habits', ar: 'العادات', icon: 'sprout' },
        { path: '/journey', title: 'My journey', ar: 'رحلتي', icon: 'map' },
        { path: '/friends', title: 'Friends', ar: 'الأصدقاء', icon: 'users' },
        { path: '/dashboard', title: 'Home', ar: 'الرئيسية', icon: 'home' },
      ],
    },
  ];
  readonly more = [
    { path: '/goals', title: 'Goals', ar: 'الأهداف', icon: 'target' },
    { path: '/projects', title: 'Projects', ar: 'المشروعات', icon: 'folder' },
    { path: '/habit-lab', title: 'Habit Lab', ar: 'مختبر العادات', icon: 'flask' },
    { path: '/challenges', title: 'Challenges', ar: 'التحديات', icon: 'swords' },
    { path: '/rewards', title: 'Rewards', ar: 'المكافآت', icon: 'gift' },
    { path: '/achievements', title: 'Achievements', ar: 'الإنجازات', icon: 'award' },
    { path: '/analytics', title: 'Analytics', ar: 'التحليلات', icon: 'chart' },
    { path: '/quests', title: 'Weekly quests', ar: 'المهام الأسبوعية', icon: 'flag' },
  ];
  readonly bottom = [
    { path: '/today', title: 'Today', ar: 'اليوم', icon: 'calendar' },
    { path: '/habits', title: 'Habits', ar: 'العادات', icon: 'sprout' },
    { path: '/tasks', title: 'Tasks', ar: 'المهام', icon: 'tasks' },
    { path: '/journey', title: 'Journey', ar: 'رحلتي', icon: 'map' },
  ];
  constructor() {
    const destroyRef = inject(DestroyRef);
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const windowRef = this.element.nativeElement.ownerDocument.defaultView;
      if (windowRef) {
        this.online.set(windowRef.navigator.onLine);
        const updateOnline = () => this.online.set(windowRef.navigator.onLine);
        windowRef.addEventListener('online', updateOnline);
        windowRef.addEventListener('offline', updateOnline);
        destroyRef.onDestroy(() => {
          windowRef.removeEventListener('online', updateOnline);
          windowRef.removeEventListener('offline', updateOnline);
        });
      }
    }
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((event) => {
        this.profileOpen.set(false);
        if (this.more.some((item) => event.urlAfterRedirects.startsWith(item.path))) {
          this.moreOpen.set(true);
        }
      });
    if (this.more.some((item) => this.router.url.startsWith(item.path))) {
      this.moreOpen.set(true);
    }
  }

  @HostListener('document:click', ['$event'])
  closeProfileOnOutside(event: MouseEvent) {
    const target = event.target;
    if (target instanceof Element && !target.closest('[data-profile-control]'))
      this.profileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeProfileOnEscape() {
    if (this.profileOpen()) this.closeProfileMenu(true);
  }

  closeProfileMenu(restoreFocus = false) {
    this.profileOpen.set(false);
    if (restoreFocus) this.element.nativeElement.querySelector('[data-profile-trigger]')?.focus();
  }

  installationHelp() {
    this.closeProfileMenu();
    if (this.install.canInstall()) void this.install.install();
    else this.install.openHelp();
  }

  async logout() {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.closeProfileMenu();
    try {
      await this.auth.logout();
      await this.router.navigate(['/auth/login']);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.loggingOut.set(false);
    }
  }
}
