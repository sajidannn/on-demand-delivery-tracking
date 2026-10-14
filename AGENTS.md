# AGENTS.md — on-demand-delivery-tracking

Proyek **latihan** (NestJS microservice + PostGIS), target ±7 hari. Prioritaskan yang sederhana dan jalan; jangan over-engineering. Dokumen ini adalah peta, detail ada di `docs/`.

## Baca dulu sebelum mengerjakan task

| Butuh                      | Baca                                       |
| -------------------------- | ------------------------------------------ |
| Fitur & batas scope        | `docs/01-prd.md` (v1.0) · `docs/06-prd-v1.1-ui-routing.md` (v1.1) · `docs/v1.2-rencana-penyempurnaan.md` (v1.2) |
| Arsitektur & alur          | `docs/02-sdd.md`                           |
| Kontrak API/DB/event/proto | `docs/03-tsd.md` (sumber kebenaran teknis) |
| Urutan & task              | `docs/04-implementation-plan.md` (v1.0) · `docs/09-implementation-plan-v1.1-ui-routing.md` (v1.1) |
| Alasan keputusan           | `docs/05-adr.md`                           |

Jika kode dan dokumen bertentangan, **tanyakan** atau perbarui dokumen bersama perubahannya; jangan diam-diam menyimpang.

## Stack singkat

NestJS monorepo · TypeScript (ESM) · Bun · Vitest · TCP + gRPC + RabbitMQ · PostgreSQL + PostGIS · Prisma (auth-service) · TypeORM + raw SQL (order, location) · Socket.IO · Swagger (gateway saja).

## Struktur

`apps/{gateway,auth-service,order-service,location-service,notification-service}` · `libs/common` · `docs/`.

## Perintah

```
docker compose up -d
bun install
bun run start:dev <app>
bun run db:migrate:auth | db:migrate:order | db:migrate:location
bun run lint
bun run test        # Vitest (unit)
bun run test:e2e    # Vitest (e2e)
```

Gunakan `bun run test`, **bukan** `bun test` (itu test runner bawaan Bun, bukan Vitest).

## Aturan wajib

1. **Batas service:** tidak boleh membaca DB service lain. Komunikasi hanya lewat TCP/gRPC/RMQ sesuai TSD.
2. **`libs/common`** hanya berisi DTO, enum, konstanta, interface event, proto, dan utils. **Dilarang** memasukkan entity/model Prisma/TypeORM.
3. **Spatial query** ditulis raw SQL dengan `geography(Point,4326)`. Urutan selalu `ST_MakePoint(lng, lat)`.
4. **Nama pattern/event/queue** hanya dari `libs/common/constants` dan `libs/common/events`; jangan hardcode string di service.
5. **Fan-out RMQ:** event untuk banyak consumer di-emit ke tiap queue tujuan (ADR-006).
6. **Validasi:** semua input Gateway lewat DTO + `class-validator`; `ValidationPipe` global (`whitelist`, `transform`).
7. **Error:** service memakai `RpcException({ code, message })` sesuai kode di TSD §11; Gateway menerjemahkan ke HTTP.
8. **Secret & konfigurasi** lewat `@nestjs/config` + `.env`; jangan commit `.env`.
9. **Swagger:** setiap endpoint Gateway wajib `@ApiTags`, `@ApiOperation`, `@ApiResponse` (sukses + error utama), `@ApiBearerAuth` bila terlindungi, dan DTO ber-`@ApiProperty({ example })`.
10. **Jangan menambah fitur di luar PRD §5**, tidak menambah dependensi besar (Redis, ORM lain, dll.) tanpa ADR baru.

## Aturan tambahan v1.1 (web app + cookie auth)

11. **`web/` terisolasi:** direktori `web/` tidak boleh mengimpor dari `libs/common`. Kontrak antar frontend–backend hanya lewat type yang di-generate dari OpenAPI (`bun run api:types`).
12. **Token hanya di cookie HttpOnly:** token JWT **dilarang** disimpan di `localStorage`, `sessionStorage`, maupun `document.cookie` dari JavaScript. Cookie hanya boleh dibuat oleh server lewat `apps/gateway/src/session/`. Verifikasi: `grep -rnE 'localStorage|sessionStorage|document\.cookie' web/src` harus kosong untuk hal yang berkaitan dengan auth token.
13. **`sessionStorage` boleh untuk data UI non-sensitif:** data tampilan seperti jejak rute di peta boleh disimpan di `sessionStorage` (karena bukan data auth dan hilang saat tab ditutup). Data ini bukan token dan tidak memiliki implikasi keamanan.
14. **CORS tanpa wildcard:** `origin: '*'` dilarang di seluruh konfigurasi gateway. Gateway gagal start bila `CORS_ORIGINS` kosong atau mengandung `*`.
15. **Konversi koordinat terpusat:** konversi antara format `{ lat, lng }` dan format GeoJSON/OSRM (`[lng, lat]`) hanya boleh dilakukan di `web/src/lib/geo.ts` (frontend) dan `OsrmClient` (backend). Jangan lakukan konversi inline di tempat lain.
16. **Cookie config fail-fast:** `validateCookieConfig()` dipanggil saat gateway boot. Nilai `COOKIE_SAMESITE` harus `lax`, `strict`, atau `none`. Jika `none`, maka `COOKIE_SECURE` harus `true`.
17. **CSRF protection:** request tidak aman (POST/PUT/PATCH/DELETE) yang diautentikasi lewat cookie wajib menyertakan header `X-Requested-With: XMLHttpRequest`, atau akan ditolak 403. Request dengan `Authorization: Bearer` tidak terkena aturan ini.

## Konvensi kode

- TypeScript strict; hindari `any`.
- Package manager **Bun** (`bun.lock`); jangan dicampur dengan pnpm/npm/yarn. Paket dengan postinstall native (mis. `bcrypt`, `prisma`) didaftarkan di `trustedDependencies`.
- Project **ESM**: tanpa `require`/`__dirname` (pakai `import.meta.dirname` atau `import.meta.url`); ikuti aturan ekstensi import dari tsconfig.
- Test memakai **Vitest** (`describe`, `it`, `expect`, `vi` dari `vitest`); tanpa Jest.
- File `kebab-case.ts`, class `PascalCase`, satu tanggung jawab per service/provider.
- Controller tipis; logika di service; akses data di repository.
- Log memakai `Logger` Nest dengan nama class; jangan `console.log` di kode akhir.
- Commit kecil dan bermakna, satu task satu commit bila memungkinkan.

## Definition of Done (per task)

- Kode compile, `bun run lint` bersih.
- Sesuai kontrak di TSD (path, payload, status code, error code).
- Ada unit test untuk logika non-trivial (mis. state machine) dan/atau bukti uji manual (curl/grpcurl/WS client) di deskripsi PR/commit.
- Swagger terperbarui untuk endpoint yang berubah.
- Dokumen di `docs/` diperbarui bila kontrak berubah.
- Checkbox task di `docs/04-implementation-plan.md` dicentang.

## Cara bekerja

- Kerjakan **satu task/fase** dalam satu waktu sesuai Implementation Plan; jangan lompat ke fase berikutnya.
- Bila ada ambiguitas pada kontrak, tanyakan; jangan mengarang payload baru.
- Setelah selesai, laporkan singkat: apa yang dibuat, cara mengujinya, apa yang belum.
