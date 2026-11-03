import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

type InstallChoice = { outcome: 'accepted' | 'dismissed' };
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}
type GuidancePlatform = 'ios-safari' | 'android' | 'mac-safari' | 'unsupported';

const DISMISSAL_KEY = 'mirhal-install-dismissed-v1';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PwaInstallation {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private deferred?: InstallPromptEvent;
  readonly canInstall = signal(false);
  readonly installed = signal(false);
  readonly dismissed = signal(false);
  readonly helpOpen = signal(false);
  readonly platform = signal<GuidancePlatform>('unsupported');
  readonly hasGuidance = computed(() => this.platform() !== 'unsupported');
  readonly canOffer = computed(
    () => !this.installed() && !this.dismissed() && (this.canInstall() || this.hasGuidance()),
  );

  constructor() {
    if (!this.browser) return;
    const windowRef = this.document.defaultView;
    if (!windowRef) return;
    const navigatorRef = windowRef.navigator as Navigator & { standalone?: boolean };
    const userAgent = navigatorRef.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigatorRef.platform === 'MacIntel' && navigatorRef.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(userAgent) && !/(Chrome|CriOS|Edg|FxiOS|OPR)/i.test(userAgent);
    this.platform.set(
      isIOS && isSafari
        ? 'ios-safari'
        : /Android/i.test(userAgent)
          ? 'android'
          : /Macintosh/i.test(userAgent) && isSafari
            ? 'mac-safari'
            : 'unsupported',
    );
    this.installed.set(
      navigatorRef.standalone === true ||
        Boolean(windowRef.matchMedia?.('(display-mode: standalone)')?.matches),
    );
    try {
      const expires = Number(windowRef.localStorage.getItem(DISMISSAL_KEY));
      if (expires > Date.now()) this.dismissed.set(true);
      else windowRef.localStorage.removeItem(DISMISSAL_KEY);
    } catch {
      // A session-only dismissal remains effective when storage is unavailable.
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      this.deferred = event as InstallPromptEvent;
      this.canInstall.set(true);
    };
    const onInstalled = () => {
      this.installed.set(true);
      this.canInstall.set(false);
      this.deferred = undefined;
      this.dismissed.set(true);
    };
    windowRef.addEventListener('beforeinstallprompt', onBeforeInstall);
    windowRef.addEventListener('appinstalled', onInstalled);
    this.destroyRef.onDestroy(() => {
      windowRef.removeEventListener('beforeinstallprompt', onBeforeInstall);
      windowRef.removeEventListener('appinstalled', onInstalled);
    });
  }

  async install() {
    const prompt = this.deferred;
    if (!prompt) {
      this.openHelp();
      return;
    }
    this.deferred = undefined;
    this.canInstall.set(false);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.installed.set(true);
        this.dismissed.set(true);
      } else {
        this.dismiss();
      }
    } catch {
      this.openHelp();
    }
  }

  dismiss() {
    this.dismissed.set(true);
    try {
      this.document.defaultView?.localStorage.setItem(
        DISMISSAL_KEY,
        String(Date.now() + COOLDOWN_MS),
      );
    } catch {
      // This only affects whether a non-essential prompt returns this session.
    }
  }

  openHelp() {
    this.helpOpen.set(true);
  }
}
