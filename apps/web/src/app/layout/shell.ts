import { Avatar } from '@mirhal/ui';
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
import { TranslatePipe } from '@ngx-translate/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DrawerModule } from 'primeng/drawer';
import { Toasts } from '@mirhal/data-access';
import { AuthStore } from '@mirhal/auth';
import { LocalizedDatePipe, Preferences } from '@mirhal/utilities';
import { Icon, Logo } from '@mirhal/ui';
import { NotificationOverlay } from '../features/notifications/notification-overlay';
import { InstallExperience } from '../pwa/install-experience';
import { PwaInstallation } from '../pwa/install';
@Component({
  selector: 'lq-shell',
  imports: [
    TranslatePipe,
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
      labelKey: 'web.navigation.yourJourney',
      items: [
        { path: '/today', titleKey: 'web.navigation.today', icon: 'calendar' },
        { path: '/tasks', titleKey: 'web.navigation.tasks', icon: 'tasks' },
        { path: '/habits', titleKey: 'web.navigation.habits', icon: 'sprout' },
        { path: '/journey', titleKey: 'web.navigation.myJourney', icon: 'map' },
        { path: '/friends', titleKey: 'web.navigation.friends', icon: 'users' },
        { path: '/dashboard', titleKey: 'web.navigation.home', icon: 'home' },
      ],
    },
  ];
  readonly more = [
    { path: '/goals', titleKey: 'web.navigation.goals', icon: 'target' },
    { path: '/projects', titleKey: 'web.navigation.projects', icon: 'folder' },
    { path: '/habit-lab', titleKey: 'web.navigation.habitLab', icon: 'flask' },
    { path: '/challenges', titleKey: 'web.navigation.challenges', icon: 'swords' },
    { path: '/rewards', titleKey: 'web.navigation.rewards', icon: 'gift' },
    { path: '/achievements', titleKey: 'web.navigation.achievements', icon: 'award' },
    { path: '/analytics', titleKey: 'web.navigation.analytics', icon: 'chart' },
    { path: '/quests', titleKey: 'web.navigation.weeklyQuests', icon: 'flag' },
  ];
  readonly bottom = [
    { path: '/today', titleKey: 'web.navigation.today', icon: 'calendar' },
    { path: '/habits', titleKey: 'web.navigation.habits', icon: 'sprout' },
    { path: '/tasks', titleKey: 'web.navigation.tasks', icon: 'tasks' },
    { path: '/journey', titleKey: 'web.navigation.journey', icon: 'map' },
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
