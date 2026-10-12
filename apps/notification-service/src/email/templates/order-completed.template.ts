export interface CustomerInvoiceData {
  customerName: string;
  orderId: string;
  driverName: string;
  fee?: number;
  distanceM?: number;
  completedAt?: Date;
}

export interface DriverJobSlipData {
  driverName: string;
  orderId: string;
  customerName: string;
  fee?: number;
  distanceM?: number;
  completedAt?: Date;
}

/**
 * Format Rupiah sesuai standar DESIGN.md (Rp 15.000)
 */
function formatRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `Rp ${formatted}`;
}

/**
 * Format Jarak sesuai standar DESIGN.md (Indonesian comma: 2,5 km atau 800 m)
 */
function formatDistance(distanceM?: number): string {
  if (!distanceM) return '-';
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} m`;
  }
  const km = (distanceM / 1000).toFixed(1).replace('.', ',');
  return `${km} km`;
}

/**
 * Format Tanggal & Jam (contoh: 12 Okt 2026, 09:42 WIB)
 */
function formatDate(date: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB'
  );
}

export function buildCustomerInvoiceHtml(data: CustomerInvoiceData): string {
  const deliveryFee = data.fee ?? 15000;
  const serviceFee = 1000;
  const total = deliveryFee + serviceFee;
  const distanceFormatted = formatDistance(data.distanceM);
  const completedDate = formatDate(data.completedAt);

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <title>Bukti Transaksi UrbanLogis #${data.orderId.slice(0, 8)}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f8f9fb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03);">
    
    <!-- Brand Header -->
    <div style="padding: 32px 28px 24px 28px; text-align: center; border-bottom: 1px solid #f3f4f6;">
      <div style="display: inline-flex; align-items: center; justify-content: center; background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #052e16; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 16px;">
        <span style="display: inline-block; width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%; margin-right: 8px;"></span>
        Pesanan Selesai
      </div>
      <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.02em;">UrbanLogis</h1>
      <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 400;">Bukti Transaksi & Struk Pengantaran</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #374151; line-height: 1.6;">
        Halo <b>${data.customerName}</b>, pengantaran Anda telah tiba dengan selamat! Terima kasih telah menggunakan layanan UrbanLogis. Berikut rincian transaksi Anda:
      </p>

      <!-- Order Info Box (Surface Container Low) -->
      <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">ID Pesanan</td>
            <td style="color: #111827; font-weight: 700; text-align: right; font-family: monospace; font-size: 13px;">${data.orderId}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Waktu Selesai</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">${completedDate}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Mitra Driver</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">🛵 ${data.driverName}</td>
          </tr>
          ${
            data.distanceM
              ? `
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Jarak Pengantaran</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">${distanceFormatted}</td>
          </tr>`
              : ''
          }
        </table>
      </div>

      <!-- Payment Breakdown -->
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #111827; font-weight: 700; letter-spacing: -0.01em;">Rincian Pembayaran</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr style="border-bottom: 1px dashed #e5e7eb;">
          <td style="color: #4b5563; padding: 10px 0;">Biaya Pengantaran (Ongkir)</td>
          <td style="color: #111827; font-weight: 600; text-align: right;">${formatRupiah(deliveryFee)}</td>
        </tr>
        <tr style="border-bottom: 1px dashed #e5e7eb;">
          <td style="color: #4b5563; padding: 10px 0;">Biaya Layanan & Aplikasi</td>
          <td style="color: #111827; font-weight: 600; text-align: right;">${formatRupiah(serviceFee)}</td>
        </tr>
        <tr>
          <td style="color: #111827; font-size: 15px; font-weight: 800; padding: 14px 0 0 0;">Total Pembayaran</td>
          <td style="color: #052e16; font-size: 18px; font-weight: 800; text-align: right; padding: 14px 0 0 0;">
            <span style="background-color: #f0fdf4; color: #052e16; padding: 4px 10px; border-radius: 8px; border: 1px solid #bbf7d0;">${formatRupiah(total)}</span>
          </td>
        </tr>
      </table>

      <!-- Primary Action Button (Pill 9999px, #22C55E) -->
      <div style="text-align: center; margin: 32px 0 12px 0;">
        <a href="http://localhost:5173/orders/${data.orderId}" style="display: inline-block; background-color: #22c55e; color: #052e16; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 36px; border-radius: 9999px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); text-align: center;">
          Lihat Riwayat Pesanan
        </a>
      </div>
    </div>

    <!-- Conversational Footer -->
    <div style="background-color: #f8f9fb; border-top: 1px solid #e5e7eb; padding: 20px 28px; text-align: center; font-size: 12px; color: #6b7280; line-height: 1.6;">
      <p style="margin: 0 0 4px 0; font-weight: 500;">Terima kasih atas kepercayaan Anda bersama <b>UrbanLogis</b>.</p>
      <p style="margin: 0; color: #9ca3af;">Email ini dikirim secara otomatis oleh sistem notifikasi UrbanLogis Delivery.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildDriverJobSlipHtml(data: DriverJobSlipData): string {
  const deliveryFee = data.fee ?? 15000;
  // Pendapatan bersih mitra: 80% dari ongkos kirim
  const netEarnings = Math.round(deliveryFee * 0.8);
  const distanceFormatted = formatDistance(data.distanceM);
  const completedDate = formatDate(data.completedAt);

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <title>Laporan Tugas Selesai UrbanLogis #${data.orderId.slice(0, 8)}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f8f9fb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03);">
    
    <!-- Brand Header -->
    <div style="padding: 32px 28px 24px 28px; text-align: center; border-bottom: 1px solid #f3f4f6;">
      <div style="display: inline-flex; align-items: center; justify-content: center; background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 16px;">
        <span style="display: inline-block; width: 6px; height: 6px; background-color: #3b82f6; border-radius: 50%; margin-right: 8px;"></span>
        Tugas Berhasil Selesai
      </div>
      <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.02em;">UrbanLogis Mitra</h1>
      <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 400;">Ringkasan Penyelesaian Order Pengantaran</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #374151; line-height: 1.6;">
        Kerja luar biasa, Mitra <b>${data.driverName}</b>! Anda telah menyelesaikan 1 tugas pengantaran dengan sukses.
      </p>

      <!-- Earnings Highlight Box (Primary Container) -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 22px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 12px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.05em;">Pendapatan Bersih Pesanan Ini</span>
        <div style="font-size: 32px; font-weight: 800; color: #052e16; margin: 8px 0 4px 0; letter-spacing: -0.02em;">${formatRupiah(netEarnings)}</div>
        <span style="font-size: 12px; color: #166534; font-weight: 500;">Telah ditambahkan ke saldo dompet mitra Anda</span>
      </div>

      <!-- Job Details Box (Surface Container Low) -->
      <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">ID Order</td>
            <td style="color: #111827; font-weight: 700; text-align: right; font-family: monospace; font-size: 13px;">${data.orderId}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Pelanggan</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">👤 ${data.customerName}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Waktu Selesai</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">${completedDate}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Total Jarak Tempuh</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">📍 ${distanceFormatted}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 6px 0; font-weight: 500;">Nilai Pesanan (Bruto)</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">${formatRupiah(deliveryFee)}</td>
          </tr>
        </table>
      </div>

      <!-- Driver Online Status Badge (Full Pill, #F0FDF4) -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 12px 20px; margin-bottom: 28px; text-align: center;">
        <span style="font-size: 13px; color: #052e16; font-weight: 600;">
          🟢 Status Anda saat ini: <b>ONLINE</b> & Siap Terima Order Baru
        </span>
      </div>

      <!-- Secondary Action Button (Full Pill, Secondary Blue #2563EB) -->
      <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="http://localhost:5173" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 36px; border-radius: 9999px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); text-align: center;">
          Buka Dashboard Mitra
        </a>
      </div>
    </div>

    <!-- Conversational Footer -->
    <div style="background-color: #f8f9fb; border-top: 1px solid #e5e7eb; padding: 20px 28px; text-align: center; font-size: 12px; color: #6b7280; line-height: 1.6;">
      <p style="margin: 0 0 4px 0; font-weight: 500;">UrbanLogis Mitra • Terima kasih atas dedikasi dan kerja keras Anda.</p>
      <p style="margin: 0; color: #9ca3af;">Tetap utamakan keselamatan dan patuhi rambu lalu lintas! 🛵🛡️</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
