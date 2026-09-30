# TSD — Technical Specification

## 1. Stack

| Area | Pilihan |
|---|---|
| Runtime/Lang | Node.js LTS, TypeScript (ESM) |
| Package manager | Bun (`bun.lock`) |
| Framework | NestJS (monorepo mode) |
| Transport | `@nestjs/microservices`: TCP, gRPC, RMQ |
| Realtime | `@nestjs/websockets` + `@nestjs/platform-socket.io` |
| DB | PostgreSQL + PostGIS (image `postgis/postgis`) |
| ORM | Auth: **Prisma**; Order & Location: **TypeORM** (+ raw SQL untuk spasial) |
| Broker | RabbitMQ (`rabbitmq:management`) |
| Auth | `@nestjs/jwt`, `bcrypt` |
| Validasi | `class-validator`, `class-transformer` |
| Docs API | `@nestjs/swagger` (hanya di Gateway) |
| Test | Vitest + supertest |

**Catatan tooling**
- Scaffold: `nest new` dengan package manager Bun dan module system ESM + Vitest.
- Script dijalankan dengan `bun run <script>`. `bun test` bukan Vitest.
- Bun tidak menjalankan postinstall dependensi secara default: daftarkan paket native (mis. `bcrypt`, `prisma`) di `trustedDependencies` pada `package.json`.
- Alias `@app/common` harus terdaftar di tsconfig **dan** konfigurasi Vitest.
- Prisma lewat `bunx prisma generate` / `bunx prisma migrate dev`.

## 2. Struktur Repo

```
on-demand-delivery-tracking/
├─ apps/
│  ├─ gateway/
│  ├─ auth-service/          # + prisma/schema.prisma
│  ├─ order-service/
│  ├─ location-service/
│  └─ notification-service/
├─ libs/common/src/
│  ├─ dto/                   # DTO + decorator Swagger
│  ├─ enums/                 # Role, OrderStatus
│  ├─ events/                # nama event + payload interface
│  ├─ proto/                 # location.proto
│  ├─ constants/             # nama queue, token DI, pattern TCP
│  └─ filters/               # RpcException helper
├─ docs/
├─ docker-compose.yml
├─ .env.example
└─ AGENTS.md
```

Aturan `libs/common`: hanya DTO, enum, konstanta, interface, proto. **Dilarang** berisi entity/model ORM.

## 3. Port & Infrastruktur

| Komponen | Port |
|---|---|
| Gateway (HTTP+WS) | 3000 |
| Auth (TCP) | 4001 |
| Order (TCP) | 4002 |
| Location (gRPC) | 50051 |
| PostgreSQL | 5432 (db: `auth_db`, `order_db`, `location_db`) |
| RabbitMQ | 5672 (UI 15672) |

`docker-compose.yml`: service `postgres` (image postgis + init script membuat 3 database dan `CREATE EXTENSION postgis` di `order_db` dan `location_db`) dan `rabbitmq`.

## 4. Skema Database

### 4.1 auth_db (Prisma)
```prisma
enum Role { CUSTOMER DRIVER }

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role
  createdAt    DateTime @default(now())
}
```

### 4.2 order_db (TypeORM / SQL)
```sql
CREATE TYPE order_status AS ENUM
 ('PENDING','DRIVER_ASSIGNED','PICKED_UP','COMPLETED','NO_DRIVER_AVAILABLE');

CREATE TABLE orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  driver_id   uuid NULL,
  status      order_status NOT NULL DEFAULT 'PENDING',
  pickup      geography(Point,4326) NOT NULL,
  dropoff     geography(Point,4326) NOT NULL,
  distance_m  integer NOT NULL,
  fee         integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON orders (customer_id);
CREATE INDEX ON orders (driver_id);
```
`gen_random_uuid()` tersedia di PostgreSQL 13+. `distance_m = ST_Distance(pickup, dropoff)` (garis lurus, catat sebagai keterbatasan). `fee` flat dari env `FLAT_FEE`.

### 4.3 location_db (SQL)
```sql
CREATE TABLE driver_locations (
  driver_id    uuid PRIMARY KEY,
  is_available boolean NOT NULL DEFAULT false,
  location     geography(Point,4326) NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX driver_locations_gix ON driver_locations USING GIST (location);
```

Query inti:
```sql
-- upsert lokasi
INSERT INTO driver_locations (driver_id, is_available, location)
VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3,$4),4326)::geography)
ON CONFLICT (driver_id) DO UPDATE
SET location = EXCLUDED.location, updated_at = now();

-- driver terdekat (available, dalam radius, tidak stale)
SELECT driver_id,
       ST_Distance(location, p.pt) AS distance_m,
       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
FROM driver_locations,
     (SELECT ST_SetSRID(ST_MakePoint($1,$2),4326)::geography AS pt) p
WHERE is_available = true
  AND updated_at > now() - interval '60 seconds'
  AND ST_DWithin(location, p.pt, $3)
ORDER BY location <-> p.pt
LIMIT $4;
```
Urutan `ST_MakePoint(lng, lat)`. Ping WS **tidak** boleh mengubah `is_available` (hanya `SetDriverAvailability` yang mengubahnya).

## 5. REST API (Gateway)

Base URL `http://localhost:3000`. Bearer JWT kecuali `/auth/*`.

| Method | Path | Role | Body | Sukses | Error |
|---|---|---|---|---|---|
| POST | `/auth/register` | public | `{email,password,name,role}` | 201 `{id,email,name,role}` | 409 email dipakai, 400 |
| POST | `/auth/login` | public | `{email,password}` | 200 `{accessToken}` | 401 |
| GET | `/auth/me` | any | – | 200 `{id,email,name,role}` | 401 |
| POST | `/orders` | CUSTOMER | `{pickup:{lat,lng},dropoff:{lat,lng}}` | 201 Order | 400, 403 |
| GET | `/orders` | any | – | 200 `Order[]` (milik user) | 401 |
| GET | `/orders/:id` | any | – | 200 Order | 403, 404 |
| PATCH | `/orders/:id/status` | DRIVER | `{status}` (`PICKED_UP`/`COMPLETED`) | 200 Order | 403, 404, 409 |
| POST | `/drivers/online` | DRIVER | `{lat,lng}` | 200 `{ok:true}` | 403 |
| POST | `/drivers/offline` | DRIVER | – | 200 `{ok:true}` | 403 |

**Contoh `POST /orders`**
```json
{ "pickup": {"lat": -6.9147, "lng": 107.6098}, "dropoff": {"lat": -6.9034, "lng": 107.6186} }
```
**Contoh respons**
```json
{ "id":"…","status":"DRIVER_ASSIGNED","driverId":"…","distanceM":1650,"fee":10000 }
```

## 6. Swagger
- Setup di `apps/gateway/src/main.ts`: `DocumentBuilder` + `addBearerAuth()`, dokumen di `/docs`.
- Tiap controller: `@ApiTags`, `@ApiBearerAuth` (kecuali public), tiap endpoint: `@ApiOperation`, `@ApiResponse` (sukses + error utama).
- DTO request/response di `libs/common/dto` memakai `@ApiProperty({ example })`. Boleh memakai Swagger CLI plugin untuk mengurangi boilerplate.
- WebSocket tidak tercakup Swagger → didokumentasikan di §7.
- Pembuatan dekorator boleh dibantu AI, tetapi hasilnya harus dicek terhadap tabel §5.

## 7. WebSocket (Gateway, Socket.IO)
Koneksi: `io("http://localhost:3000", { auth: { token: "<JWT>" } })`. Token diverifikasi saat handshake (TCP `auth.validate_token`); gagal → disconnect.

| Event | Arah | Role | Payload | Catatan |
|---|---|---|---|---|
| `driver:location` | client→server | DRIVER | `{lat,lng,orderId?}` | emit RMQ `driver.location_updated`; jika `orderId` → forward ke room |
| `order:subscribe` | client→server | CUSTOMER | `{orderId}` | cek kepemilikan via `order.get`, lalu join `order:{id}` |
| `order:location` | server→client | – | `{orderId,lat,lng,ts}` | ke room `order:{id}` |
| `order:status` | server→client | – | `{orderId,status,driverId?}` | dari event `order.*` |

## 8. State Machine Order

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> DRIVER_ASSIGNED: driver ditemukan
  PENDING --> NO_DRIVER_AVAILABLE: tidak ada driver
  DRIVER_ASSIGNED --> PICKED_UP: driver
  PICKED_UP --> COMPLETED: driver
  COMPLETED --> [*]
  NO_DRIVER_AVAILABLE --> [*]
```
Transisi lain → `409 INVALID_STATUS_TRANSITION`. Hanya `driver_id` yang tercatat boleh mengubah status.

## 9. TCP Message Patterns

| Service | Pattern | Payload | Respons |
|---|---|---|---|
| Auth | `auth.register` | `RegisterDto` | `UserDto` |
| Auth | `auth.login` | `LoginDto` | `{accessToken}` |
| Auth | `auth.validate_token` | `{token}` | `{userId,role}` |
| Auth | `auth.me` | `{userId}` | `UserDto` |
| Order | `order.create` | `{customerId,pickup,dropoff}` | `OrderDto` |
| Order | `order.get` | `{orderId,userId,role}` | `OrderDto` |
| Order | `order.list` | `{userId,role}` | `OrderDto[]` |
| Order | `order.update_status` | `{orderId,driverId,status}` | `OrderDto` |

Error dikirim sebagai `RpcException({ code, message })` (kode di §11).

## 10. gRPC & Event

### 10.1 `libs/common/src/proto/location.proto`
```proto
syntax = "proto3";
package location;

service LocationService {
  rpc FindNearestDrivers (FindNearestDriversRequest) returns (FindNearestDriversResponse);
  rpc SetDriverAvailability (SetDriverAvailabilityRequest) returns (SetDriverAvailabilityResponse);
}

message FindNearestDriversRequest { double lat = 1; double lng = 2; int32 radius_m = 3; int32 limit = 4; }
message NearbyDriver { string driver_id = 1; double distance_m = 2; double lat = 3; double lng = 4; }
message FindNearestDriversResponse { repeated NearbyDriver drivers = 1; }

message SetDriverAvailabilityRequest { string driver_id = 1; bool is_available = 2; double lat = 3; double lng = 4; }
message SetDriverAvailabilityResponse { bool ok = 1; }
```
Radius default pencarian: `SEARCH_RADIUS_M=3000`, `limit=1`.
Karena ESM, path file proto dirujuk dengan `import.meta.dirname` (atau `fileURLToPath(import.meta.url)`), bukan `__dirname`; pastikan file `.proto` ikut tersalin ke output build (assets di `nest-cli.json`).

### 10.2 Event RabbitMQ

| Event | Publisher → Queue | Consumer | Payload |
|---|---|---|---|
| `driver.location_updated` | Gateway → `location_queue` | Location | `{driverId,lat,lng,ts}` |
| `order.created` | Order → `notification_queue` | Notification | `{orderId,customerId}` |
| `order.driver_assigned` | Order → `notification_queue`, `gateway_queue` | Notification, Gateway | `{orderId,customerId,driverId}` |
| `order.status_changed` | Order → `notification_queue`, `gateway_queue` | Notification, Gateway | `{orderId,customerId,driverId,status}` |

Order memakai dua `ClientProxy` RMQ (satu per queue tujuan). Nama queue dan event ada di `libs/common/constants` dan `libs/common/events`.

## 11. Error Code

| Code | HTTP | Arti |
|---|---|---|
| `VALIDATION_ERROR` | 400 | DTO tidak valid |
| `UNAUTHORIZED` | 401 | token hilang/invalid |
| `FORBIDDEN` | 403 | role/kepemilikan salah |
| `NOT_FOUND` | 404 | resource tidak ada |
| `EMAIL_TAKEN` | 409 | email sudah terdaftar |
| `INVALID_STATUS_TRANSITION` | 409 | transisi state ilegal |
| `INTERNAL` | 500 | error lain |

Bentuk respons error: `{ statusCode, code, message }`.

## 12. Environment Variable (`.env.example`)

```
# umum
JWT_SECRET=change-me
JWT_EXPIRES_IN=1d
RABBITMQ_URL=amqp://guest:guest@localhost:5672
# gateway
GATEWAY_PORT=3000
AUTH_HOST=localhost
AUTH_PORT=4001
ORDER_HOST=localhost
ORDER_PORT=4002
LOCATION_GRPC_URL=localhost:50051
# auth
AUTH_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auth_db
# order
ORDER_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/order_db
FLAT_FEE=10000
SEARCH_RADIUS_M=3000
# location
LOCATION_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/location_db
```

## 13. Perintah Standar

```
docker compose up -d
bun install
bun run start:dev <app>       # mis. gateway, auth-service
bun run db:migrate:auth       # prisma migrate
bun run db:migrate:order      # migrasi TypeORM/SQL
bun run db:migrate:location
bun run test                  # Vitest unit
bun run test:e2e              # Vitest e2e
```
