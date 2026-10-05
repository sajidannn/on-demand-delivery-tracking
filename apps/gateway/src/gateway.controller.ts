import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * Health-check minimal. Tidak didokumentasikan di Swagger (bukan bagian PRD §5).
 * Gunakan untuk cek apakah gateway HTTP server berjalan.
 */
@ApiExcludeController()
@Controller()
export class GatewayController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
