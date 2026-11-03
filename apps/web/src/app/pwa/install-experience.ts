import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { Preferences } from '@lifequest/utilities';
import { Icon } from '@lifequest/ui';
import { PwaInstallation } from './install';

@Component({
  selector: 'lq-install-experience',
  imports: [DialogModule, Icon],
  template: `
    @if (install.canOffer()) {
      <aside
        class="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 sm:p-5"
        aria-label="{{ i18n.t('Install MIRHAL', 'تثبيت مِرحال') }}"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand"
        >
          <lq-icon name="download" [size]="19" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-semibold">
            {{ i18n.t('MIRHAL, close at hand.', 'مِرحال أقرب إليك.') }}
          </h2>
          <p class="mt-1 text-xs leading-5 text-muted">
            {{
              i18n.t(
                'Add a home-screen shortcut for quick access. Your account still needs an internet connection.',
                'أضف اختصاراً إلى الشاشة الرئيسية للوصول بسهولة. يظل حسابك بحاجة إلى اتصال بالإنترنت.'
              )
            }}
          </p>
        </div>
        <button type="button" class="btn btn-secondary min-h-11" (click)="openInstall()">
          {{ i18n.t('Install or get help', 'تثبيت أو معرفة الطريقة') }}
        </button>
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="i18n.t('Maybe later', 'ربما لاحقاً')"
          (click)="install.dismiss()"
        >
          <lq-icon name="x" [size]="17" />
        </button>
      </aside>
    }

    <p-dialog
      [visible]="offerDialog() || install.helpOpen()"
      (visibleChange)="dialogVisibilityChanged($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closeOnEscape]="true"
      [style]="{ width: 'min(29rem, calc(100vw - 2rem))' }"
      [header]="i18n.t('Make MIRHAL easy to reach.', 'اجعل مِرحال أقرب إليك.')"
      [appendTo]="'body'"
    >
      <div class="flex items-start gap-4">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
        >
          <lq-icon name="download" [size]="22" />
        </span>
        <div>
          <p class="text-sm font-medium">
            {{
              i18n.t(
                'Open MIRHAL from your home screen in its own window.',
                'افتح مِرحال من شاشتك الرئيسية في نافذة مستقلة.'
              )
            }}
          </p>
          @if (install.platform() === 'ios-safari') {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                i18n.t(
                  'In Safari, tap Share, then Add to Home Screen.',
                  'في Safari، اضغط مشاركة، ثم إضافة إلى الشاشة الرئيسية.'
                )
              }}
            </p>
          } @else if (install.platform() === 'android') {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                i18n.t(
                  'Open your browser menu and choose Install app or Add to Home screen. The wording can vary by browser.',
                  'افتح قائمة المتصفح واختر تثبيت التطبيق أو الإضافة إلى الشاشة الرئيسية. قد تختلف التسمية حسب المتصفح.'
                )
              }}
            </p>
          } @else if (install.platform() === 'mac-safari') {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                i18n.t(
                  'In Safari, choose File, then Add to Dock.',
                  'في Safari، اختر ملف، ثم إضافة إلى Dock.'
                )
              }}
            </p>
          } @else if (install.canInstall()) {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                i18n.t(
                  'Your browser can install MIRHAL. Continue when you are ready.',
                  'يمكن لمتصفحك تثبيت مِرحال. تابع حين تكون مستعداً.'
                )
              }}
            </p>
          }
          <p class="mt-3 text-xs leading-5 text-muted">
            {{
              i18n.t(
                'Your goals, habits, and tasks still need an internet connection.',
                'تظل أهدافك وعاداتك ومهامك بحاجة إلى اتصال بالإنترنت.'
              )
            }}
          </p>
        </div>
      </div>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-quiet" (click)="dismiss()">
          {{ i18n.t('Maybe later', 'ربما لاحقاً') }}
        </button>
        @if (install.canInstall()) {
          <button type="button" class="btn btn-primary" (click)="installNow()">
            {{ i18n.t('Install MIRHAL', 'ثبّت مِرحال') }}
          </button>
        }
      </div>
    </p-dialog>
  `,
})
export class InstallExperience {
  readonly install = inject(PwaInstallation);
  readonly i18n = inject(Preferences);
  readonly offerDialog = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (!this.browser) return;
    const windowRef = this.document.defaultView;
    if (!windowRef) return;
    const timer = windowRef.setTimeout(() => {
      const dialogOpen = this.document.querySelector('.p-dialog[role="dialog"]');
      const focusedControl = this.document.activeElement?.matches(
        'input, textarea, select, [contenteditable="true"]',
      );
      if (this.install.canOffer() && !dialogOpen && !focusedControl) this.offerDialog.set(true);
    }, 12_000);
    this.destroyRef.onDestroy(() => windowRef.clearTimeout(timer));
  }

  openInstall() {
    if (this.install.canInstall()) void this.installNow();
    else this.install.openHelp();
  }

  async installNow() {
    this.offerDialog.set(false);
    await this.install.install();
  }

  dismiss() {
    this.offerDialog.set(false);
    this.install.helpOpen.set(false);
    this.install.dismiss();
  }

  dialogVisibilityChanged(visible: boolean) {
    if (!visible) {
      this.offerDialog.set(false);
      this.install.helpOpen.set(false);
    }
  }
}
