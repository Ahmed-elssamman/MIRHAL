import { Directive, HostListener, Injectable, WritableSignal, inject, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Preferences } from '@mirhal/utilities';
@Injectable({ providedIn: 'root' })
export class DiscardChanges {
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(Preferences);
  confirm() {
    return new Promise<boolean>((resolve) =>
      this.confirmation.confirm({
        header: this.i18n.t('Keep your changes?', 'هل تريد الاحتفاظ بالتغييرات؟'),
        message: this.i18n.t('Your changes have not been saved yet.', 'لم تُحفظ تغييراتك بعد.'),
        closeOnEscape: false,
        closable: false,
        dismissableMask: false,
        defaultFocus: 'reject',
        acceptLabel: this.i18n.t('Discard changes', 'تجاهل التغييرات'),
        rejectLabel: this.i18n.t('Keep editing', 'متابعة التعديل'),
        accept: () => resolve(true),
        reject: () => resolve(false),
      }),
    );
  }
  async close(visible: boolean, open: WritableSignal<boolean>, form: AbstractControl) {
    if (visible || !form.dirty) {
      open.set(visible);
      return;
    }
    open.set(false);
    if (!(await this.confirm())) open.set(true);
  }
}
export const unsavedChangesGuard: CanDeactivateFn<{
  form?: AbstractControl;
  open?: () => boolean;
}> = (component) =>
  !component.form?.dirty || component.open?.() === false || inject(DiscardChanges).confirm();
@Directive({ selector: '[lqUnsavedForm]' })
export class UnsavedForm {
  readonly lqUnsavedForm = input.required<AbstractControl>();
  readonly unsavedActive = input(true);
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.unsavedActive() && this.lqUnsavedForm().dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
