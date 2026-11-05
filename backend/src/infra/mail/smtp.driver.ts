import { createTransport, Transporter } from 'nodemailer';
import { MailDriver, MailMessage } from './mail.driver';

export class SmtpMailDriver implements MailDriver {
  private readonly transport: Transporter;

  constructor(
    private readonly from: string,
    config: {
      host: string;
      port: number;
      secure: boolean;
      user: string | undefined;
      pass: string | undefined;
    },
  ) {
    this.transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
