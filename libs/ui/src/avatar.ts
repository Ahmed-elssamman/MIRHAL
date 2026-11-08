import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
@Component({
  selector: 'mirhal-avatar, lq-avatar',
  host: { class: 'inline-flex shrink-0' },
  template: `<span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand"
    [style.width.px]="size()"
    [style.height.px]="size()"
    [style.font-size.px]="size() / 2.5"
  >
    @if (safeSource(); as image) {
      <img [src]="image" alt="" [width]="size()" [height]="size()" />
    } @else {
      <span aria-hidden="true">{{ name().charAt(0).toUpperCase() }}</span>
    }
  </span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly src = input<string | null | undefined>(null);
  readonly name = input('');
  readonly size = input(40);
  readonly safeSource = computed(() =>
    /^\/avatars\/(dawn|grove|tide|bloom|summit|moon)\.svg$/.test(this.src() ?? '')
      ? this.src()
      : null,
  );
}
