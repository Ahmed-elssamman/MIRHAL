import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class PwaUpdates {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly updates = inject(SwUpdate, { optional: true });
  readonly ready = signal(false);
  readonly unrecoverable = signal(false);

  constructor() {
    const destroy = inject(DestroyRef);
    if (!this.browser || !this.updates?.isEnabled) return;
    this.updates.versionUpdates.pipe(takeUntilDestroyed(destroy)).subscribe((event) => {
      if (event.type === 'VERSION_READY') this.ready.set(true);
    });
    this.updates.unrecoverable.pipe(takeUntilDestroyed(destroy)).subscribe(() => {
      this.unrecoverable.set(true);
    });
  }

  reload() {
    this.document.defaultView?.location.reload();
  }
}
