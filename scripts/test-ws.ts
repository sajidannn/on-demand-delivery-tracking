import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000';

async function registerAndLogin(email: string, role: string) {
  // Register if doesn't exist
  try {
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password', role, name: role }),
    });
  } catch (e) {
    // Ignore, might already exist
  }

  // Login
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password' }),
  });
  const data = (await res.json()) as any;
  if (!data.accessToken) {
    console.error('Login failed for', email, data);
  }
  return data.accessToken;
}

async function run() {
  console.log('1. Register/Login Driver & Customer...');
  const ts = Date.now();
  const driverToken = await registerAndLogin(`driver_${ts}@test.com`, 'DRIVER');
  const customerToken = await registerAndLogin(`cust_${ts}@test.com`, 'CUSTOMER');

  if (!driverToken || !customerToken) {
    console.error('Failed to get tokens. Pastikan semua Docker containers dan bun run start:dev gateway/auth jalan!');
    return;
  }

  console.log('2. Driver set online...');
  await fetch(`${API_URL}/drivers/online`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({ lat: -6.2, lng: 106.8 }),
  });

  console.log('3. Customer creates order...');
  const orderRes = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      pickup: { lat: -6.2001, lng: 106.8001 },
      dropoff: { lat: -6.21, lng: 106.81 },
    }),
  });
  
  const orderData = (await orderRes.json()) as any;
  const orderId = orderData.id;
  
  if (!orderId) {
    console.error('Gagal membuat order! Respons:', orderData);
    return;
  }
  console.log(`Order berhasil dibuat: ${orderId} dengan status ${orderData.status}`);

  console.log('4. Connecting WebSockets...');
  const driverSocket = io(WS_URL, { auth: { token: driverToken } });
  const customerSocket = io(WS_URL, { auth: { token: customerToken } });

  customerSocket.on('connect', () => {
    console.log('[Customer] WS Connected');
    customerSocket.emit('order:subscribe', { orderId }, (ack: any) => {
      console.log('[Customer] Subscribed to order! Server ack:', ack);
    });
  });

  let driverCompleted = false;
  let customerCompleted = false;

  const checkDone = () => {
    if (driverCompleted && customerCompleted) {
      console.log('[System] Kedua pihak menerima COMPLETED. Menutup socket...');
      driverSocket.disconnect();
      customerSocket.disconnect();
      process.exit(0);
    }
  };

  customerSocket.on('order:status', (data) => {
    console.log('[Customer] 🔔 Received order:status ->', data);
    if (data?.status === 'COMPLETED') {
      customerCompleted = true;
      checkDone();
    }
  });

  customerSocket.on('order:location', (data) => {
    console.log('[Customer] 📍 Received order:location ->', data);
  });

  driverSocket.on('order:status', (data) => {
    console.log('[Driver] 🔔 Received order:status ->', data);
    if (data?.status === 'COMPLETED') {
      driverCompleted = true;
      checkDone();
    }
  });

  driverSocket.on('connect', () => {
    console.log('[Driver] WS Connected');
    
    let lat = -6.2001;
    let lng = 106.8001;
    
    console.log('[Driver] Memulai pergerakan GPS...');
    const interval = setInterval(() => {
      lat += 0.0001;
      lng += 0.0001;
      console.log(`[Driver] 🚀 Emitting location... lat: ${lat.toFixed(4)}, lng: ${lng.toFixed(4)}`);
      driverSocket.emit('driver:location', { orderId, lat, lng });
    }, 3000);

    // Simulate status change after 6 seconds
    setTimeout(async () => {
      console.log(`[Driver] 📦 Driver picked up order...`);
      await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ status: 'PICKED_UP' }),
      });
    }, 6000);

    // Simulate completion after 12 seconds
    setTimeout(async () => {
      console.log(`[Driver] ✅ Driver completed order...`);
      await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      clearInterval(interval);
      console.log(`[Driver] Selesai, menunggu pesan COMPLETED...`);
    }, 12000);
  });
  
  driverSocket.on('disconnect', (reason) => {
    console.log('[Driver] Terputus:', reason);
  });
  
  customerSocket.on('disconnect', (reason) => {
    console.log('[Customer] Terputus:', reason);
  });
}

run().catch(console.error);
