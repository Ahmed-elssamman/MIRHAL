import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  DestroyRef,
  ElementRef,
  Renderer2,
  inject,
  input,
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Preferences } from '@mirhal/utilities';
@Component({
  selector: 'mirhal-field, lq-field',
  host: { '[attr.id]': 'null' },
  template:
    '<div class="mb-4"><label [for]="id()" class="field-label">{{ label() }} @if(required()) { <span class="text-brand" aria-hidden="true">*</span> }</label><ng-content />@if (message()) { <p [id]="id()+\'-error\'" class="mt-1.5 text-xs text-rose-600 dark:text-rose-300" role="alert">{{ message() }}</p> } @else if (hint()) { <p [id]="id()+\'-hint\'" class="mt-1.5 text-xs leading-relaxed text-muted">{{ hint() }}</p> }</div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormField implements AfterContentInit {
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly error = input('');
  readonly hint = input('');
  private readonly i18n = inject(Preferences);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  @ContentChild(NgControl) control?: NgControl;
  ngAfterContentInit() {
    this.control?.control?.events.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.describe();
      this.cdr.markForCheck();
    });
    this.describe();
  }
  message(): string {
    if (this.error()) return this.error();
    const control = this.control?.control;
    if (!control?.touched || !control.errors) return '';
    const errors = control.errors;
    if (typeof errors['server'] === 'string')
      return this.i18n.t(errors['server'], 'تحقق من قيمة هذا الحقل وحدوده المطلوبة.');
    if (errors['required']) return this.i18n.t('Please fill in this field.', 'أكمل هذا الحقل.');
    if (errors['email'])
      return this.i18n.t('Enter a valid email address.', 'أدخل بريداً إلكترونياً صالحاً.');
    if (errors['minlength'])
      return this.i18n.t('Add a little more detail.', 'أضف المزيد من التفاصيل.');
    if (errors['min'])
      return this.i18n.t('Choose a value above the minimum.', 'اختر قيمة أعلى من الحد الأدنى.');
    return this.i18n.t('Please check this value.', 'تحقق من هذه القيمة.');
  }
  private describe() {
    const input = this.host.nativeElement.querySelector('input,select,textarea');
    if (!input) return;
    const error = this.message();
    this.renderer.setAttribute(input, 'aria-invalid', error ? 'true' : 'false');
    const description = error ? this.id() + '-error' : this.hint() ? this.id() + '-hint' : '';
    if (description) this.renderer.setAttribute(input, 'aria-describedby', description);
    else this.renderer.removeAttribute(input, 'aria-describedby');
  }
}
