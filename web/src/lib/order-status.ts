export interface OrderStatusInfo {
  label: string;
  customerDescription: string;
  driverDescription: string;
  badgeClass: string;
  dotColor?: string;
}

export const ORDER_STATUS_MAP: Record<string, OrderStatusInfo> = {
  PENDING: {
    label: 'Mencari Kurir',
    customerDescription: 'Sedang mencari kurir terdekat...',
    driverDescription: 'Pesanan baru menunggu kurir',
    badgeClass: 'bg-[#FEF3C7] text-[#451A03] border border-[#FDE68A]',
    dotColor: '#F59E0B',
  },
  DRIVER_ASSIGNED: {
    label: 'Kurir Menuju Lokasi Jemput',
    customerDescription: 'Kurir sedang menuju titik jemput',
    driverDescription: 'Menuju lokasi penjemputan barang',
    badgeClass: 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]',
    dotColor: '#3B82F6',
  },
  PICKED_UP: {
    label: 'Barang Sedang Diantar',
    customerDescription: 'Barang telah dibawa & dalam perjalanan ke tujuan',
    driverDescription: 'Barang dibawa, menuju titik tujuan',
    badgeClass: 'bg-[#FAF5FF] text-[#6B21A8] border border-[#E9D5FF]',
    dotColor: '#A855F7',
  },
  COMPLETED: {
    label: 'Pesanan Selesai',
    customerDescription: 'Pesanan telah berhasil tiba di tujuan',
    driverDescription: 'Pengantaran selesai',
    badgeClass: 'bg-[#F0FDF4] text-[#052E16] border border-[#BBF7D0]',
    dotColor: '#22C55E',
  },
  NO_DRIVER_AVAILABLE: {
    label: 'Kurir Tidak Tersedia',
    customerDescription: 'Maaf, tidak ada kurir yang tersedia di sekitarmu',
    driverDescription: 'Order tidak dapat ditugaskan',
    badgeClass: 'bg-[#FEF2F2] text-[#7F1D1D] border border-[#FECACA]',
    dotColor: '#EF4444',
  },
  CANCELLED: {
    label: 'Pesanan Dibatalkan',
    customerDescription: 'Pesanan ini telah dibatalkan',
    driverDescription: 'Pesanan dibatalkan',
    badgeClass: 'bg-[#FEF2F2] text-[#7F1D1D] border border-[#FECACA]',
    dotColor: '#EF4444',
  },
};

export function getOrderStatusInfo(status?: string): OrderStatusInfo {
  if (!status || !ORDER_STATUS_MAP[status]) {
    return {
      label: status || 'Memproses',
      customerDescription: 'Memproses pesanan...',
      driverDescription: 'Memproses pesanan...',
      badgeClass: 'bg-surface-container-high text-on-surface border border-surface-container-highest',
    };
  }
  return ORDER_STATUS_MAP[status];
}
