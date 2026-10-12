import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_SERVICE_TOKEN,
  PATTERNS,
  callService,
  type OrderCreatedEvent,
  type OrderDriverAssignedEvent,
  type OrderStatusChangedEvent,
} from '@app/common';
import { EmailService } from './email/email.service.js';
import {
  buildCustomerInvoiceHtml,
  buildDriverJobSlipHtml,
} from './email/templates/order-completed.template.js';

export interface NotificationLog {
  event: string;
  orderId: string;
  recipient: string;
  message: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger(NotificationServiceService.name);

  constructor(
    @Optional()
    @Inject(AUTH_SERVICE_TOKEN)
    private readonly authClient?: ClientProxy,
    @Optional()
    private readonly emailService?: EmailService,
  ) {}

  buildCreatedMessages(data: OrderCreatedEvent): NotificationLog[] {
    return [
      {
        event: 'order.created',
        orderId: data.orderId,
        recipient: data.customerId,
        message: `Order ${data.orderId} berhasil dibuat.`,
      },
    ];
  }

  buildDriverAssignedMessages(data: OrderDriverAssignedEvent): NotificationLog[] {
    return [
      {
        event: 'order.driver_assigned',
        orderId: data.orderId,
        recipient: data.customerId,
        message: `Driver ditemukan untuk order ${data.orderId}.`,
      },
      {
        event: 'order.driver_assigned',
        orderId: data.orderId,
        recipient: data.driverId,
        message: `Kamu mendapat order ${data.orderId}.`,
      },
    ];
  }

  buildStatusChangedMessages(data: OrderStatusChangedEvent): NotificationLog[] {
    return [
      {
        event: 'order.status_changed',
        orderId: data.orderId,
        recipient: data.customerId,
        message: `Status order ${data.orderId} berubah menjadi ${data.status}.`,
      },
    ];
  }

  async sendCompletionEmails(data: OrderStatusChangedEvent): Promise<void> {
    if (!this.authClient || !this.emailService) {
      this.logger.debug(
        'Auth client atau EmailService tidak tersedia, lewati pengiriman email selesai.',
      );
      return;
    }

    let customer: UserProfile | null = null;
    let driver: UserProfile | null = null;

    try {
      customer = await firstValueFrom(
        callService<UserProfile>(
          this.authClient.send(PATTERNS.AUTH.ME, { userId: data.customerId }),
          'auth-service',
          3000,
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Gagal mengambil data profil customer ${data.customerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (data.driverId) {
      try {
        driver = await firstValueFrom(
          callService<UserProfile>(
            this.authClient.send(PATTERNS.AUTH.ME, { userId: data.driverId }),
            'auth-service',
            3000,
          ),
        );
      } catch (error) {
        this.logger.warn(
          `Gagal mengambil data profil driver ${data.driverId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const completedAt = new Date();

    // 1. Kirim Email Invoice ke Customer
    if (customer?.email) {
      const customerHtml = buildCustomerInvoiceHtml({
        customerName: customer.name,
        orderId: data.orderId,
        driverName: driver?.name ?? 'Mitra Pengemudi',
        fee: data.fee,
        distanceM: data.distanceM,
        completedAt,
      });

      await this.emailService.sendMail({
        to: customer.email,
        subject: `[UrbanLogis] Bukti Transaksi Pesanan #${data.orderId.slice(0, 8)} Selesai`,
        html: customerHtml,
      });
    }

    // 2. Kirim Email Job Slip ke Driver
    if (driver?.email) {
      const driverHtml = buildDriverJobSlipHtml({
        driverName: driver.name,
        orderId: data.orderId,
        customerName: customer?.name ?? 'Pelanggan',
        fee: data.fee,
        distanceM: data.distanceM,
        completedAt,
      });

      await this.emailService.sendMail({
        to: driver.email,
        subject: `[UrbanLogis Mitra] Tugas Selesai! Penghasilan Ditambahkan #${data.orderId.slice(0, 8)}`,
        html: driverHtml,
      });
    }
  }
}
