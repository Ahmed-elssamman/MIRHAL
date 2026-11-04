import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../app/features/settings/settings';
import { Api } from '@lifequest/data-access';
import { AuthStore } from '@lifequest/auth';
import { Preferences } from '@lifequest/utilities';

describe('navigation preference settings', () => {
  const profile = { theme: 'system', language: 'en', showAdditionalNavigation: false };
  const user = { profile };
  const patch = vi.fn();
  const setUser = vi.fn();
  const setShowAdditionalNavigation = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      FormBuilder,
      { provide: Api, useValue: { patch, errorMessage: () => 'The request could not be completed.' } },
      { provide: AuthStore, useValue: { user: () => user, setUser } },
      { provide: Preferences, useValue: { showAdditionalNavigation: () => false, setShowAdditionalNavigation } },
    ] });
  });
  it('saves the preference with the existing profile settings', async () => {
    patch.mockResolvedValue({ ...profile, showAdditionalNavigation: true });
    const page = TestBed.runInInjectionContext(() => new SettingsPage());
    page.form.controls.showAdditionalNavigation.setValue(true);
    await page.save();
    expect(patch).toHaveBeenCalledWith('profile', expect.objectContaining({ showAdditionalNavigation: true }));
    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ profile: expect.objectContaining({ showAdditionalNavigation: true }) }));
    expect(page.saved()).toBe(true);
  });
  it('restores the last saved sidebar state when profile persistence fails', async () => {
    patch.mockRejectedValue(new Error('unavailable'));
    const page = TestBed.runInInjectionContext(() => new SettingsPage());
    page.form.controls.showAdditionalNavigation.setValue(true);
    await page.save();
    expect(setShowAdditionalNavigation).toHaveBeenCalledWith(false);
    expect(page.form.controls.showAdditionalNavigation.value).toBe(false);
    expect(page.saved()).toBe(false);
  });
});
