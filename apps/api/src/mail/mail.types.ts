export const MAIL_PROVIDER = 'MAIL_PROVIDER';

export interface MailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  key: string;
  purpose?: string;
  language?: string;
}

export interface MailResult {
  success: boolean;
  provider: string;
  messageId?: string;
}

export type DeliveryErrorClassification = 'temporary' | 'permanent' | 'misconfigured';

export class DeliveryError extends Error {
  constructor(
    readonly classification: DeliveryErrorClassification,
    message = 'Email delivery failed',
  ) {
    super(message);
    this.name = 'DeliveryError';
  }
}

export function classifyDeliveryError(error: unknown): DeliveryErrorClassification {
  if (error instanceof DeliveryError) return error.classification;
  if (typeof error === 'object' && error !== null) {
    if ('responseCode' in error && typeof error.responseCode === 'number') {
      return error.responseCode >= 500 ? 'permanent' : 'temporary';
    }
    if ('code' in error && error.code === 'EAUTH') return 'permanent';
    if ('status' in error && typeof error.status === 'number') {
      return error.status === 429 || error.status >= 500 ? 'temporary' : 'permanent';
    }
  }
  return 'temporary';
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<MailResult>;
}
