import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000';
const DRIVER_EMAIL = 'sajidan@gmail.com'; // Sesuaikan jika email driver berbeda
const DRIVER_PASSWORD = 'hallo12345';

// Konstanta delay antar titik (dalam ms)
const MOVE_DELAY_MS = 1500;

async function fetchOSRM(
  startLoc: { lat: number; lng: number },
  endLoc: { lat: number; lng: number },
): Promise<{ lat: number; lng: number }[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLoc.lng},${startLoc.lat};${endLoc.lng},${endLoc.lat}?overview=full&geometries=geojson`;
  console.log(`[OSRM] Mendapatkan rute...`);
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0) return [];
  // GeoJSON is [lng, lat], map to {lat, lng}
  return data.routes[0].geometry.coordinates.map((coord: number[]) => ({
    lat: coord[1],
    lng: coord[0],
  }));
}

// Map order ID -> bool untuk mencegah re-simulasi
const simulatingOrders = new Map<string, boolean>();

async function runSimulator() {
  console.log('🚗 Memulai Driver Simulator...');

  // 1. Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DRIVER_EMAIL, password: DRIVER_PASSWORD }),
  });

  if (!loginRes.ok) {
    console.error(
      '❌ Gagal login. Pastikan backend jalan dan kredensial benar.',
    );
    return;
  }

  // Ambil Set-Cookie dari respons untuk diteruskan ke permintaan berikutnya
  const cookieHeader = loginRes.headers.get('set-cookie');
  if (!cookieHeader) {
    console.error('❌ Tidak mendapat cookie otentikasi.');
    return;
  }

  // Ekstrak token cookie (misal: Authentication=...; Path=/)
  const authCookie = cookieHeader.split(';')[0];
  console.log('✅ Login sukses!');

  // 2. Connect WebSocket
  const socket = io(API_URL, {
    extraHeaders: {
      Cookie: authCookie,
      Origin: 'http://localhost:5173',
    },
  });

  socket.on('connect', () => {
    console.log(
      '✅ Terhubung ke WebSocket Gateway (Gateway ID:',
      socket.id,
      ')',
    );
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket terputus:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket error:', err.message);
  });

  socket.on('exception', (err) => {
    console.error('❌ Socket exception dari server:', err);
  });

  // Lokasi awal driver
  let currentLocation = { lat: -6.9455512, lng: 107.7054413 };

  // 3. Set Online
  const onlineRes = await fetch(`${API_URL}/drivers/online`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authCookie,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(currentLocation),
  });
  if (onlineRes.ok) {
    console.log('✅ Driver Online (Menunggu pesanan...)');
  } else {
    const errText = await onlineRes.text();
    console.error(`❌ Gagal set online: ${onlineRes.status} ${onlineRes.statusText}`, errText);
  }

  // Fungsi utilitas untuk bergerak menyusuri array lokasi
  const driveAlongRoute = async (
    route: { lat: number; lng: number }[],
    orderId: string,
  ) => {
    for (let i = 0; i < route.length; i++) {
      currentLocation = route[i];
      // Emit posisi ke WebSocket
      socket.emit('driver:location', {
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        orderId: orderId,
      });
      console.log(
        `[BERGERAK] 📍 GPS -> Lat: ${currentLocation.lat.toFixed(5)}, Lng: ${currentLocation.lng.toFixed(5)}`,
      );
      // Tunggu sebelum pindah ke titik berikutnya
      await new Promise((resolve) => setTimeout(resolve, MOVE_DELAY_MS));
    }
  };

  // 4. Polling untuk mencari pesanan
  setInterval(async () => {
    const ordersRes = await fetch(`${API_URL}/orders`, {
      headers: {
        Cookie: authCookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!ordersRes.ok) return;

    const orders = await ordersRes.json();
    if (!Array.isArray(orders)) return;

    const activeOrder = orders.find((o: any) => o.status !== 'COMPLETED');
    if (activeOrder) {
      if (
        activeOrder.status === 'DRIVER_ASSIGNED' &&
        !simulatingOrders.get(activeOrder.id)
      ) {
        // Tandai order sedang diproses
        simulatingOrders.set(activeOrder.id, true);

        console.log(
          `\n📦 Pesanan masuk! Menuju titik JEMPUT (Order ID: ${activeOrder.id})`,
        );
        const routeToPickup = await fetchOSRM(
          currentLocation,
          activeOrder.pickup,
        );

        if (routeToPickup.length > 0) {
          await driveAlongRoute(routeToPickup, activeOrder.id);
        }

        console.log('✅ Tiba di titik JEMPUT! Mengubah status ke PICKED_UP...');
        await fetch(`${API_URL}/orders/${activeOrder.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: authCookie,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ status: 'PICKED_UP' }),
        });

        console.log(`\n📦 Barang dibawa! Menuju titik TUJUAN...`);
        const routeToDropoff = await fetchOSRM(
          currentLocation,
          activeOrder.dropoff,
        );

        if (routeToDropoff.length > 0) {
          await driveAlongRoute(routeToDropoff, activeOrder.id);
        }

        console.log('✅ Tiba di titik TUJUAN! Mengubah status ke COMPLETED...');
        await fetch(`${API_URL}/orders/${activeOrder.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: authCookie,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ status: 'COMPLETED' }),
        });

        console.log('\n✅ Pesanan selesai. Menunggu pesanan berikutnya...\n');
        simulatingOrders.delete(activeOrder.id);
      }
    }
  }, 5000); // Polling setiap 5 detik
}

runSimulator().catch(console.error);
