import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { FormField } from './field';

@Component({
  selector: 'lq-habit-schedule',
  imports: [ReactiveFormsModule, FormField, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lq-field [id]="prefix() + '-frequency'" [label]="'forms.habitSchedule.rhythm' | translate">
      <select [id]="prefix() + '-frequency'" class="field" [formControl]="frequency()">
        <option value="DAILY">{{ 'forms.habitSchedule.everyDay' | translate }}</option>
        <option value="WEEKLY">{{ 'forms.habitSchedule.fewTimesAWeek' | translate }}</option>
        <option value="CUSTOM">{{ 'forms.habitSchedule.selectedDays' | translate }}</option>
      </select>
    </lq-field>
    @if (frequency().value === 'CUSTOM') {
      <fieldset class="mb-5">
        <legend class="field-label">{{ 'forms.habitSchedule.chooseDays' | translate }}</legend>
        <div class="flex flex-wrap gap-2">
          @for (day of weekdays; track $index) {
            <button
              type="button"
              class="btn text-xs"
              [class]="scheduleDays().value.includes($index) ? 'btn-primary' : 'btn-secondary'"
              [attr.aria-pressed]="scheduleDays().value.includes($index)"
              (click)="toggleDay($index)"
            >
              {{ day.key | translate }}
            </button>
          }
        </div>
        @if (!scheduleDays().value.length) {
          <p role="status" class="mt-2 text-xs text-muted">
            {{
              'forms.habitSchedule.chooseOneDay' | translate
            }}
          </p>
        }
      </fieldset>
    }
    @if (frequency().value === 'WEEKLY') {
      <lq-field [id]="prefix() + '-weekly'" [label]="'forms.habitSchedule.daysPerWeek' | translate">
        <input
          [id]="prefix() + '-weekly'"
          class="field"
          type="number"
          min="1"
          max="7"
          [formControl]="weeklyTarget()"
        />
      </lq-field>
    }
  `,
})
export class HabitScheduleFields {
  readonly prefix = input.required<string>();
  readonly frequency = input.required<FormControl<string>>();
  readonly scheduleDays = input.required<FormControl<number[]>>();
  readonly weeklyTarget = input.required<FormControl<number>>();
  readonly weekdays = [
    { key: 'common.days.sunShort' },
    { key: 'common.days.monShort' },
    { key: 'common.days.tueShort' },
    { key: 'common.days.wedShort' },
    { key: 'common.days.thuShort' },
    { key: 'common.days.friShort' },
    { key: 'common.days.satShort' },
  ];
  toggleDay(day: number) {
    const control = this.scheduleDays();
    control.setValue(
      control.value.includes(day)
        ? control.value.filter((value) => value !== day)
        : [...control.value, day].sort(),
    );
    control.markAsDirty();
  }
}
