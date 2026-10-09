# TSD Addendum v1.1 — Kontrak Teknis Rute, Tarif, dan Web UI

> Pelengkap `docs/03-tsd.md`. Tiap bagian menyebut bagian TSD asli yang diubah. Setelah direview, gabungkan sesuai `docs/12-perubahan-dokumen-lama.md`. Untuk bagian yang bertentangan dengan TSD asli, **addendum ini berlaku** untuk fitur v1.1.

## 1. Stack Tambahan (menambah TSD §1)

| Area | Pilihan |
|---|---|
| Routing engine | OSRM (HTTP API). Server demo dulu, lalu self-host (Docker) |
| HTTP client (backend) | `fetch` bawaan Node + `AbortSignal.timeout` (tanpa dependensi baru) |
| Frontend | Vite + React + TypeScript (strict) |
| Routing UI | React Router |
| Data server | TanStack Query |
| Realtime | `socket.io-client` |
| Peta | `leaflet@1.9.x` (dipin) + `react-leaflet` (pilih versi yang kompatibel dengan versi React yang dipakai) |
| Styling | Tailwind CSS |
| Tipe API | `openapi-typescript` + `openapi-fetch`, dihasilkan dari `/docs-json` Gateway |
| Test frontend | Vitest (lingkungan `jsdom`) + React Testing Library |
| Sesi browser | Cookie `HttpOnly` yang di-set Gateway; backend memakai `cookie-parser` (HTTP) dan `cookie` (parse header handshake WebSocket); frontend memakai `fetch` dengan `credentials: 'include'` |

Package manager frontend: Bun (`web/bun.lock`). Dependensi baru frontend tidak melanggar AGENTS #10 selama tercakup ADR-019 dan ADR-020; `cookie-parser` dan `cookie` di backend tercakup ADR-022.

## 2. Struktur Repo (mengubah TSD §2)

```
on-demand-delivery-tracking/
├─ apps/…                       # tidak berubah (5 service Nest)
├─ libs/common/src/
│  ├─ enums/route-source.enum.ts      # baru: OSRM | STRAIGHT_LINE
│  └─ dto/…                           # tambahan DTO estimasi + perubahan OrderDto
├─ apps/order-service/src/routing/    # baru
│  ├─ osrm.client.ts                  # panggilan HTTP ke OSRM
│  ├─ routing.service.ts              # OSRM + fallback
│  └─ fee-calculator.ts               # fungsi murni
├─ apps/gateway/src/session/          # baru: util cookie sesi dan ekstraksi token
├─ web/                               # baru: aplikasi frontend (package.json sendiri)
│  └─ src/{app,features,components,lib}
├─ scripts/osrm-setup.sh              # baru: menyiapkan data OSRM
├─ osrm-data/                         # baru: data OSRM (di .gitignore)
└─ docs/
```

`web/` sengaja di luar `apps/` agar tidak dianggap proyek Nest oleh Nest CLI. Konfigurasi root harus mengecualikannya (lihat §14).

## 3. Port & Infrastruktur (menambah TSD §3)

| Komponen | Port |
|---|---|
| Web (Vite dev server) | 5173 |
| OSRM (self-host, host → container) | `127.0.0.1:5001` → 5000 |

Port host 5001 dipilih karena 5000 sudah dipakai `LOCATION_HTTP_PORT`. OSRM dipublikasikan hanya ke localhost; hanya Order Service yang memanggilnya.

Service `osrm` di `docker-compose.yml` memakai `profiles: ["osrm"]` agar `docker compose up -d` biasa tidak menyalakannya sebelum datanya disiapkan (lihat §12).

## 4. Skema Database (mengubah TSD §4.2)

Migrasi baru di `apps/order-service/src/migrations/<timestamp>-AddRouteToOrders.ts`:

```sql
ALTER TABLE orders
  ADD COLUMN duration_s   integer NULL,
  ADD COLUMN route        geography(LineString,4326) NULL,
  ADD COLUMN route_source text NOT NULL DEFAULT 'STRAIGHT_LINE'
    CHECK (route_source IN ('OSRM','STRAIGHT_LINE'));
```

Semantik kolom:

| Kolom | Arti |
|---|---|
| `distance_m` | Jarak **jalan** bila `route_source = 'OSRM'`; jarak garis lurus (`ST_Distance`) bila `STRAIGHT_LINE`. Baris lama otomatis `STRAIGHT_LINE` |
| `duration_s` | Durasi dari OSRM; `NULL` bila fallback |
| `route` | Rute dari OSRM; `NULL` bila fallback |
| `fee` | Hasil `FeeCalculator` pada saat order dibuat (snapshot) |

`down()` migrasi menghapus ketiga kolom. Tidak ada indeks baru (rute tidak dicari secara spasial).

**Query yang berubah (raw SQL, `ST_MakePoint(lng, lat)` tetap):**

```sql
-- insert (jarak, durasi, fee sudah dihitung di aplikasi)
INSERT INTO orders (customer_id, pickup, dropoff, distance_m, duration_s, route, route_source, fee)
VALUES ($1,
        ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,
        ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,
        $6, $7,
        CASE WHEN $8::text IS NULL THEN NULL
             ELSE ST_SetSRID(ST_GeomFromGeoJSON($8::text),4326)::geography END,
        $9, $10)
RETURNING id, …;

-- jarak garis lurus untuk fallback (repository.straightLineDistance)
SELECT ROUND(ST_Distance(
  ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,
  ST_SetSRID(ST_MakePoint($3,$4),4326)::geography))::int AS distance_m;

-- baca detail (route sebagai GeoJSON); query daftar TIDAK memuat kolom route
SELECT …, duration_s, route_source, ST_AsGeoJSON(route)::json AS route FROM orders WHERE id = $1;
```

## 5. REST API (mengubah TSD §5)

| Method | Path | Role | Body | Sukses | Error |
|---|---|---|---|---|---|
| POST | `/orders/estimate` | CUSTOMER | `{pickup:{lat,lng},dropoff:{lat,lng}}` | 200 `OrderEstimate` | 400, 401, 403 |
| POST | `/orders` | CUSTOMER | sama seperti sebelumnya | 201 `Order` (kini dengan `durationS`, `routeSource`, `route`) | 400, 403 |
| GET | `/orders` | any | – | 200 `Order[]` **tanpa** `route` | 401 |
| GET | `/orders/:id` | any | – | 200 `Order` dengan `route` | 403, 404 |
| POST | `/auth/login` | public | `{email,password}` | 200 `{accessToken}` dan header `Set-Cookie` (§17) | 400, 401 |
| POST | `/auth/logout` | public | – | 204 dan `Set-Cookie` yang menghapus cookie | – |

Endpoint lain tidak berubah, selain cara autentikasinya (§17). `estimate` memakai `200` (tidak membuat resource). Kegagalan OSRM **bukan** error API (fallback); 503 hanya muncul jika Gateway tak bisa menjangkau Order.

**Contoh respons `POST /orders/estimate`**

```json
{
  "distanceM": 2105,
  "durationS": 312,
  "fee": 10500,
  "routeSource": "OSRM",
  "route": { "type": "LineString", "coordinates": [[107.6098, -6.9147], [107.6102, -6.9139], [107.6186, -6.9034]] }
}
```

**Contoh respons saat fallback**

```json
{ "distanceM": 1590, "durationS": null, "fee": 10000, "routeSource": "STRAIGHT_LINE", "route": null }
```

**`Order` (perubahan field)**

```json
{
  "id": "…", "status": "DRIVER_ASSIGNED", "driverId": "…",
  "distanceM": 2105, "durationS": 312, "fee": 10500,
  "routeSource": "OSRM",
  "route": { "type": "LineString", "coordinates": [[107.6098, -6.9147]] }
}
```

`route` bertipe GeoJSON `LineString` dengan koordinat `[lng, lat]`. Pada daftar order, field `route` tidak ada.

**DTO baru/berubah (`libs/common/src/dto`)**: `OrderEstimateDto`, `RouteGeometryDto`, dan `OrderDto` (ditambah `durationS?`, `routeSource`, `route?`). Semua memakai `@ApiProperty({ example })`; `EstimateOrderDto` boleh memakai ulang validasi `CreateOrderDto`.

## 6. Kontrak OSRM

**Request**

```
GET {OSRM_URL}/route/v1/{OSRM_PROFILE}/{pickupLng},{pickupLat};{dropoffLng},{dropoffLat}
    ?overview=full&geometries=geojson&steps=false&alternatives=false
Headers: Accept: application/json
         User-Agent: on-demand-delivery-tracking/1.1 (+kontak)
```

Urutan koordinat OSRM adalah `lng,lat`, sama dengan PostGIS. `User-Agent` yang jelas diwajibkan kebijakan server demo.

**Respons (field yang dipakai)**

```json
{ "code": "Ok",
  "routes": [{ "distance": 2105.3, "duration": 312.4,
               "geometry": { "type": "LineString", "coordinates": [[107.6098,-6.9147]] } }] }
```

**Pemetaan hasil**

| Kondisi | Perlakuan |
|---|---|
| HTTP 200 dan `code = "Ok"` dan `routes[0]` valid (≥2 titik) | `distanceM = round(distance)`, `durationS = round(duration)`, `geometry` apa adanya, `routeSource = OSRM` |
| `code` = `NoRoute`, `NoSegment`, atau kode lain | Fallback; log `warn` dengan kode |
| HTTP non-200, JSON rusak, geometri tak valid | Fallback; log `warn` |
| Timeout (`OSRM_TIMEOUT_MS`, default 3000) atau error jaringan | Fallback; log `warn` |

`OsrmClient.route()` mengembalikan `RouteResult | null` dan **tidak pernah melempar**. `RoutingService` memanggilnya dan, bila `null`, memakai `straightLineDistance()`.

**Opsional [N]:** karena batas ±1 request/detik di server demo, aktifkan (a) cache estimasi di memori dengan kunci koordinat dibulatkan ke 5 desimal dan TTL ±60 detik, dan (b) antrian yang menjaga jeda minimal 1 detik antar panggilan saat `OSRM_URL` mengarah ke server demo.

## 7. Rumus Tarif

Fungsi murni `calculateFee(distanceM, config)`:

```
perKm   = round(FEE_PER_KM × distanceM / 1000)
raw     = FEE_BASE + perKm
rounded = ceil(raw / FEE_ROUND) × FEE_ROUND
fee     = max(FEE_MIN, rounded)
```

Semua bilangan bulat rupiah. Default latihan: `FEE_BASE=5000`, `FEE_PER_KM=2500`, `FEE_MIN=10000`, `FEE_ROUND=500`.

**Vektor uji (wajib jadi unit test)**

| `distanceM` | perKm | raw | rounded | **fee** |
|---|---|---|---|---|
| 500 | 1250 | 6250 | 6500 | **10000** (minimum) |
| 1650 | 4125 | 9125 | 9500 | **10000** (minimum) |
| 2000 | 5000 | 10000 | 10000 | **10000** |
| 2001 | 5003 | 10003 | 10500 | **10500** |
| 2105 | 5263 | 10263 | 10500 | **10500** |
| 5000 | 12500 | 17500 | 17500 | **17500** |
| 10000 | 25000 | 30000 | 30000 | **30000** |

`FLAT_FEE` dihapus; perannya digantikan `FEE_MIN`. `FeeCalculator` menolak `distanceM <= 0`.

## 8. TCP Message Patterns (menambah TSD §9)

| Service | Pattern | Payload | Respons |
|---|---|---|---|
| Order | `order.estimate` | `{pickup,dropoff}` | `OrderEstimateDto` |

`order.create` dan `order.get` kini mengembalikan `OrderDto` dengan field rute (lihat §5). `order.list` tanpa `route`. Konstanta pattern ditambahkan di `libs/common/constants` (AGENTS #4).

## 9. Validasi dan Error (mengubah TSD §11)

| Code | HTTP | Arti |
|---|---|---|
| `OUT_OF_SERVICE_AREA` | 400 | pickup/dropoff di luar `SERVICE_AREA_BBOX` |
| `CSRF_HEADER_REQUIRED` | 403 | request tidak aman yang diautentikasi lewat cookie tanpa header `X-Requested-With: XMLHttpRequest` |

Aturan validasi tambahan di Order (sebelum memanggil OSRM):

- Koordinat valid (lat −90..90, lng −180..180) sudah dijaga DTO.
- Bila `SERVICE_AREA_BBOX` diisi (`minLng,minLat,maxLng,maxLat`), kedua titik harus berada di dalamnya; selain itu `OUT_OF_SERVICE_AREA`.
- Jarak garis lurus pickup↔dropoff harus ≥ 50 m; selain itu `VALIDATION_ERROR` (mencegah rute degeneratif).

Filter RPC→HTTP di `libs/common` ditambah pemetaan `OUT_OF_SERVICE_AREA → 400`.

## 10. Environment Variable (mengubah TSD §12)

```
# umum / gateway
CORS_ORIGINS=http://localhost:5173
# gateway: cookie sesi (lihat §17)
AUTH_COOKIE_NAME=access_token
# true bila Gateway dilayani lewat HTTPS
COOKIE_SECURE=false
# lax | strict | none (none mewajibkan COOKIE_SECURE=true)
COOKIE_SAMESITE=lax
# order
OSRM_URL=https://router.project-osrm.org
OSRM_PROFILE=driving
OSRM_TIMEOUT_MS=3000
FEE_BASE=5000
FEE_PER_KM=2500
FEE_MIN=10000
FEE_ROUND=500
SERVICE_AREA_BBOX=
# infra osrm (compose)
OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:<versi-dipin>
OSRM_DATA_NAME=java-latest
```

Hapus `FLAT_FEE`. `SERVICE_AREA_BBOX` kosong berarti tanpa pembatasan. Untuk self-host: `OSRM_URL=http://localhost:5001`. Frontend (`web/.env`):

```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=© OpenStreetMap contributors | Rute: OSRM
VITE_DEFAULT_CENTER=-6.9147,107.6098
VITE_DEFAULT_ZOOM=14
```

Nilai env dibaca sebagai string: bungkus dengan `Number(...)`.

Frontend, Gateway, dan alamat yang diketik di browser harus memakai host yang sama (`localhost`), bukan campuran `localhost` dan `127.0.0.1`, agar cookie `SameSite=Lax` ikut terkirim. `VITE_API_URL` dan `VITE_WS_URL` tidak membawa kredensial; autentikasi hanya lewat cookie.

## 11. CORS dan WebSocket (mengubah TSD §7)

- **HTTP:** di `apps/gateway/src/main.ts`, `app.use(cookieParser())` dan `app.enableCors({ origin: corsOrigins, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] })` dengan `corsOrigins = CORS_ORIGINS.split(',')`. Karena `credentials: true`, `origin` tidak boleh `*`; Gateway menolak start bila `CORS_ORIGINS` kosong atau berisi `*`.
- **Socket.IO:** `origin: '*'` pada dekorator `@WebSocketGateway` tidak boleh dipertahankan. Env kemungkinan belum termuat saat dekorator dievaluasi, jadi atur origin lewat adapter di `main.ts`:

```ts
class CorsIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: corsOrigins, credentials: true } });
  }
}
app.useWebSocketAdapter(new CorsIoAdapter(app));
```

- Nama dan payload event WebSocket **tidak berubah**; autentikasi handshake berubah (§17.4). Opsional [B]: ack `order:subscribe` ditambah `lastLocation?: {lat,lng,ts}`.

## 12. Infrastruktur OSRM

**Penyiapan data (sekali, lalu diulang bila ingin menyegarkan)** — `scripts/osrm-setup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
IMAGE="${OSRM_IMAGE:?isi OSRM_IMAGE dengan image yang dipin}"
URL="${OSRM_PBF_URL:-https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf}"
NAME="$(basename "$URL" .osm.pbf)"
mkdir -p osrm-data
[ -f "osrm-data/$NAME.osm.pbf" ] || curl -L -o "osrm-data/$NAME.osm.pbf" "$URL"
run() { docker run --rm -t -v "$PWD/osrm-data:/data" "$IMAGE" "$@"; }
run osrm-extract -p /opt/car.lua "/data/$NAME.osm.pbf"
run osrm-partition "/data/$NAME.osrm"
run osrm-customize "/data/$NAME.osrm"
```

Periksa URL dan nama image/perintah terbaru di situs Geofabrik dan README OSRM sebelum memakainya. Bila `osrm-extract` terlalu berat, potong wilayah dahulu: `osmium extract -b minLng,minLat,maxLng,maxLat java-latest.osm.pbf -o kota.osm.pbf`, lalu set `OSRM_PBF_URL` ke file itu dan `OSRM_DATA_NAME=kota`.

**Service di `docker-compose.yml`:**

```yaml
  osrm:
    image: ${OSRM_IMAGE}
    command: osrm-routed --algorithm mld /data/${OSRM_DATA_NAME:-java-latest}.osrm
    ports:
      - "127.0.0.1:5001:5000"
    volumes:
      - ./osrm-data:/data:ro
    restart: unless-stopped
    profiles: ["osrm"]
```

Jalankan dengan `docker compose --profile osrm up -d osrm`. Pin versi image; data yang dibangun dengan satu versi OSRM sebaiknya dilayani versi yang sama (bangun ulang saat naik versi). `osrm-data/` masuk `.gitignore` (data besar, bisa dibangun ulang, tidak perlu backup).

## 13. Spesifikasi Frontend

**Struktur `web/src`**

```
app/        router, providers (QueryClient, Auth, Socket)
features/   auth/ customer/ driver/ orders/ map/
components/ UI generik (Button, Badge, StatusStepper, Toast, ErrorBoundary)
lib/        api/ (schema.d.ts hasil generate + client), socket.ts, geo.ts, format.ts
```

**Tipe API:** skrip `bun run api:types` menjalankan `openapi-typescript http://localhost:3000/docs-json -o src/lib/api/schema.d.ts`. File hasil generate di-commit atau di-ignore secara konsisten (ditentukan di ADR-020). **Jangan** mengimpor DTO dari `libs/common` ke frontend. Payload WebSocket tidak ada di OpenAPI, jadi tipenya ditulis manual di `lib/socket.ts` mengikuti TSD §7.

**Helper koordinat (`lib/geo.ts`)** — satu-satunya tempat konversi:

| Fungsi | Perilaku |
|---|---|
| `toLeaflet({lat,lng})` | `[lat, lng]` |
| `geoJsonToLeaflet(coords)` | membalik tiap `[lng, lat]` menjadi `[lat, lng]` |
| `haversineM(a, b)` | jarak meter |
| `pointAlong(path, distanceM)` | titik pada polyline setelah menempuh jarak tertentu (untuk simulator) |

**Sesi:** token tidak pernah disimpan atau dibaca JavaScript (dilarang `localStorage`, `sessionStorage`, dan `document.cookie`). Status login ditentukan oleh `GET /auth/me` (query TanStack `['me']`); `401` dari API membersihkan cache sesi dan mengarahkan ke login. Semua panggilan API memakai `credentials: 'include'` dan header `X-Requested-With: XMLHttpRequest`. Koneksi socket dibuat setelah `me` sukses dengan `withCredentials: true` dan `transports: ['websocket']` (tanpa `auth.token`), dan diputus saat logout.

**Peta:** `leaflet@1.9`; ikon marker default sering gagal dimuat oleh bundler, jadi gunakan ikon yang diimpor eksplisit atau `divIcon`. Atribusi dari `VITE_MAP_ATTRIBUTION` wajib tampil.

**Format tampilan:** rupiah `Intl.NumberFormat('id-ID')` (mis. `Rp 10.500`), jarak dalam km 1 desimal, durasi dalam menit dibulatkan ke atas.

**Skrip (`web/package.json`):** `dev`, `build`, `preview`, `lint`, `test`, `api:types`. Skrip root: `web:dev`, `web:build`, `osrm:setup`.

## 14. Konfigurasi Root yang Harus Menyesuaikan

- `vitest.config.ts` (root): tambahkan `exclude: ['web/**', …]` agar tes `web/` tidak ikut `bun run test` root. `web/` punya `vitest.config.ts` sendiri (jsdom).
- `tsconfig.json`/`tsconfig.build.json` (root): `exclude` ditambah `web`.
- `.oxlintrc.json`/skrip lint root: abaikan `web/**`; `web/` punya skrip lint sendiri.
- `.gitignore`: `osrm-data/`, `web/node_modules`, `web/dist`.
- `.prettierignore`: `osrm-data/`, `web/dist`.

## 15. Spesifikasi Pengujian

**Unit (backend)**
- `FeeCalculator`: seluruh vektor §7, plus `distanceM <= 0` ditolak.
- `OsrmClient` (HTTP di-mock): sukses, `NoRoute`, non-200, JSON rusak, geometri <2 titik, timeout → semuanya menghasilkan `RouteResult` atau `null` tanpa melempar.
- `RoutingService`: OSRM sukses memakai nilai OSRM; OSRM `null` memanggil `straightLineDistance` dan menandai `STRAIGHT_LINE`.
- `OrderServiceService`: `create` menyimpan jarak/durasi/rute/fee dan tetap memakai alur reserve; `estimate` tidak menyimpan apa pun; area layanan dan jarak minimum divalidasi.
- Sesi: `extractToken` (Bearer lebih dulu, lalu cookie), opsi cookie, `maxAgeFromJwt`, dan `JwtAuthGuard` (tabel sumber token × metode × header `X-Requested-With`).

**Integrasi (DB test)**
- Insert dengan GeoJSON lalu baca kembali `route` sebagai GeoJSON identik; `route` null tersimpan dengan benar; query daftar tidak memuat `route`.

**E2E sesi cookie (stack berjalan, `auth-cookie.e2e-spec.ts`)**
- Login: `Set-Cookie` memuat `HttpOnly`, `Path=/`, `SameSite=Lax`, `Max-Age`, dan tanpa `Domain`; `GET /auth/me` hanya dengan cookie → 200.
- `POST` dengan cookie tanpa `X-Requested-With` → 403 `CSRF_HEADER_REQUIRED`; dengan header → sukses; dengan `Authorization: Bearer` tanpa header itu → sukses.
- Logout: `Set-Cookie` kedaluwarsa; `GET /auth/me` tanpa cookie → 401.
- Preflight (`OPTIONS`) dari origin terdaftar menjawab `Access-Control-Allow-Credentials: true` dan origin yang sama persis (bukan `*`); dari origin lain tanpa header CORS.
- WebSocket: handshake dengan cookie dan `Origin` terdaftar → terhubung; `Origin` tak terdaftar, tanpa cookie, atau token tidak valid → diputus; `auth.token` tanpa `Origin` (klien Node) → terhubung.

**Frontend**
- `geo.ts` (urutan koordinat, `pointAlong`), formatter, dan hook simulator (timer palsu).
- Komponen: panel estimasi (state loading/error/fallback), `StatusStepper`, guard rute per role, dan `AuthProvider` (loading/authenticated/anonymous; 401 → login).

**Manual (skenario demo)**
1. Customer memilih dua titik → estimasi muncul → pesan.
2. Driver (browser lain) online di dekat titik jemput → order masuk ke driver.
3. Driver menjalankan simulator → marker bergerak di layar customer.
4. Driver menekan "Sudah dijemput" lalu "Selesai" → status di customer berubah tanpa reload.
5. Matikan OSRM (atau salahkan `OSRM_URL`) → estimasi tetap muncul dengan banner garis lurus.
6. Putuskan jaringan socket → indikator offline muncul dan polling berjalan.
7. Login → muat ulang halaman → tetap login. Di DevTools: cookie `access_token` bertanda `HttpOnly`, `localStorage` dan `sessionStorage` kosong.
8. Logout → kembali ke login, `GET /auth/me` 401, dan koneksi socket terputus.

## 16. Perintah Baru (menambah TSD §13)

```
bun run osrm:setup                       # menyiapkan data OSRM (butuh OSRM_IMAGE)
docker compose --profile osrm up -d osrm # menyalakan OSRM self-host
cd web && bun install && bun run dev     # frontend di http://localhost:5173
cd web && bun run api:types              # generate tipe dari Swagger Gateway (Gateway harus jalan)
```

## 17. Sesi Cookie HttpOnly (mengubah TSD §5 dan §7 asli)

### 17.1 Keputusan

Token JWT dari Auth Service dikirim ke browser sebagai cookie `HttpOnly` yang **di-set oleh Gateway** (header `Set-Cookie`), bukan disimpan oleh JavaScript. Cookie yang di-set lewat `document.cookie` tidak memberi perlindungan XSS karena skripnya bisa membacanya kembali; karena itu cookie harus berasal dari server. Alasan, alternatif yang ditolak, dan konsekuensinya ada di ADR-022.

### 17.2 Atribut cookie

| Atribut | Nilai | Catatan |
|---|---|---|
| Nama | `AUTH_COOKIE_NAME` (default `access_token`) | |
| `HttpOnly` | selalu | tidak terbaca JavaScript |
| `Path` | `/` | agar ikut pada REST dan handshake WebSocket |
| `SameSite` | `COOKIE_SAMESITE` (default `lax`) | `none` hanya untuk domain berbeda dan mewajibkan `Secure` |
| `Secure` | `COOKIE_SECURE` (default `false`) | aktifkan bila Gateway dilayani lewat HTTPS |
| `Domain` | tidak diset | cookie terikat ke host Gateway saja |
| `Max-Age` | selisih klaim `exp` JWT dan sekarang | satu sumber kebenaran: masa berlaku JWT |

`Max-Age` dihitung dari payload token (tanpa verifikasi ulang, karena baru diterbitkan Auth):

```ts
export function maxAgeFromJwt(token: string, nowMs = Date.now()): number {
  const payload = token.split('.')[1] ?? '';
  const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
  return exp ? Math.max(0, exp * 1000 - nowMs) : 0; // Express `maxAge` dalam milidetik
}
```

Satu helper, `apps/gateway/src/session/auth-cookie.ts`, menyediakan `cookieOptions()`, `setAuthCookie(res, token)`, dan `clearAuthCookie(res)`. `clearCookie` wajib memakai atribut `path`, `sameSite`, `secure` yang sama dengan saat set; kalau tidak, browser tidak menghapusnya. Nilai cookie tidak boleh pernah di-log.

### 17.3 Ekstraksi token dan guard

`extractToken(req)` di `apps/gateway/src/session/token-source.ts` mengembalikan `{ token, source: 'header' | 'cookie' } | null`: header `Authorization: Bearer` lebih dulu, lalu cookie (`req.cookies[AUTH_COOKIE_NAME]`). `JwtAuthGuard` memakainya dan menerapkan pertahanan CSRF hanya bila `source === 'cookie'`:

```ts
const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
if (found.source === 'cookie' && unsafe && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
  throw new ForbiddenException({ code: 'CSRF_HEADER_REQUIRED', message: 'Header X-Requested-With wajib' });
}
```

Lapisan pertahanan CSRF: (1) `SameSite=Lax` mencegah browser mengirim cookie pada POST/PATCH lintas-situs; (2) CORS allowlist ber-kredensial; (3) header kustom `X-Requested-With` memaksa preflight untuk request lintas-origin, yang ditolak oleh allowlist. Endpoint publik (`login`, `logout`, `register`) tidak memakai guard dan tidak terkena aturan ini.

### 17.4 Autentikasi handshake WebSocket

Di `TrackingGateway.handleConnection`:

1. Token diambil dari `client.handshake.auth.token` (klien non-browser) atau, bila tidak ada, dari cookie pada `client.handshake.headers.cookie` (di-parse dengan paket `cookie`).
2. **Jalur cookie wajib memeriksa `Origin`**: `client.handshake.headers.origin` harus ada dalam `CORS_ORIGINS`, kalau tidak koneksi diputus. Pemeriksaan ini perlu karena opsi `cors` Socket.IO hanya mengatur header respons: server tetap menerima handshake dari origin mana pun, dan browser tidak menerapkan CORS pada transport WebSocket. Tanpa pemeriksaan ini situs lain bisa membuka koneksi memakai cookie korban (cross-site WebSocket hijacking).
3. Token divalidasi lewat TCP `auth.validate_token` seperti sebelumnya; gagal → `client.disconnect(true)`.

Klien browser memakai `io(VITE_WS_URL, { withCredentials: true, transports: ['websocket'] })`. `transports: ['websocket']` memastikan header `Origin` selalu terkirim (permintaan polling same-origin bisa tanpa `Origin`).

### 17.5 Logout

`POST /auth/logout` (publik, `204`) memanggil `clearAuthCookie`. Karena JWT stateless, logout tidak mencabut token di server. Frontend: panggil logout, kosongkan cache TanStack Query, putuskan socket, arahkan ke login.

### 17.6 Swagger

Tambahkan `addCookieAuth(AUTH_COOKIE_NAME)` di samping `addBearerAuth()`. Untuk mencoba endpoint di `/docs`, gunakan **Authorize (Bearer)**: request berbasis cookie dari Swagger akan ditolak `CSRF_HEADER_REQUIRED` karena Swagger tidak mengirim `X-Requested-With`. Dokumentasikan header `Set-Cookie` pada respons `login` dan `logout`.

### 17.7 Kompatibilitas

- `seed-drivers.ts`, `demo:ws`, Postman, dan seluruh e2e v1.0 memakai Bearer dan `auth.token`, jadi **tidak berubah** dan harus tetap hijau (regresi wajib).
- Body respons `login` tetap memuat `accessToken` untuk klien non-browser. Frontend **tidak boleh** membaca atau menyimpannya.

### 17.8 Pemetaan file

| File | Isi |
|---|---|
| `apps/gateway/src/session/auth-cookie.ts` (+ `.spec.ts`) | opsi cookie, `setAuthCookie`, `clearAuthCookie`, `maxAgeFromJwt` |
| `apps/gateway/src/session/token-source.ts` (+ `.spec.ts`) | `extractToken` |
| `apps/gateway/src/guards/jwt-auth.guard.ts` | memakai `extractToken` dan aturan CSRF |
| `apps/gateway/src/auth.controller.ts` | `login` mengatur cookie, `logout` baru |
| `apps/gateway/src/main.ts` | `cookieParser`, CORS ber-kredensial, validasi `CORS_ORIGINS`, adapter Socket.IO |
| `apps/gateway/src/tracking.gateway.ts` | token dari cookie, pemeriksaan `Origin` |
| `apps/gateway/src/auth-cookie.e2e-spec.ts` | e2e sesi cookie (§15) |
