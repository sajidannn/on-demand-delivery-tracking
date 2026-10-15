# Perubahan Dokumen Lama (v1.1 & v1.2)

Dokumen ini mendata pembaruan, penyesuaian, dan pembatalan ketentuan pada dokumen v1.0 asli (`docs/01-prd.md` sampai `docs/05-adr.md`) akibat penambahan fitur pada v1.1 (Web UI, OSRM Routing, dan Autentikasi Cookie) serta v1.2 (Riwayat Status Atomik CTE, Pembatalan Pesanan, dan Perapian).

---

## 1. Perubahan terhadap PRD (`docs/01-prd.md`)

| Bagian Asli | Ketentuan Lama (v1.0) | Ketentuan Baru (v1.1 & v1.2) | Alasan & Rujukan |
|---|---|---|---|
| **§3 Scope** | Hanya backend microservice tanpa UI (hanya curl/CLI/Swagger). | Ditambahkan Web App Single-Page Application (`web/`) untuk Customer & Driver berbasis React + Vite + Leaflet + Tailwind CSS. | PRD v1.1 §1, ADR-017 |
| **§3 Scope & Estimasi** | Tarif flat / jarak garis lurus sederhana. | Rute jalan riil OSRM (`/route/v1/driving`) dengan kalkulasi jarak dinamis, durasi, dan fallback garis lurus jika OSRM timeout/down. | PRD v1.1 §4, TSD v1.1 §3 |
| **§3.1 Fitur Order** | Status order: `PENDING → DRIVER_ASSIGNED → PICKED_UP → COMPLETED` (atau `NO_DRIVER_AVAILABLE`). | Ditambahkan status `CANCELLED`. Customer dapat membatalkan pesanan pada status `PENDING` atau `DRIVER_ASSIGNED` via `POST /orders/:id/cancel`. Driver ter-assign otomatis dilepas. | PRD v1.2 §5, ADR-023 |
| **§3.4 Tracking** | Token Bearer dilewatkan di Authorization header dan WebSocket handshake query. | Sesi Web menggunakan cookie HttpOnly `access_token` (`SameSite=Lax`, CORS credentials, CSRF header `X-Requested-With`). Handshake WebSocket membaca cookie dari header. Bearer token tetap didukung untuk backward compatibility API/CLI. | ADR-022 |

---

## 2. Perubahan terhadap SDD (`docs/02-sdd.md`)

| Bagian Asli | Ketentuan Lama (v1.0) | Ketentuan Baru (v1.1 & v1.2) | Alasan & Rujukan |
|---|---|---|---|
| **§2 Diagram Arsitektur** | Klien hanya digambarkan sebagai REST/WS client generik. | Diagram arsitektur memuat komponen `web/` (Customer UI & Driver UI pada port 5173 / reverse proxy) serta layanan eksternal OSRM HTTP Engine. | SDD v1.1 §2 |
| **§4.3 Order Database** | Tabel `orders` hanya menyimpan titik jemput dan tujuan (`pickup`, `dropoff` Point). | Tabel `orders` ditambah kolom: `route` (`geography(LineString,4326)`), `route_source` (`order_route_source` ENUM: `'OSRM' \| 'STRAIGHT_LINE'`), dan `duration_s` (`integer`). | SDD v1.1 §3 |
| **§4.3 Audit Database** | Riwayat status hanya ada di event stream log RabbitMQ. | Ditambahkan tabel fisik `order_status_history` di `order_db` yang dicatat secara atomik bersamaan dengan mutasi `orders` via Common Table Expression (CTE). | SDD v1.2 §4, ADR-023 |
| **§5 Keamanan** | Stateless JWT lewat header `Authorization: Bearer <token>`. | Mode dual-auth: Gateway mendukung cookie HttpOnly untuk browser dan header `Authorization` untuk API/curl. Request mutasi cookie dilindungi CSRF guard. | ADR-022 |

---

## 3. Perubahan terhadap TSD (`docs/03-tsd.md`)

| Bagian Asli | Ketentuan Lama (v1.0) | Ketentuan Baru (v1.1 & v1.2) | Alasan & Rujukan |
|---|---|---|---|
| **§4.1 Auth Endpoints** | `POST /auth/login` hanya mengembalikan body `{ accessToken }`. | `POST /auth/login` mengembalikan body `{ accessToken }` dan menetapkan cookie `Set-Cookie: access_token=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=...`. Ditambahkan `POST /auth/logout` (clear cookie) dan `GET /auth/me`. | TSD v1.1 §2, ADR-022 |
| **§4.2 Order Endpoints** | Hanya `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`. | Ditambahkan: <br>1. `POST /orders/estimate` (estimasi jarak, ongkir, dan rute OSRM). <br>2. `POST /orders/:id/cancel` (pembatalan oleh customer pemilik). <br>3. `GET /orders/:id` diperkaya dengan array `history: [{ status, at, actor }]` (sedangkan `GET /orders` list tidak memuat history). | TSD v1.1 §3, TSD v1.2 §4.6 |
| **§5 Model Database** | ENUM `order_status` bernilai: `PENDING`, `DRIVER_ASSIGNED`, `PICKED_UP`, `COMPLETED`, `NO_DRIVER_AVAILABLE`. | ENUM `order_status` ditambah nilai: `CANCELLED`. | TSD v1.2 §5 |
| **§6 Event & WebSocket** | Event `order.*` dan WebSocket payload `order:status` tidak menyertakan timestamp waktu pasti database. | Semua event `order.created`, `order.driver_assigned`, `order.status_changed`, serta WebSocket payload `order:status` memuat properti `at: string` (ISO-8601 UTC) yang bersumber dari `occurred_at` CTE database. | TSD v1.2 §4.5, ADR-023 |
| **§8 Validasi Jarak** | Validasi jarak hanya saat insert order via spatial query database. | Pre-validasi jarak minimum 50 meter dieksekusi di memori via formula Haversine sebelum memanggil OSRM untuk menghemat kuota dan latensi jaringan. | v1.2 Butir A3 |

---

## 4. Perubahan terhadap Implementation Plan (`docs/04-implementation-plan.md`)

| Bagian Asli | Status & Perubahan |
|---|---|
| **Fase 1–6 (v1.0)** | Selesai dan seluruh acceptance criteria AC-01 sampai AC-24 terpenuhi. |
| **Fase Tambahan (v1.1)** | Dituangkan di `docs/09-implementation-plan-v1.1-ui-routing.md` mencakup setup frontend `web/`, routing OSRM, cookie session, dan integrasi Leaflet map. |
| **Fase Penyempurnaan (v1.2)** | Dituangkan di `docs/v1.2-rencana-penyempurnaan.md` mencakup penutupan utang v1.1, pencatatan riwayat atomik CTE (AC-25 sampai AC-29), dan pembatalan order (AC-30 sampai AC-32). |

---

## 5. Ringkasan ADR Tambahan (`docs/05-adr.md` & `docs/ADR-022-*.md`)

- **ADR-016 s/d ADR-021:** Arsitektur UI, integrasi OSRM, fallback routing, dan state management web.
- **ADR-022:** Sesi browser via cookie HttpOnly dengan perlindungan CSRF.
- **ADR-023:** Riwayat status ditulis dalam statement yang sama dengan perubahan status via CTE (`order_status_history`).
- **ADR-024:** Email notifikasi via Nodemailer di Notification Service (fallback Ethereal dev sandbox).
