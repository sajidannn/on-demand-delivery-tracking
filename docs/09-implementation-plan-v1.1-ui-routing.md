# Implementation Plan v1.1 — 3 Hari

> Pelengkap `docs/04-implementation-plan.md`. Acuan: PRD `docs/06`, SDD `docs/07`, TSD `docs/08`, ADR `docs/11` (ADR-016 sampai 022). Brief agent UI: `ui-agent-brief-v1.1.md`.
> **Satu tugas, satu commit.** Agent melapor tiap selesai: apa yang dikerjakan, cara mencobanya, hasil `lint`, `test`, dan `build`.

## 1. Cara kerja

| Peran | Tugas |
|---|---|
| **Agent BE** | Mengerjakan `apps/` dan `libs/` sesuai daftar tugas per hari di bawah |
| **Agent UI** | Mengerjakan seluruh `web/` (mulai setelah G0), tanpa menyentuh `apps/` dan `libs/` |
| **Kamu** | Memberi tugas, **mereview backend dengan ketat**, memutuskan lolos atau tidaknya tiap gerbang, dan menjalankan demo akhir. UI dilepas hampir penuh: cukup demo dan beberapa pengecekan otomatis |

Prinsip review: baca diff bagian yang rawan (keamanan, SQL, alur order), jangan hanya percaya laporan "tes hijau". Cek bahwa tes benar-benar memuat kasus negatifnya.

## 2. Gerbang

UI dibangun di atas kontrak, jadi kontrak dibekukan lebih dulu (stub), lalu diganti implementasi nyata tanpa mengubah UI.

| Gerbang | Kapan | Syarat lolos | Setelah lolos |
|---|---|---|---|
| **G0** Kontrak dibekukan | Awal Hari 1 | `/docs-json` memuat `POST /orders/estimate` (stub), `POST /auth/logout` (stub), dan field baru `OrderDto` | Agent UI mulai (M1) |
| **G1** Sesi cookie nyata | Akhir Hari 1 | AC-21 sampai 24 hijau; review keamanan lolos | Agent UI memakai login dan socket sungguhan |
| **G2** Estimasi nyata | Akhir Hari 2 | AC-11 sampai 14 hijau; `grep -rn STUB apps libs` kosong | Agent UI beralih dari stub ke estimasi nyata |
| **G3** Siap integrasi | Awal Hari 3 | Agent UI selesai M1 sampai M3 | Demo dan perbaikan |

Kontrak berubah → perbarui TSD dulu, kabari agent UI, jalankan ulang `bun run api:types`.

### Gerbang harian

```bash
bun run lint && bunx tsc --noEmit -p tsconfig.json && bun run test
bun run test:e2e                    # stack hidup: docker compose up -d + bun run dev:all
cd web && bun run lint && bun run test && bun run build
```

Tes v1.0 (unit, e2e alur order, integrasi Socket.IO) harus hijau setiap hari; itu bukti mode Bearer dan `auth.token` belum rusak.

---

## 3. Hari 1 — Kontrak dan sesi cookie

**Tugas agent BE (berurutan)**

1. **Aturan dan konfigurasi.** Tambahkan ke `AGENTS.md`: `web/` di luar `apps/` dan tidak mengimpor `libs/common`; token tidak boleh di `localStorage`/`sessionStorage`/`document.cookie` dan cookie hanya dibuat lewat `apps/gateway/src/session/`; `origin: '*'` dilarang; konversi koordinat hanya di `web/src/lib/geo.ts` dan `OsrmClient`; satu client API di frontend. Konfigurasi root: kecualikan `web/**` dari `vitest.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `.gitignore`, `.prettierignore` (`osrm-data/`, `web/node_modules`, `web/dist`); lengkapi `.env.example` (`OSRM_*`, `FEE_*`, `CORS_ORIGINS`, `AUTH_COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`) dan hapus `FLAT_FEE` setelah `grep` memastikan tidak terpakai.
2. **Kontrak → G0.** `RouteSource` di `libs/common`; DTO `RouteGeometryDto`, `OrderEstimateDto`, `EstimateOrderDto`; field baru di `OrderDto` (`durationS?`, `routeSource`, `route?`); stub `POST /orders/estimate` di Gateway (mengembalikan contoh TSD §5, diberi komentar `// STUB`) dan `POST /auth/logout` (204). Swagger lengkap dengan contoh.
3. **Sesi cookie** (TSD §17): `session/auth-cookie.ts` dan `session/token-source.ts`; `login` memasang cookie (body tetap `{ accessToken }`), `logout` menghapusnya; `JwtAuthGuard` memakai `extractToken` dan menolak request tidak aman berbasis cookie tanpa `X-Requested-With` (403 `CSRF_HEADER_REQUIRED`); `main.ts` dengan `cookieParser`, CORS `credentials: true`, gagal start bila `CORS_ORIGINS` kosong atau `*`, `CorsIoAdapter` ber-kredensial, hapus `origin: '*'` di `@WebSocketGateway`, Swagger `addCookieAuth`; `TrackingGateway.handleConnection` menerima token dari `auth.token` atau cookie, dengan pemeriksaan `Origin` terhadap `CORS_ORIGINS` khusus jalur cookie.
4. **Tes.** Unit untuk util dan guard (tabel sumber token × metode × header); integrasi Socket.IO (origin terdaftar, origin asing, cookie tanpa `Origin`, `auth.token`, token salah); e2e `auth-cookie.e2e-spec.ts` (TSD §15). Seluruh tes v1.0 tetap hijau.

Perhatian untuk agent: Express `maxAge` dalam **milidetik**; `clearCookie` harus memakai atribut yang sama dengan saat set; `credentials: true` tidak boleh dengan `origin: '*'`; opsi `cors` Socket.IO tidak menolak origin asing di sisi server (pemeriksaan manual wajib); jangan pernah log nilai cookie.

**Tugas agent UI (setelah G0):** M1 dari brief (fondasi). Setelah G1, hubungkan auth sungguhan.

**Review ketat (kamu, ±1,5 jam)**

- [ ] `session/auth-cookie.ts`: `HttpOnly`, `Path=/`, `SameSite` dan `Secure` dari env, **tanpa `Domain`**, `Max-Age` dari klaim `exp`; `clearCookie` memakai atribut yang sama.
- [ ] `JwtAuthGuard`: Bearer dibaca lebih dulu; aturan CSRF **hanya** untuk sumber cookie dan metode selain GET/HEAD/OPTIONS.
- [ ] `main.ts`: tidak ada `*`, ada fail-fast, `credentials: true`; `grep -rn "origin: '\*'" apps` kosong.
- [ ] Handshake: pemeriksaan `Origin` hanya di jalur cookie; jalur `auth.token` tetap berfungsi tanpa `Origin`.
- [ ] Tes memuat kasus negatif (origin asing, tanpa header CSRF, cookie kedaluwarsa), bukan hanya jalur sukses.
- [ ] Tidak ada log yang memuat cookie atau token; e2e v1.0 dan `demo:ws` tetap lulus.

**Lolos G1 bila:** AC-17 (sisi server) dan AC-21 sampai 24 hijau, seluruh tes v1.0 hijau, dan checklist di atas bersih.

---

## 4. Hari 2 — Rute dan tarif

**Tugas agent BE (berurutan)**

1. **`FeeCalculator`** (`apps/order-service/src/routing/fee-calculator.ts`): fungsi murni sesuai TSD §7; tes dari tujuh vektor uji dan penolakan `distanceM <= 0`.
2. **`OsrmClient`:** `fetch` + `AbortSignal.timeout(OSRM_TIMEOUT_MS)`, URL `lng,lat;lng,lat`, header `User-Agent` jelas; **tidak pernah melempar** (semua kegagalan menjadi `null`); tes untuk sukses, `NoRoute`, non-200, JSON rusak, geometri kurang dari 2 titik, timeout, dan urutan koordinat di URL.
3. **`RoutingService`:** OSRM lebih dulu; bila `null`, pakai `straightLineDistance()` (SQL `ST_Distance`), tandai `STRAIGHT_LINE`, log `warn`.
4. **Migrasi dan repository:** `AddRouteToOrders` (TSD §4, dengan `down()`), insert `route` dari GeoJSON, baca lewat `ST_AsGeoJSON`, daftar order tanpa `route`; tes integrasi DB.
5. **Validasi:** jarak minimum 50 m (`VALIDATION_ERROR`). `SERVICE_AREA_BBOX` hanya bila waktu cukup (AC-14 bagian area).
6. **`estimate()` dan `create()`:** hitung ulang jarak dan fee **di server** (abaikan nilai dari client); alur reserve, kompensasi, dan event tidak berubah; `estimate` tidak menyimpan apa pun; perbarui `order-service.service.spec.ts`.
7. **Ganti stub → G2:** handler TCP `order.estimate`, Gateway meneruskannya, hapus semua komentar `STUB`.
8. **E2E:** perluas `order-flow.e2e-spec.ts`: `fee == calculateFee(distanceM)` dan terima `OSRM` maupun `STRAIGHT_LINE` (server demo bisa membatasi laju).

Perhatian untuk agent: server demo OSRM ±1 request per detik dan butuh `User-Agent` jelas; `ST_GeomFromGeoJSON` menerima teks JSON; env dibaca sebagai string (`Number(...)`); `fee` dan jarak adalah snapshot saat order dibuat.

**Tugas agent UI:** M2 (Customer: pilih titik, estimasi, pesan, riwayat, profil) dan M3 (tracking real-time, Driver, simulator).

**Review ketat (kamu, ±1,5 jam)**

- [ ] `OsrmClient`: seluruh isi dibungkus `try/catch`, timeout terpasang, tidak ada jalur yang melempar; URL berurutan `lng,lat`.
- [ ] `RoutingService`: fallback menandai `STRAIGHT_LINE` dan `durationS`/`route` bernilai `null`.
- [ ] SQL: semua berparameter (tidak ada string interpolation, terutama pada insert GeoJSON); migrasi `down()` benar; baris lama otomatis `STRAIGHT_LINE`.
- [ ] `create()`: jarak dan fee dihitung ulang di server; **diff `order-service.service.ts`** menunjukkan alur reserve, kompensasi, dan event tidak berubah.
- [ ] `estimate()` tidak menulis ke DB; `GET /orders` tidak memuat `route`.
- [ ] Cek manual fallback: set `OSRM_URL` ke alamat mati, estimasi dan order tetap sukses dengan `STRAIGHT_LINE`, ada log `warn`, tanpa 5xx.
- [ ] `grep -rn STUB apps libs` kosong; seluruh tes v1.0 hijau.

**Lolos G2 bila:** AC-11 sampai 14 hijau (bagian area opsional) dan checklist di atas bersih.

---

## 5. Hari 3 — Integrasi dan penutup

- [ ] **Demo dua browser.** Chrome biasa untuk Customer, incognito untuk Driver (cookie terikat ke host, jadi dua login di satu profil browser saling menimpa). Jalankan TSD §15 skenario 1 sampai 8. Bug backend → agent BE, bug UI → agent UI, masing-masing dengan langkah reproduksi.
- [ ] **Pengecekan otomatis hasil agent UI:**

```bash
grep -rnE "localStorage|sessionStorage|document\.cookie" web/src     # harus kosong
grep -rn "libs/common" web/src                                       # harus kosong
grep -rniE "credentials" web/src/lib                                 # ada di client API dan socket
grep -rn "X-Requested-With" web/src/lib                              # ada di client API
grep -rn "STUB" apps libs                                            # harus kosong
```

- [ ] **Baca dua berkas keamanan UI:** `web/src/lib/api/client.ts` dan provider socket.
- [ ] **Gerbang akhir:** seluruh gerbang harian, lalu uji dari clone bersih mengikuti README (`docker compose down -v`, setup, `dev:all`, `web:dev`).
- [ ] **Dokumen.** Agent menyusun draf README (setup `web/`, cookie, skenario demo, troubleshooting) dan menerapkan perubahan ke dokumen lama sesuai `docs/12`; kamu menjalankan tiap perintah di README. Tambahkan ADR-022 ke `docs/11` (pastikan tidak bertentangan dengan ADR-016 sampai 021), perbarui `AGENTS.md`, centang plan ini, pastikan `git ls-files | grep -E "\.log|\.env$|osrm-data"` kosong, lalu tag `v1.1.0`.
- [ ] **[N] OSRM self-host.** Hanya bila semua hijau sebelum tengah hari: `scripts/osrm-setup.sh`, service `osrm` dengan `profiles: ["osrm"]`, image dipin (cek tag terbaru, jangan mengandalkan ingatan), `OSRM_URL=http://localhost:5001`, lalu matikan container dan pastikan fallback bekerja. Bila tidak sempat, catat sebagai tindak lanjut di README.

**Selesai bila:** Definition of Done PRD §7 terpenuhi (kecuali self-host yang opsional).

---

## 6. Matriks AC → hari

| AC | Hari | Dibuktikan oleh |
|---|---|---|
| 11, 12, 13, 14 | 2 | tes backend, e2e, cek fallback manual |
| 17, 21, 22, 23, 24 | 1 (server), 3 (browser) | e2e cookie, integrasi Socket.IO, demo |
| 15, 16, 18, 19, 20 | 2 sampai 3 | demo dua browser |

## 7. Jika waktu mepet

Potong berurutan: (1) OSRM self-host; (2) `SERVICE_AREA_BBOX` dan semua [N]; (3) mode GPS (simulator cukup untuk demo); (4) tes UI di luar logika murni (`geo.ts`, simulator, `useOrderTracking`). **Jangan dipotong:** tes regresi v1.0, aturan CSRF, pemeriksaan `Origin` WebSocket, fallback OSRM, helper koordinat.

## 8. Risiko

| Risiko | Mitigasi |
|---|---|
| Kode backend dari agent terlihat benar tapi longgar di sisi keamanan | Checklist review per hari; periksa tes negatif, bukan hanya laporan hijau |
| Agent UI melanggar aturan keamanan atau kontrak | Brief memuat invarian; pengecekan `grep` Hari 3; baca dua berkas kritis |
| Agent UI bergantung pada backend yang belum siap | Gerbang G0 sampai G3; stub dihapus di G2 |
| Cookie tidak terkirim (`localhost` vs `127.0.0.1`, CORS tanpa kredensial) | Satu host di seluruh konfigurasi; e2e cookie Hari 1 |
| Perubahan auth merusak tes dan script v1.0 | Bearer dan `auth.token` dipertahankan; gerbang harian |
| Server demo OSRM membatasi laju | Timeout 3 detik, fallback, debounce di UI, asersi tes toleran |
| Urutan koordinat tertukar | Helper tunggal bertes (`geo.ts`, `OsrmClient`) |
