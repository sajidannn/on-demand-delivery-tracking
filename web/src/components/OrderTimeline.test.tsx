import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderTimeline from './OrderTimeline';
import { formatLocalTime, type OrderHistoryItem } from '../lib/order-timeline';

const history: OrderHistoryItem[] = [
  { status: 'PENDING', at: '2026-10-09T07:12:00.000Z', actor: 'CUSTOMER' },
  { status: 'DRIVER_ASSIGNED', at: '2026-10-09T07:14:00.000Z', actor: 'SYSTEM' },
  { status: 'PICKED_UP', at: '2026-10-09T07:19:00.000Z', actor: 'DRIVER' },
  { status: 'COMPLETED', at: '2026-10-09T07:36:00.000Z', actor: 'DRIVER' },
];

describe('OrderTimeline', () => {
  it('menampilkan semua tahap status', () => {
    render(<OrderTimeline history={history} />);
    expect(screen.getByText('Mencari Kurir')).toBeInTheDocument();
    expect(screen.getByText('Kurir Menuju Lokasi Jemput')).toBeInTheDocument();
    expect(screen.getByText('Barang Sedang Diantar')).toBeInTheDocument();
    expect(screen.getByText('Pesanan Selesai')).toBeInTheDocument();
  });

  it('menampilkan jam lokal perangkat untuk tiap tahap', () => {
    render(<OrderTimeline history={history} />);
    for (const item of history) {
      expect(screen.getAllByText(formatLocalTime(item.at)).length).toBeGreaterThan(0);
    }
  });

  it('menampilkan label durasi antar tahap', () => {
    render(<OrderTimeline history={history} />);
    expect(screen.getByText('Menunggu driver 2 mnt')).toBeInTheDocument();
    expect(screen.getByText('Driver menuju pickup 5 mnt')).toBeInTheDocument();
    expect(screen.getByText('Perjalanan pengantaran 17 mnt')).toBeInTheDocument();
  });

  it('tidak merender apa pun saat history kosong', () => {
    const { container } = render(<OrderTimeline history={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('menggunakan judul kustom bila diberikan', () => {
    render(<OrderTimeline history={history} title="Perjalanan Pesanan" />);
    expect(screen.getByText('Perjalanan Pesanan')).toBeInTheDocument();
  });
});
