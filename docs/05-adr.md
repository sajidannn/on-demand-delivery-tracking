# ADR — Architecture Decision Records

Format: Konteks → Keputusan → Konsekuensi. Status semua: **Accepted**. Jangan mengubah keputusan di sini tanpa menulis ADR baru.

---

## ADR-001 — Monorepo NestJS

**Konteks:** 5 service kecil, dikerjakan sendiri dalam seminggu.
**Keputusan:** Satu repo dengan NestJS monorepo mode, kode bersama di `libs/common`.
**Konsekuensi:** Setup dan berbagi kontrak mudah. Risiko: godaan berbagi entity ORM → dilarang (lihat ADR-004).

## ADR-002 — Transport dipilih per kebutuhan

**Konteks:** Tujuan belajar mencakup TCP, gRPC, dan event-driven.
**Keputusan:** Gateway↔Auth/Order: **TCP**. Order→Location: **gRPC**. Sisanya: **RabbitMQ**.
**Konsekuensi:** Sengaja bukan pilihan paling sederhana; nilainya ada di pembelajaran. Ada tiga jenis konfigurasi yang harus dipahami.

## ADR-003 — PostGIS untuk lokasi (bukan Redis GEO)

**Konteks:** Tujuan belajar mencakup PostGIS; Redis GEO sebelumnya dipertimbangkan.
**Keputusan:** Simpan posisi driver di PostgreSQL + PostGIS (`geography(Point,4326)` + index GiST). Redis dihapus dari stack.
**Konsekuensi:** Infrastruktur lebih sedikit dan dapat memakai query spasial lengkap (`ST_DWithin`, KNN, `ST_Distance`). Tulis ping per driver ke DB lebih berat dari Redis, tapi memadai untuk skala latihan (satu baris per driver).

## ADR-004 — ORM berbeda per service

**Konteks:** Ingin mencoba Prisma dan TypeORM; setiap service punya database sendiri.
**Keputusan:** Auth → **Prisma** (tanpa data spasial). Order & Location → **TypeORM**, query spasial memakai raw SQL. Entity/model tidak pernah masuk `libs/common`; kontrak antar-service hanya DTO/proto/event.
**Konsekuensi:** Dua tooling migrasi (`prisma migrate` dan migrasi TypeORM/SQL) dan generated client Prisma perlu `output` custom. Fallback: Auth pindah ke TypeORM bila terlalu memakan waktu.

## ADR-005 — Swagger hanya di Gateway

**Konteks:** Hanya Gateway yang punya API HTTP publik; service lain memakai TCP/gRPC/RMQ.
**Keputusan:** `@nestjs/swagger` dipasang di Gateway (`/docs`). DTO ber-`@ApiProperty` di `libs/common/dto`. WebSocket didokumentasikan manual di TSD.
**Konsekuensi:** Dokumentasi API terpusat. DTO bersama menanggung dependensi ke `@nestjs/swagger`. Dekorator boleh dibuat dengan bantuan AI namun wajib diverifikasi terhadap TSD.

## ADR-006 — Fan-out event dengan beberapa queue

**Konteks:** Transport RMQ NestJS mengirim ke satu queue; banyak consumer di queue yang sama berbagi pesan, bukan semuanya menerima.
**Keputusan:** Event yang dibutuhkan banyak consumer di-emit ke queue masing-masing (`notification_queue`, `gateway_queue`) lewat dua `ClientProxy`. Tidak memakai exchange fanout/topic kustom.
**Konsekuensi:** Sederhana dan idiomatis Nest, tetapi publisher perlu tahu daftar tujuan. Migrasi ke exchange topic bisa dilakukan nanti.

## ADR-007 — Ping lokasi lewat WebSocket → RMQ

**Konteks:** Ping GPS frekuensi tinggi, tidak butuh respons.
**Keputusan:** Driver kirim via WebSocket ke Gateway; Gateway emit `driver.location_updated` ke Location dan meneruskan langsung ke room order bila `orderId` ada. Tidak memakai gRPC streaming.
**Konsekuensi:** Sederhana dan latensi ke customer rendah. Tidak ada jaminan urutan/idempotensi (di luar scope).

## ADR-008 — Tanpa Redis, Dockerfile per service, dan health check

**Konteks:** Target satu minggu, hindari over-engineering.
**Keputusan:** Semua service dijalankan langsung dengan `bun run start:dev`; hanya infrastruktur (postgis, rabbitmq) yang di-Docker.
**Konsekuensi:** Setup cepat. Bukan siap-produksi; boleh ditambah setelah proyek selesai.

---

## ADR-009 — Bun, ESM, dan Vitest

**Konteks:** Scaffold `nest new` dipilih dengan package manager Bun dan module system ESM + Vitest.
**Keputusan:** Bun sebagai package manager dan pelari script (`bun run`); runtime aplikasi tetap Node.js LTS, kecuali untuk TypeORM migration yang dijalankan dengan `bun --bun typeorm` untuk mengabaikan batasan ts-node terkait ESM. Kode ditulis sebagai ESM. Unit dan e2e test memakai Vitest (+ supertest). Tidak memakai pnpm/npm/yarn maupun Jest.
**Konsekuensi:** Instalasi cepat dan konfigurasi test sesuai scaffold. Perlu diwaspadai: `bun test` bukan Vitest; Bun tidak menjalankan postinstall dependensi kecuali terdaftar di `trustedDependencies` (mis. `bcrypt`, `prisma`); ESM tidak punya `__dirname`/`require`, sehingga path proto dan output Prisma custom memakai `import.meta`; alias `@app/common` harus dikonfigurasi di tsconfig dan Vitest.

## ADR-010 — ts-proto dan grpc-tools

**Konteks:** Pembuatan file TypeScript dari definisi proto untuk gRPC Location Service.
**Keputusan:** Menggunakan `grpc_tools_node_protoc` dan plugin `ts-proto` dengan flag NestJS.
**Konsekuensi:** `ts-proto` menghasilkan tipe untuk memastikan tipe interface kuat, padahal Nest tetap memuat `.proto` lewat `@grpc/proto-loader` saat runtime.

## ADR-011 — Rspack Builder

**Konteks:** Kecepatan build monorepo.
**Keputusan:** Menggunakan Rspack sebagai builder NestJS (default dari CLI scaffold terbaru).
**Konsekuensi:** Build time jauh lebih cepat daripada webpack. Harus memantau issues terkait resolusi module gRPC/proto.

## ADR-012 — Oxlint

**Konteks:** Kebutuhan linter yang sangat cepat tanpa membebani CI/CD lokal.
**Keputusan:** Menggantikan ESLint dengan `oxlint` (via opsi cli nest) yang ditulis dalam Rust.
**Konsekuensi:** Lint instan (sub-detik). Harus secara manual menambah rule (seperti `typescript/no-explicit-any` diubah ke `warn`).

## ADR-013 — Reservasi driver atomik di Location

**Konteks:** Menghindari race condition saat dua order mencoba mencari dan mengunci driver yang sama secara bersamaan, serta memastikan satu driver hanya melayani satu order aktif.
**Keputusan:** Menambah kolom `current_order_id` pada `driver_locations`. Menggunakan `FOR UPDATE SKIP LOCKED` dalam satu statement SQL atomik untuk menemukan dan langsung mereservasi driver terdekat. Alternatif yang ditolak: mengubah `is_available`, karena ini harus murni mewakili niat (online/offline).
**Konsekuensi:** Lokasi punya dua operasi baru: reserve dan release. Order Service bertanggung jawab melepas driver (`ReleaseDriver`) ketika order sudah `COMPLETED` atau jika terjadi error setelah reservasi berhasil (kompensasi).
