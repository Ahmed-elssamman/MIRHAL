import { Preferences } from '@lifequest/utilities';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
@Component({
  selector: 'lq-logo',
  template: `
    <span class="flex items-center gap-2.5">
      <img
        src="/mirhal-mark.svg"
        alt=""
        aria-hidden="true"
        [class]="compact() ? 'size-8 shrink-0' : 'size-9 shrink-0'"
        width="36"
        height="36"
      />
      @if (compact()) {
        <span class="sr-only">{{ i18n.t('MIRHAL', 'مِرحال') }}</span>
      } @else {
        <span class="text-[22px] font-bold tracking-[-0.8px]"
          >{{ i18n.t('MIRHAL', 'مِرحال') }}<span class="text-brand">.</span></span
        >
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  readonly i18n = inject(Preferences);
  readonly compact = input(false);
}
@Component({
  selector: 'lq-page-header',
  template:
    '<header class="mb-7 flex flex-wrap items-start justify-between gap-4"><div>@if (eyebrow()) {<p class="eyebrow mb-2">{{ eyebrow() }}</p>}<h1 class="page-title">{{ title() }}</h1>@if (description()) {<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{{ description() }}</p>}</div><div class="flex items-center gap-2"><ng-content /></div></header>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly eyebrow = input('');
}
@Component({
  selector: 'lq-empty',
  imports: [Icon],
  template:
    '<div class="card flex flex-col items-center px-6 py-14 text-center"><span class="mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand"><lq-icon [name]="icon()" [size]="28" /></span><h2 class="text-lg font-semibold">{{ title() }}</h2><p class="mt-2 max-w-sm text-sm leading-relaxed text-muted">{{ description() }}</p><div class="mt-5"><ng-content /></div></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input('sprout');
}
@Component({
  selector: 'lq-error',
  imports: [Icon],
  template:
    '<div role="alert" class="card flex flex-wrap items-center gap-4 border-rose-200 p-5"><lq-icon name="alert" /><div class="min-w-0 flex-1"><p class="font-semibold">{{ title() || i18n.t(\'A small detour\',\'عقبة صغيرة\') }}</p><p class="mt-1 text-sm text-muted">{{ message() }}</p></div><button type="button" class="btn btn-secondary" (click)="retry.emit()"><lq-icon name="refresh" [size]="16" />{{ retryLabel() || i18n.t(\'Try again\',\'حاول مجدداً\') }}</button></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorState {
  readonly i18n = inject(Preferences);
  readonly title = input('');
  readonly message = input.required<string>();
  readonly retryLabel = input('');
  readonly retry = output<void>();
}
@Component({
  selector: 'lq-skeleton',
  template:
    '<div aria-busy="true" [attr.aria-label]="i18n.t(\'Loading\',\'جارٍ التحميل\')" class="space-y-5"><div class="skeleton h-8 w-1/3"></div><div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">@for (item of [1,2,3]; track item) { <div class="card p-6"><div class="skeleton mb-5 size-11"></div><div class="skeleton mb-3 h-5 w-3/4"></div><div class="skeleton h-3 w-1/2"></div></div> }</div><div class="skeleton h-64 w-full"></div></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly i18n = inject(Preferences);
}
@Component({
  selector: 'lq-progress',
  template:
    '<div role="progressbar" [attr.aria-label]="label() || i18n.t(\'Progress\',\'التقدم\')" [attr.aria-valuenow]="rounded()" aria-valuemin="0" aria-valuemax="100" class="h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full origin-left rtl:origin-right rounded-full" [class]="color()" [style.transform]="\'scaleX(\' + rounded()/100 + \')\'" style="transition: transform 450ms ease"></div></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress {
  readonly i18n = inject(Preferences);
  readonly value = input(0);
  readonly label = input<string>();
  readonly color = input('bg-brand');
  rounded() {
    return Math.max(0, Math.min(100, Math.round(this.value())));
  }
}
@Component({
  selector: 'lq-ring',
  template:
    '<div class="relative inline-flex items-center justify-center" [style.width.px]="size()" [style.height.px]="size()"><svg class="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="6" class="text-line"/><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="270.18" [attr.stroke-dashoffset]="270.18 * (1 - value()/100)" class="text-brand"/></svg><div class="relative text-center"><ng-content /></div></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressRing {
  readonly value = input(0);
  readonly size = input(120);
}
@Component({
  selector: 'lq-stat',
  imports: [Icon],
  template:
    '<div class="card flex h-full items-center gap-4 p-5"><span class="flex size-11 shrink-0 items-center justify-center rounded-xl" [class]="tone()"><lq-icon [name]="icon()" /></span><div><p class="text-[11px] font-medium text-muted">{{ label() }}</p><p class="mt-1 text-2xl font-semibold tracking-tight">{{ value() }} <span class="text-xs font-normal text-muted">{{ suffix() }}</span></p></div><ng-content /></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly suffix = input('');
  readonly icon = input('zap');
  readonly tone = input('bg-brand-soft text-brand');
}
@Component({
  selector: 'lq-section-title',
  imports: [RouterLink, Icon],
  template:
    '<div class="mb-4 flex items-center justify-between gap-3"><h2 class="text-base font-semibold tracking-tight">{{ title() }}</h2>@if (link()) { <a [routerLink]="link()" class="inline-flex min-h-10 items-center gap-1 text-xs font-medium text-brand">{{ linkLabel() || i18n.t(\'View all\',\'عرض الكل\') }}<lq-icon name="arrow-right" [size]="14" /></a> }<ng-content /></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionTitle {
  readonly i18n = inject(Preferences);
  readonly title = input.required<string>();
  readonly link = input('');
  readonly linkLabel = input<string>();
}
