# PRD — on-demand-delivery-tracking (On-Demand Delivery & Fleet Tracking)

> Proyek latihan. Target selesai: ±7 hari. Bukan untuk produksi.

## 1. Ringkasan
Mini sistem kurir/ojek instan (ala Gojek/Lalamove). Customer membuat order antar barang, sistem otomatis memilih driver terdekat, customer bisa melihat posisi driver secara real-time.

## 2. Tujuan
**Tujuan belajar (prioritas utama)**
1. Memahami arsitektur microservice di NestJS: TCP, gRPC, RabbitMQ (event-driven), hybrid app.
2. Memahami PostGIS: tipe `geography`, index GiST, `ST_DWithin`, KNN `<->`, `ST_Distance`.
3. Mencoba dua ORM dalam satu sistem (Prisma & TypeORM) dan memahami batas antar service.
4. Mendokumentasikan API dengan Swagger.

**Tujuan produk**
Alur order → assign driver → antar → selesai berjalan end-to-end secara lokal.

## 3. Aktor
| Aktor | Deskripsi |
|---|---|
| Customer | Membuat order dan memantau posisi driver |
| Driver | Online/offline, mengirim lokasi, memperbarui status order |

## 4. User Story
| ID | Sebagai | Saya ingin | Agar |
|---|---|---|---|
| US-01 | User | register dan login | bisa memakai sistem sesuai role |
| US-02 | Customer | membuat order (titik jemput & tujuan) | barang saya diantar |
| US-03 | Customer | melihat detail dan riwayat order | tahu status pesanan |
| US-04 | Driver | menyatakan online/offline dengan lokasi awal | bisa menerima order |
| US-05 | Driver | mengirim lokasi GPS berkala | posisi saya terlacak |
| US-06 | Sistem | memilih driver terdekat otomatis | order cepat mendapat driver |
| US-07 | Driver | mengubah status `PICKED_UP` → `COMPLETED` | progres order tercatat |
| US-08 | Customer | melihat posisi driver real-time | tahu kapan barang tiba |
| US-09 | Customer/Driver | menerima notifikasi perubahan status | tidak perlu refresh manual |

## 5. Scope
**In scope:** auth + role, order lifecycle, auto-assign driver terdekat, tracking real-time via WebSocket, notifikasi (log), Swagger.

**Out of scope (dilarang ditambahkan tanpa persetujuan):** pembayaran, tarif dinamis (pakai flat), refresh token, rating, chat, admin panel, retry saat driver menolak, Redis, Dockerfile per service, health check, peta/UI frontend.

**Opsional (kalau sisa waktu):** geofence arrival (`ST_DWithin` 50 m ke titik jemput), location history + rute (`ST_MakeLine`), e2e test tambahan.

## 6. Acceptance Criteria
- AC-01: Register/login mengembalikan JWT; endpoint terlindungi menolak tanpa token (401) dan role salah (403).
- AC-02: `POST /orders` oleh customer menghasilkan order `PENDING`, lalu otomatis `DRIVER_ASSIGNED` bila ada driver online dalam radius; jika tidak ada → `NO_DRIVER_AVAILABLE`.
- AC-03: Driver yang di-assign adalah driver **available terdekat** (terbukti dengan data uji ≥3 driver).
- AC-04: Transisi status hanya sesuai state machine (lihat TSD §8); transisi ilegal ditolak (409).
- AC-05: Hanya driver yang di-assign yang bisa mengubah status order tsb.
- AC-06: Setiap perubahan status memunculkan event dan tercatat di log Notification Service.
- AC-07: Customer yang subscribe ke `order:{id}` menerima `order:location` saat driver mengirim ping.
- AC-08: Semua endpoint Gateway muncul di Swagger (`/docs`) lengkap dengan contoh request/response.
- AC-09: Satu driver tidak boleh menerima dua order aktif sekaligus (kunci driver pada satu pesanan).
- AC-10: Driver akan kembali berstatus dapat menerima pesanan setelah status order menjadi `COMPLETED`.

## 7. Definition of Done (proyek)
- `docker compose up -d` + satu perintah start menjalankan semua service.
- Semua AC di atas lolos (manual atau e2e).
- 1 e2e test untuk alur order utama.
- README berisi cara menjalankan dan skenario uji.
- Semua dokumen di `docs/` mutakhir.

## 8. Asumsi
- Satu mesin lokal, tanpa autentikasi antar-service.
- Koordinat selalu valid WGS84 (SRID 4326); urutan **lng, lat** di PostGIS.
- Tarif flat (konfigurasi), jarak dihitung dengan PostGIS.
