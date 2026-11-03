import { HttpContextToken } from '@angular/common/http';

export type LoadingScope = 'global' | 'local' | 'silent';

/** Requests are silent unless the caller explicitly opts into global feedback. */
export const API_LOADING_SCOPE = new HttpContextToken<LoadingScope>(() => 'silent');

/** Opt in to a shared error toast when the calling feature has no local error UI. */
export const API_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
