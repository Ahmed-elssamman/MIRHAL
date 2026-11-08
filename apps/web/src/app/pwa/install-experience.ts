import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { Preferences } from '@mirhal/utilities';
import { Icon } from '@mirhal/ui';
import { PwaInstallation } from './install';

@Component({
  selector: 'lq-install-experience',
  imports: [TranslatePipe, DialogModule, Icon],
  template: `
    @if (install.canOffer()) {
      <aside
        class="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 sm:p-5"
        aria-label="{{ 'common.copy.install_mirhal_8a3f95dd' | translate }}"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand"
        >
          <lq-icon name="download" [size]="19" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-semibold">
            {{ 'web.app.copy.mirhal_close_at_hand_5f53cbfc' | translate }}
          </h2>
          <p class="mt-1 text-xs leading-5 text-muted">
            {{
              'web.app.copy.add_a_home_screen_shortcut_for_quick_access_your_account_still_needs_an_internet_connection_1d9ed936'
                | translate
            }}
          </p>
        </div>
        <button type="button" class="btn btn-secondary min-h-11" (click)="openInstall()">
          {{ 'web.app.copy.install_or_get_help_dd7abda0' | translate }}
        </button>
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="'web.app.copy.maybe_later_7bfa4a05' | translate"
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
      [header]="'web.app.copy.make_mirhal_easy_to_reach_d53f61be' | translate"
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
              'web.app.copy.open_mirhal_from_your_home_screen_in_its_own_window_2c9b5edb'
                | translate
            }}
          </p>
          @if (install.platform() === 'ios-safari') {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{ 'web.app.copy.in_safari_tap_share_then_add_to_home_screen_8fb7218a' | translate }}
            </p>
          } @else if (install.platform() === 'android') {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                'web.app.copy.open_your_browser_menu_and_choose_install_app_or_add_to_home_screen_the_wording_can_vary_by_browser_0066fed5'
                  | translate
              }}
            </p>
          } @else if (install.platform() === 'mac-safari') {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{ 'web.app.copy.in_safari_choose_file_then_add_to_dock_df3dd673' | translate }}
            </p>
          } @else if (install.canInstall()) {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                'web.app.copy.your_browser_can_install_mirhal_continue_when_you_are_ready_7b7a584f'
                  | translate
              }}
            </p>
          } @else {
            <p class="mt-3 text-sm leading-6 text-muted">
              {{
                'web.app.copy.your_browser_does_not_provide_installation_instructions_here_you_can_still_use_mirhal_in_this_browser_1cdd3a74'
                  | translate
              }}
            </p>
          }
          <p class="mt-3 text-xs leading-5 text-muted">
            {{
              'web.app.copy.your_goals_habits_and_tasks_still_need_an_internet_connection_ea87caa8'
                | translate
            }}
          </p>
        </div>
      </div>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-quiet" (click)="dismiss()">
          {{ 'web.app.copy.maybe_later_7bfa4a05' | translate }}
        </button>
        @if (install.canInstall()) {
          <button type="button" class="btn btn-primary" (click)="installNow()">
            {{ 'common.copy.install_mirhal_8a3f95dd' | translate }}
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
      if (this.offerDialog()) this.install.dismiss();
      this.offerDialog.set(false);
      this.install.helpOpen.set(false);
    }
  }
}
