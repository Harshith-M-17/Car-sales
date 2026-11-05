export const MAIL_DRIVER = Symbol('MAIL_DRIVER');

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailDriver {
  /** Rejects if the mail server refuses the message. */
  send(message: MailMessage): Promise<void>;
}
