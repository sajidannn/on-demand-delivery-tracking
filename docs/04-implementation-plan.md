# Implementation Plan (7 Hari)

Legenda prioritas: **[W]** wajib · **[N]** nice to have · **[B]** bonus.
Tiap task selesai bila memenuhi _Definition of Done_ di `AGENTS.md`.

## Hari 1 — Fondasi

- [x] [W] Dokumen `docs/01–05` + `AGENTS.md` sudah ada dan direview
- [x] [W] `nest new on-demand-delivery-tracking` (Bun, ESM + Vitest), ubah ke monorepo mode, generate 5 app + `libs/common`; app default dihapus/diganti
- [x] [W] Vitest berjalan untuk `apps/` dan `libs/` (`bun run test` lulus dengan 1 tes contoh); alias `@app/common` terbaca di build dan Vitest
- [x] [W] `docker-compose.yml`: postgis (3 database + extension) + rabbitmq
- [x] [W] `.env.example`, `@nestjs/config` di tiap app
- [x] [W] `libs/common`: enum `Role`, `OrderStatus`, konstanta queue/pattern, interface event
- [x] [W] Semua app boot kosong tanpa error

**Selesai bila:** `docker compose up -d` sehat, 5 service bisa start, dan `bun run test` lulus.

## Hari 2 — Auth + Gateway + Swagger dasar

- [x] [W] Prisma di auth-service: schema, migrate, client output custom
- [x] [W] `trustedDependencies` (`bcrypt`, `prisma`) di `package.json` agar postinstall berjalan di Bun
- [x] [W] Auth TCP: `auth.register`, `auth.login`, `auth.validate_token`, `auth.me` (bcrypt + JWT)
- [x] [W] Gateway: ClientsModule TCP ke Auth, `AuthController` (`/auth/*`)
- [x] [W] `JwtAuthGuard` (memanggil `auth.validate_token`) + `@Roles()` + `RolesGuard`
- [x] [W] Global `ValidationPipe` + exception filter RPC→HTTP
- [x] [W] Swagger setup `/docs` + Bearer auth + dokumentasi `/auth/*`

**Selesai bila:** register → login → `GET /auth/me` jalan; tanpa token 401; muncul di `/docs`.

## Hari 3 — Location Service (PostGIS + gRPC)

- [x] [W] `location.proto` + konfigurasi gRPC server
- [x] [W] TypeORM koneksi ke `location_db`, migrasi tabel + GiST index
- [x] [W] Repository dengan raw SQL: upsert, find nearest
- [x] [W] gRPC `SetDriverAvailability`, `FindNearestDrivers`
- [x] [W] Gateway: gRPC client, `POST /drivers/online|offline` (+ Swagger)
- [ ] [N] Seed 3–5 driver dummy untuk tes

**Selesai bila:** `grpcurl` mengembalikan driver terdekat yang urutannya benar.

## Hari 4 — Order Service + Kunci Driver

**Fase 4a: Location Service & Persiapan**
- [ ] [W] Migrasi Location: tambah `current_order_id` & env `DRIVER_STALE_SECONDS`
- [ ] [W] Update gRPC `location.proto`: `ReserveNearestDriver` dan `ReleaseDriver`
- [ ] [W] Implementasi reserve atomik (`SKIP LOCKED`) dan release di Location Service
- [ ] [N] Seed 3-5 driver dummy untuk tes (pindahan dari Hari 3)

**Fase 4b: Order Service & Gateway**
- [ ] [W] TypeORM koneksi `order_db`, migrasi tabel `orders` (geography)
- [ ] [W] State machine (service terpisah, unit test transisi)
- [ ] [W] TCP `order.create/get/list/update_status`
- [ ] [W] Hitung `distance_m` (`ST_Distance`) dan `fee` flat
- [ ] [W] gRPC client ke Location, panggil reserve saat create, release saat `COMPLETED`
- [ ] [W] Gateway `OrderController` + guard role + Swagger

**Selesai bila:** `POST /orders` menghasilkan `DRIVER_ASSIGNED` dengan driver terdekat; transisi ilegal 409; driver yang di-assign tidak bisa menerima order lain secara bersamaan.

## Hari 5 — Event-Driven

- [ ] [W] Order: dua client RMQ (`notification_queue`, `gateway_queue`), emit `order.*`
- [ ] [W] Notification Service: `@EventPattern` untuk 3 event, log terstruktur
- [ ] [W] Gateway hybrid: `connectMicroservice` RMQ `gateway_queue` (handler sementara: log)
- [ ] [W] Location: listener RMQ `driver.location_updated` (upsert, tidak mengubah `is_available`)
- [ ] [N] Correlation ID di log

**Selesai bila:** ubah status order → muncul log di Notification dan Gateway.

## Hari 6 — WebSocket Tracking

- [ ] [W] `@WebSocketGateway`, auth handshake JWT
- [ ] [W] `driver:location` → emit RMQ + forward ke room bila `orderId`
- [ ] [W] `order:subscribe` (cek kepemilikan) → join room
- [ ] [W] Handler event `gateway_queue` mendorong `order:status` ke room/driver
- [ ] [N] Script simulator driver (Node) mengirim GPS bergerak
- [ ] [N] Script client customer untuk melihat `order:location`

**Selesai bila:** simulator berjalan dan customer menerima `order:location` real-time.

## Hari 7 — Buffer & Finishing

- [ ] [W] Perbaiki bug tersisa, verifikasi seluruh Acceptance Criteria PRD
- [ ] [W] 1 e2e test alur order (register → online → order → status → completed)
- [ ] [W] Review Swagger: semua endpoint lengkap contoh & error
- [ ] [W] README (cara menjalankan + skenario uji)
- [ ] [B] Geofence arrival (`ST_DWithin` 50 m ke pickup)
- [ ] [B] `location_history` + `ST_MakeLine` untuk rute

## Jika waktu mepet

Pertahankan **[W]** Hari 1–5 dulu. Hari 6 (WebSocket) boleh disederhanakan; [N] dan [B] dibuang. Fallback: Auth ganti ke TypeORM bila Prisma memakan waktu (lihat ADR-004).

## Risiko Umum

| Risiko                                                               | Mitigasi                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Setup proto/gRPC molor                                               | Tes dengan `grpcurl` dulu sebelum menyambung ke Order                                             |
| Fan-out RMQ membingungkan                                            | Baca SDD §5 dan ADR-006                                                                           |
| Urutan lng/lat terbalik                                              | Selalu `ST_MakePoint(lng, lat)`; tulis test dengan koordinat nyata                                |
| Prisma di monorepo bentrok                                           | Set `output` custom di `schema.prisma`                                                            |
| `bun test` menjalankan runner Bun, bukan Vitest                      | Selalu `bun run test` / `bun run test:e2e`                                                        |
| Native module (`bcrypt`) gagal karena postinstall tidak jalan di Bun | Daftarkan di `trustedDependencies`, lalu `bun install` ulang                                      |
| Error ESM (`__dirname`, ekstensi import, path proto)                 | Pakai `import.meta.dirname`; ikuti aturan import tsconfig; cek assets `.proto` di `nest-cli.json` |
