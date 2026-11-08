import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallation } from '../app/pwa/install';
import { PwaUpdates } from '../app/pwa/updates';

describe('PWA lifecycle', () => {
  beforeEach(() => {
    localStorage.removeItem('mirhal-install-dismissed-v1');
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('waits for the browser installation event before reporting installed', async () => {
    const install = TestBed.inject(PwaInstallation);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
    expect(install.canInstall()).toBe(true);
    await install.install();
    expect(install.installed()).toBe(false);
    window.dispatchEvent(new Event('appinstalled'));
    expect(install.installed()).toBe(true);
  });

  it('stores a dismissal cooldown after a dismissed prompt', async () => {
    const install = TestBed.inject(PwaInstallation);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
    await install.install();
    expect(install.dismissed()).toBe(true);
    expect(Number(localStorage.getItem('mirhal-install-dismissed-v1'))).toBeGreaterThan(Date.now());
  });

  it('notifies when an update is ready or a reload is required', () => {
    const versionUpdates = new Subject<{ type: string }>();
    const unrecoverable = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: { isEnabled: true, versionUpdates, unrecoverable } },
      ],
    });
    const updates = TestBed.inject(PwaUpdates);
    versionUpdates.next({ type: 'VERSION_DETECTED' });
    expect(updates.ready()).toBe(false);
    versionUpdates.next({ type: 'VERSION_READY' });
    expect(updates.ready()).toBe(true);
    unrecoverable.next();
    expect(updates.unrecoverable()).toBe(true);
  });
});
