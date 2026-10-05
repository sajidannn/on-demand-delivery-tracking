const GATEWAY_URL = 'http://localhost:3000';

async function seed() {
  const drivers = [
    {
      email: 'driver1@test.com',
      password: 'password',
      name: 'Driver Satu',
      lat: -6.2,
      lng: 106.8,
    },
    {
      email: 'driver2@test.com',
      password: 'password',
      name: 'Driver Dua',
      lat: -6.21,
      lng: 106.81,
    },
    {
      email: 'driver3@test.com',
      password: 'password',
      name: 'Driver Tiga',
      lat: -6.25,
      lng: 106.85,
    },
  ];

  for (const driver of drivers) {
    console.log(`Seeding driver: ${driver.email}`);
    try {
      // 1. Register
      const regRes = await fetch(`${GATEWAY_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: driver.email,
          password: driver.password,
          name: driver.name,
          role: 'DRIVER',
        }),
      });

      if (!regRes.ok) {
        const body = await regRes.text();
        // Ignore EMAIL_TAKEN (409) if it already exists, so we can still try to login and set online
        if (regRes.status !== 409) {
          console.error(`Register failed for ${driver.email}: ${body}`);
          continue;
        } else {
          console.log(
            `Driver ${driver.email} already registered, skipping registration.`,
          );
        }
      }

      // 2. Login
      const loginRes = await fetch(`${GATEWAY_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: driver.email,
          password: driver.password,
        }),
      });

      if (!loginRes.ok) {
        console.error(`Login failed for ${driver.email}`);
        continue;
      }
      const { accessToken } = await loginRes.json();

      // 3. Set Online
      const onlineRes = await fetch(`${GATEWAY_URL}/drivers/online`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          lat: driver.lat,
          lng: driver.lng,
        }),
      });

      if (!onlineRes.ok) {
        const body = await onlineRes.text();
        console.error(`Set online failed for ${driver.email}: ${body}`);
        continue;
      }

      console.log(
        `Driver ${driver.name} seeded and is now online at (${driver.lat}, ${driver.lng})`,
      );
    } catch (err) {
      console.error(`Error processing driver ${driver.email}:`, err);
    }
  }
}

seed().catch(console.error);
