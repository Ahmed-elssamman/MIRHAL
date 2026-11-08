import { HttpContextToken } from '@angular/common/http';

export type LoadingScope = 'global' | 'local' | 'silent';

/**
 * Requests trigger the centralized global loading system by default.
 * Individual callers can opt out by passing 'local' or 'silent'.
 */
export const API_LOADING_SCOPE = new HttpContextToken<LoadingScope>(() => 'global');

/** Opt in to a shared error toast when the calling feature has no local error UI. */
export const API_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
