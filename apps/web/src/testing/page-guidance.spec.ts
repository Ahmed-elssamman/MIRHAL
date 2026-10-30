import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { PageHeader } from '@lifequest/ui';
import { Preferences } from '@lifequest/utilities';
import { beforeEach, describe, expect, it } from 'vitest';

@Component({
  imports: [PageHeader],
  template: `
    <lq-page-header
      [eyebrow]="i18n.t('TEST EYEBROW', 'شعار تجريبي')"
      [title]="i18n.t('Test Page Title', 'عنوان صفحة تجريبي')"
      [description]="i18n.t('A thoughtful sentence explaining this space.', 'جملة توضح الهدف من هذه المساحة.')"
    >
      <button type="button" class="action-btn">Action</button>
    </lq-page-header>
  `,
})
class TestHostComponent {
  constructor(readonly i18n: Preferences) {}
}

describe('Contextual Page Guidance (PageHeader)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });
  });

  it('renders title, description, and eyebrow properly in English', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    const prefs = TestBed.inject(Preferences);
    prefs.setLanguage('en');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const title = el.querySelector('.page-title');
    const eyebrow = el.querySelector('.eyebrow');
    const description = el.querySelector('p.text-muted');
    const actionBtn = el.querySelector('.action-btn');

    expect(title?.textContent?.trim()).toBe('Test Page Title');
    expect(eyebrow?.textContent?.trim()).toBe('TEST EYEBROW');
    expect(description?.textContent?.trim()).toBe('A thoughtful sentence explaining this space.');
    expect(actionBtn).toBeTruthy();
  });

  it('renders title, description, and eyebrow properly in Arabic RTL', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    const prefs = TestBed.inject(Preferences);
    prefs.setLanguage('ar');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const title = el.querySelector('.page-title');
    const eyebrow = el.querySelector('.eyebrow');
    const description = el.querySelector('p.text-muted');

    expect(title?.textContent?.trim()).toBe('عنوان صفحة تجريبي');
    expect(eyebrow?.textContent?.trim()).toBe('شعار تجريبي');
    expect(description?.textContent?.trim()).toBe('جملة توضح الهدف من هذه المساحة.');
    expect(prefs.rtl()).toBe(true);
  });

  it('omits eyebrow and description DOM elements when not provided', () => {
    @Component({
      imports: [PageHeader],
      template: `<lq-page-header title="Minimal Title" />`,
    })
    class MinimalHost {}

    const fixture = TestBed.createComponent(MinimalHost);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Minimal Title');
    expect(el.querySelector('.eyebrow')).toBeNull();
    expect(el.querySelector('p.text-muted')).toBeNull();
  });
});

