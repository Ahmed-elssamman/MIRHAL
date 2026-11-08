import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiscardChanges,
  UnsavedForm,
  unsavedChangesGuard,
  FormField,
  applyServerValidation,
} from '@mirhal/forms';
import { Preferences } from '@mirhal/utilities';

@Component({
  imports: [UnsavedForm, FormField, ReactiveFormsModule],
  template:
    '<form [formGroup]="form" [lqUnsavedForm]="form" [unsavedActive]="active()"><lq-field id="title" label="Title"><input id="title" formControlName="title"/></lq-field></form>',
})
class FormHost {
  readonly form = new FormGroup({ title: new FormControl('', Validators.required) });
  readonly active = signal(true);
}
describe('Unsaved work protection', () => {
  let confirmation: Confirmation;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ConfirmationService,
          useValue: { confirm: vi.fn((value: Confirmation) => (confirmation = value)) },
        },
        { provide: Preferences, useValue: { t: (english: string) => english } },
      ],
    });
  });
  it('associates validation with the projected input and clears it after a correction', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    form.controls.title.setValue('A title');
    applyServerValidation(
      form,
      new HttpErrorResponse({
        status: 400,
        error: {
          code: 'VALIDATION_ERROR',
          details: [
            { field: 'title', message: 'Choose a shorter title.' },
            { field: 'unknown', message: 'Ignore' },
          ],
        },
      }),
    );
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('title-error');
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Choose a shorter title.',
    );
    form.controls.title.setValue('Short title');
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
  });
  it('allows clean navigation and waits for an explicit dirty-form decision', async () => {
    const form = new FormGroup({ title: new FormControl('') });
    const guard = () =>
      TestBed.runInInjectionContext(() =>
        unsavedChangesGuard(
          { form },
          {} as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
          {} as RouterStateSnapshot,
        ),
      );
    expect(guard()).toBe(true);
    form.markAsDirty();
    let pending = guard();
    confirmation.reject?.();
    expect(await pending).toBe(false);
    pending = guard();
    confirmation.accept?.();
    expect(await pending).toBe(true);
  });
  it('restores the editor and values when dismissing is cancelled', async () => {
    const form = new FormGroup({ title: new FormControl('A meaningful draft') });
    form.markAsDirty();
    const open = signal(true);
    const pending = TestBed.inject(DiscardChanges).close(false, open, form);
    expect(open()).toBe(false);
    confirmation.reject?.();
    await pending;
    expect(open()).toBe(true);
    expect(form.value.title).toBe('A meaningful draft');
  });
  it('only prevents browser exit while an active form has unsaved changes', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const exit = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(exit()).toBe(false);
    fixture.componentInstance.form.markAsDirty();
    expect(exit()).toBe(true);
    fixture.componentInstance.active.set(false);
    await fixture.whenStable();
    expect(exit()).toBe(false);
  });
});
