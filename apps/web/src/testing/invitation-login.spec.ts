import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '@lifequest/auth-page';
import { AuthStore } from '@lifequest/auth';
import { Api, Toasts } from '@lifequest/data-access';
import { Preferences } from '@lifequest/utilities';

describe('invitation sign-in', () => {
  const post = vi.fn();
  const login = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const navigate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    login.mockResolvedValue({ role: 'USER', profile: { onboardingCompletedAt: 'done' } });
    navigate.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ mode: 'login' })),
            snapshot: {
              paramMap: convertToParamMap({ mode: 'login' }),
              queryParamMap: convertToParamMap({ inviteToken: 'invitation-token' }),
              data: {},
            },
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: AuthStore, useValue: { login } },
        {
          provide: Api,
          useValue: {
            resource: () => ({ data: () => null }),
            get: vi.fn().mockResolvedValue({ valid: true }),
            post,
          },
        },
        { provide: Preferences, useValue: { t: (english: string) => english } },
        { provide: Toasts, useValue: { success, error } },
      ],
    });
  });
  it('redeems the invitation after login and explains verification is required', async () => {
    post.mockResolvedValue({ status: 'awaiting_verification' });
    const page = TestBed.runInInjectionContext(() => new AuthPage());
    page.form.patchValue({ email: 'user@example.test', password: 'long-password-test' });
    await page.submit();
    expect(post).toHaveBeenCalledWith('friends/invitations/accept', { token: 'invitation-token' });
    expect(success).toHaveBeenCalledWith('Verify your email to receive the friend request.');
    expect(navigate).toHaveBeenCalledWith(['/today']);
  });
  it('reports redemption failure while preserving successful sign-in', async () => {
    const failure = new Error('Invitation expired');
    post.mockRejectedValue(failure);
    const page = TestBed.runInInjectionContext(() => new AuthPage());
    page.form.patchValue({ email: 'user@example.test', password: 'long-password-test' });
    await page.submit();
    expect(error).toHaveBeenCalledWith(failure);
    expect(navigate).toHaveBeenCalledWith(['/today']);
  });
});
