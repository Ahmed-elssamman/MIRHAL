import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
@Component({
  selector: 'mirhal-overlays, lq-overlays',
  imports: [ToastModule, ConfirmDialogModule],
  template: `<p-toast
      position="bottom-right"
      [style]="{ maxWidth: 'calc(100vw - 2rem)' }"
    /><p-confirmdialog [style]="{ width: '28rem' }" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overlays {}
