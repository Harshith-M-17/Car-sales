import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../../config/app-config';
import { InjectConfig } from '../../config/config.module';
import { MAIL_DRIVER, MailDriver } from '../../infra/mail/mail.driver';
import { PasswordReset } from './schemas/password-reset.schema';
import { hashToken } from './token.service';

const LINK_TTL_MS = 3_600_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_SENDS = 5;

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(PasswordReset.name) private readonly resets: Model<PasswordReset>,
    @Inject(MAIL_DRIVER) private readonly mail: MailDriver,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** Emails a new link, replacing any earlier one. Does nothing when rate limits block sending. */
  async sendLink(user: Types.ObjectId, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    if (!(await this.reserve(user, token))) return;

    // In the URL fragment, which browsers never send to servers, so it stays out of access logs.
    const link = `${this.config.webAppUrl}/reset-password#token=${token}`;
    const { appName } = this.config.mail;
    await this.mail.send({
      to: email,
      subject: `Reset your ${appName} password`,
      text: `Open this link to choose a new password: ${link} It expires in 1 hour. If you didn't ask for this, ignore this email and your password stays the same.`,
      html: `<p>We received a request to reset your ${appName} password.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 1 hour. If you didn't ask for this, ignore this email and your password stays the same.</p>`,
    });
  }

  /** Returns the user the token belongs to and uses it up, so a link works exactly once. */
  async consume(token: string): Promise<Types.ObjectId | null> {
    const reset = await this.resets
      .findOneAndDelete(
        { tokenHash: hashToken(token), expiresAt: { $gt: new Date() } },
        { projection: { user: 1 } },
      )
      .lean<Pick<PasswordReset, 'user'>>()
      .exec();
    return reset?.user ?? null;
  }

  /** Kills any outstanding link, e.g. when the password was changed another way. */
  async cancel(user: Types.ObjectId): Promise<void> {
    await this.resets.deleteOne({ user }).exec();
  }

  /** Stores the token if the cooldown and send limit allow it. Safe under concurrent requests. */
  private async reserve(user: Types.ObjectId, token: string): Promise<boolean> {
    const now = Date.now();
    try {
      // No row yet: this inserts. A row blocked by a limit doesn't match, so it fails the unique index.
      await this.resets
        .updateOne(
          {
            user,
            sentAt: { $lte: new Date(now - RESEND_COOLDOWN_MS) },
            sendCount: { $lt: MAX_SENDS },
          },
          {
            $set: {
              tokenHash: hashToken(token),
              expiresAt: new Date(now + LINK_TTL_MS),
              sentAt: new Date(now),
            },
            $inc: { sendCount: 1 },
          },
          { upsert: true },
        )
        .exec();
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return false;
      throw err;
    }
  }
}
