import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Api, Milestone, Toasts } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';
import { Icon } from '@lifequest/ui';
@Component({
  selector: 'lq-milestones',
  imports: [
    TranslatePipe,FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="space-y-2 py-3">
    @for (item of items(); track item.id) {
      <label class="flex min-h-11 items-center gap-3 text-xs"
        ><input
          type="checkbox"
          class="size-4 accent-brand"
          [checked]="item.completed"
          [disabled]="busy()"
          (change)="toggle(item)"
        /><span [class.line-through]="item.completed">{{ item.title }}</span></label
      >
    } @empty {
      <p class="text-xs leading-6 text-muted">
        {{
          ('web.features.goals.copy.break_this_outcome_into_a_few_meaningful_checkpoints_5f0b719e' | translate)
        }}
      </p>
    }
    <form class="flex gap-2" (ngSubmit)="add()">
      <input
        class="field min-w-0"
        [ngModel]="title()"
        (ngModelChange)="title.set($event)"
        name="milestoneTitle"
        [attr.aria-label]="('web.features.goals.copy.new_milestone_3ea7d7b3' | translate)"
        [placeholder]="('web.features.goals.copy.the_next_milestone_401b8723' | translate)"
        maxlength="160"
      /><button
        type="submit"
        class="icon-button bg-brand text-white"
        [attr.aria-label]="('web.features.goals.copy.add_milestone_36a90766' | translate)"
        [disabled]="busy() || title().trim().length < 2"
      >
        <lq-icon name="plus" />
      </button>
    </form>
  </div>`,
})
export class Milestones {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly i18n = inject(Preferences);
  readonly goalId = input<string>();
  readonly projectId = input<string>();
  readonly items = input.required<Milestone[]>();
  readonly changed = output<void>();
  readonly title = signal('');
  readonly busy = signal(false);
  async add() {
    if (this.busy() || this.title().trim().length < 2) return;
    this.busy.set(true);
    try {
      await this.api.post('milestones', {
        goalId: this.goalId(),
        projectId: this.projectId(),
        title: this.title().trim(),
      });
      this.title.set('');
      this.changed.emit();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(false);
    }
  }
  async toggle(item: Milestone) {
    this.busy.set(true);
    try {
      await this.api.patch(`milestones/${item.id}`, { completed: !item.completed });
      this.changed.emit();
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
