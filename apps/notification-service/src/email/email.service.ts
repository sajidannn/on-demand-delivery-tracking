import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private isEthereal = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initTransporter();
  }

  private async initTransporter(): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.isEthereal = false;
      this.logger.log(`SMTP Email Transporter dikonfigurasi ke host: ${host}`);
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.isEthereal = true;
        this.logger.log(
          `Ethereal Email Sandbox aktif (Local testing mode). Akun: ${testAccount.user}`,
        );
      } catch (error) {
        this.logger.error('Gagal membuat Ethereal test account:', error);
      }
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      await this.initTransporter();
    }

    if (!this.transporter) {
      this.logger.warn(`Transporter belum siap, batal kirim email ke ${options.to}`);
      return;
    }

    try {
      const from = this.configService.get<string>(
        'EMAIL_FROM',
        '"UrbanLogis" <noreply@urbanlogis.com>',
      );

      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      this.logger.log(`✉️ Email terkirim ke: ${options.to} | Subject: "${options.subject}"`);

      if (this.isEthereal) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.log(`🔗 [Preview Ethereal Email]: ${previewUrl}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Gagal mengirim email ke ${options.to}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
