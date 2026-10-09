# PRD Addendum v1.1 — Web UI dan Rute (OSRM)

> Pelengkap `docs/01-prd.md`. Dokumen ini **tidak** menggantikan PRD asli; ia menambah dan mengubah scope secara eksplisit. Setelah disetujui, terapkan perubahan di `docs/12-perubahan-dokumen-lama.md` agar PRD asli tidak bertentangan dengan kode.
> Status: **Draf untuk direview**. Target: ±3 hari kerja setelah v1.0 selesai (backend dan UI dikerjakan AI agent; backend direview ketat).

## 1. Ringkasan

v1.0 menyelesaikan backend: order → auto-assign driver → antar → selesai, dengan tracking real-time lewat WebSocket. v1.1 menambah dua hal:

1. **Web app** untuk Customer dan Driver yang memakai API yang sudah ada: peta, daftar order, profil, serta rute dan posisi driver secara langsung.
2. **Rute jalan sebenarnya** lewat **OSRM**: jarak dan durasi mengikuti jalan (bukan garis lurus), rute bisa digambar di peta, dan **tarif dihitung dari jarak**, tidak lagi flat.

## 2. Tujuan

**Tujuan belajar (prioritas utama)**

1. Mengintegrasikan layanan eksternal (HTTP routing engine) dengan timeout dan **fallback** yang jelas.
2. Memakai PostGIS untuk menyimpan dan membaca geometri rute (`geography(LineString,4326)`, `ST_AsGeoJSON`).
3. Membangun frontend realtime: REST + Socket.IO, peta (Leaflet), dan state server (TanStack Query).
4. Menjaga kontrak API sebagai satu sumber kebenaran: tipe frontend di-generate dari OpenAPI Gateway.
5. Mengamankan sesi browser dengan cookie `HttpOnly`: CORS dengan kredensial, `SameSite`, pertahanan CSRF berlapis, dan autentikasi handshake WebSocket lewat cookie.

**Tujuan produk**
Customer dapat memilih titik di peta, melihat estimasi jarak, waktu, dan biaya, memesan, lalu melihat rute dan posisi driver bergerak. Driver dapat online/offline, menerima order, dan memperbarui status dari browser.

## 3. Aktor

Tidak berubah (Customer, Driver). Sistem eksternal baru: **OSRM** (server demo atau self-host).

## 4. User Story Baru

| ID | Sebagai | Saya ingin | Agar |
|---|---|---|---|
| US-10 | Customer | memilih titik jemput dan tujuan langsung di peta | tidak perlu mengetik koordinat |
| US-11 | Customer | melihat estimasi jarak, waktu, dan biaya sebelum memesan | tahu biaya sebelum memutuskan |
| US-12 | Customer | melihat rute dan posisi driver bergerak di peta | tahu kapan barang tiba |
| US-13 | Customer | melihat riwayat order beserta detail rutenya | meninjau pesanan lama |
| US-14 | Customer/Driver | melihat profil dan keluar (logout) | mengelola sesi saya |
| US-15 | Driver | menyatakan online/offline dari aplikasi | bisa mulai atau berhenti menerima order |
| US-16 | Driver | melihat order aktif, rutenya, dan mengubah status dari aplikasi | menjalankan order tanpa alat bantu lain |
| US-17 | Driver | mengirim lokasi dari GPS perangkat atau dari simulator | posisi saya terlacak, dan sistem bisa didemokan tanpa bergerak |
| US-18 | Sistem | menghitung jarak dan biaya dari rute jalan | tarif lebih masuk akal dan konsisten |
| US-19 | Customer/Driver | tetap login setelah halaman dimuat ulang tanpa ada token yang bisa dibaca skrip halaman | sesi nyaman dan tidak bisa dicuri lewat XSS |

## 5. Scope v1.1

**In scope (tambahan)**

- Web app responsif (mobile-first) untuk Customer dan Driver dalam **satu** aplikasi dengan area terpisah per role.
- Peta (Leaflet) dengan marker, polyline rute, dan posisi driver real-time.
- Estimasi order (`POST /orders/estimate`), perhitungan jarak/durasi/rute lewat OSRM, dan **tarif berbasis jarak** dengan parameter di konfigurasi.
- Penyimpanan snapshot rute, durasi, dan sumber rute pada order.
- Fallback ke garis lurus (PostGIS) bila OSRM tidak tersedia.
- Sesi login lewat **cookie `HttpOnly`** yang di-set Gateway (`POST /auth/login` dan `POST /auth/logout`). Header `Authorization: Bearer` tetap didukung untuk klien non-browser (Swagger, Postman, script, e2e).
- CORS terkontrol dengan kredensial untuk web app, pertahanan CSRF berlapis, dan pemeriksaan `Origin` pada handshake WebSocket.
- Mode simulator driver di UI (mengikuti polyline rute) di samping mode GPS.
- Self-host OSRM untuk satu wilayah (tahap akhir; server demo dipakai lebih dulu).

**Out of scope (tetap atau baru, dilarang ditambahkan tanpa persetujuan)**

- **Tarif dinamis (surge)**, promo, dan pembayaran. Catatan: "flat" tidak lagi berlaku; tarif berbasis jarak **diizinkan**, surge tidak.
- Aplikasi native (React Native/Flutter), PWA offline, dan push notification native.
- Pencarian alamat/geocoding (Nominatim) dan reverse geocoding. Titik dipilih lewat peta.
- Profil driver lengkap (nama, foto, plat) dan rating. Order hanya menampilkan identitas pendek driver.
- Rute multi-stop, navigasi belok-demi-belok, dan rute alternatif.
- Profil kendaraan motor khusus di OSRM (dipakai profil mobil sebagai pendekatan).
- Perhitungan ulang rute selama perjalanan (rute disimpan saat order dibuat).
- Refresh token, revokasi token sisi server, token CSRF *double-submit*, OAuth/SSO, dan cookie lintas-situs (`SameSite=None`) selain catatan konfigurasi.
- Admin panel, chat, dan item out-of-scope v1.0 lainnya (kecuali yang dinyatakan di atas).

**Opsional (kalau sisa waktu)**

- Cache estimasi di memori (kunci koordinat dibulatkan, TTL singkat).
- ETA driver ke titik jemput (rute driver → pickup).
- Posisi terakhir driver pada ack `order:subscribe`.
- Endpoint status online/offline driver agar tidak hilang saat refresh.
- E2E UI dengan Playwright.

## 6. Acceptance Criteria Baru

- **AC-11:** `POST /orders/estimate` oleh customer mengembalikan `distanceM`, `durationS`, `fee`, `route` (GeoJSON LineString), dan `routeSource`. Fee sesuai rumus di TSD addendum (§7) untuk semua vektor uji.
- **AC-12:** `POST /orders` menghitung ulang di server dan menyimpan jarak jalan, durasi, rute, dan sumbernya. `GET /orders/:id` mengembalikan `route`; `GET /orders` tidak.
- **AC-13:** Bila OSRM timeout, down, atau membalas `NoRoute`, estimasi dan pembuatan order **tetap berhasil** dengan `routeSource = STRAIGHT_LINE`, tanpa error 5xx.
- **AC-14:** Koordinat di luar area layanan (bila `SERVICE_AREA_BBOX` diisi) ditolak 400 `OUT_OF_SERVICE_AREA`. Pickup dan dropoff yang terlalu berdekatan ditolak 400 `VALIDATION_ERROR`.
- **AC-15:** Di browser, customer dapat memilih dua titik, melihat estimasi, memesan, lalu melihat status dan marker driver berubah **tanpa reload**.
- **AC-16:** Driver dapat online/offline, melihat order yang di-assign, menekan "Sudah dijemput" dan "Selesai", dan marker driver bergerak di layar customer lewat simulator.
- **AC-17:** Hanya origin yang terdaftar di `CORS_ORIGINS` yang dapat memanggil API (dengan kredensial) dan WebSocket dari browser. Header `Access-Control-Allow-Origin` tidak pernah `*`, dan Gateway menolak start bila `CORS_ORIGINS` kosong atau berisi `*`.
- **AC-18:** Customer dan driver dapat membuka riwayat order dan halaman profil.
- **AC-19:** Atribusi "© OpenStreetMap contributors" dan sumber rute (OSRM) tampil di setiap layar peta.
- **AC-20:** Saat WebSocket terputus, UI menampilkan indikator dan beralih ke polling `GET /orders/:id`; ketika tersambung kembali, UI subscribe ulang otomatis.
- **AC-21:** Login dari browser menghasilkan `Set-Cookie` dengan atribut `HttpOnly`, `Path=/`, `SameSite=Lax` (dan `Secure` bila `COOKIE_SECURE=true`), tanpa atribut `Domain`; `Max-Age` mengikuti masa berlaku JWT. Token tidak ada di `localStorage`/`sessionStorage`, dan memuat ulang halaman mempertahankan sesi lewat `GET /auth/me`.
- **AC-22:** `POST /auth/logout` menghapus cookie; setelahnya `GET /auth/me` mengembalikan 401, UI kembali ke halaman login, dan koneksi Socket.IO diputus.
- **AC-23:** Request tidak aman (selain GET/HEAD/OPTIONS) yang diautentikasi lewat cookie tanpa header `X-Requested-With: XMLHttpRequest` ditolak 403 `CSRF_HEADER_REQUIRED`. Request dengan `Authorization: Bearer` tidak terkena aturan ini.
- **AC-24:** Handshake Socket.IO berbasis cookie hanya diterima dari origin di `CORS_ORIGINS`; origin lain, atau tanpa cookie/token, ditolak. Klien non-browser tetap dapat memakai `auth.token`/`Authorization: Bearer`, sehingga e2e dan script v1.0 tetap lulus tanpa perubahan.

## 7. Definition of Done (v1.1)

- [ ] `docker compose up -d` + `bun run dev:all` + `cd web && bun run dev` menjalankan seluruh sistem.
- [ ] AC-11 sampai AC-24 lolos (manual atau test otomatis).
- [ ] Unit test untuk `FeeCalculator`, `OsrmClient` (HTTP di-mock), helper konversi koordinat, simulator, util cookie/ekstraksi token, dan `JwtAuthGuard` (aturan CSRF).
- [ ] 1 skenario demo end-to-end tertulis di README (dua browser: customer dan driver).
- [ ] Dokumen `docs/` mutakhir (lihat `docs/12-perubahan-dokumen-lama.md`).
- [ ] Tidak ada pelanggaran aturan AGENTS.md (setelah diperbarui).

## 8. Asumsi

- Server demo OSRM hanya untuk prototipe: batas wajar penggunaan (±1 request/detik), tanpa jaminan, wajib atribusi dan User-Agent yang jelas. Untuk pemakaian lebih serius, self-host.
- Profil mobil OSRM dipakai sebagai pendekatan untuk ojek/kurir motor. Hasil bisa berbeda dari rute motor sungguhan.
- Data jalan adalah salinan OpenStreetMap pada saat diproses dan tidak otomatis diperbarui.
- Tile peta memakai server OSM standar hanya untuk pengembangan/demo ringan; untuk lalu lintas besar diperlukan penyedia tile lain.
- Tarif bukan angka pasti produk nyata: `FEE_BASE`, `FEE_PER_KM`, `FEE_MIN`, dan `FEE_ROUND` adalah parameter latihan di konfigurasi.
- GPS browser membutuhkan `localhost` atau HTTPS. Pengujian di HP lewat jaringan lokal membutuhkan HTTPS (mis. tunnel) atau memakai mode simulator.
- Satu instance Gateway (batasan ADR-015 tetap berlaku).
- Web app dan Gateway berada pada *situs* yang sama (mis. `localhost:5173` dan `localhost:3000`; port berbeda tetap satu situs) sehingga `SameSite=Lax` cukup. Mengakses lewat `127.0.0.1` adalah situs yang berbeda dari `localhost` dan membuat cookie tidak terkirim. Untuk domain berbeda di produksi dibutuhkan `SameSite=None; Secure` atau reverse proxy satu domain.
- Atribut `Secure` hanya aktif lewat `COOKIE_SECURE=true` (HTTPS); di `http://localhost` dimatikan.
- JWT bersifat stateless: logout hanya menghapus cookie di browser, token yang sudah bocor tetap berlaku sampai kedaluwarsa.

## 9. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Server demo OSRM dibatasi atau down | Estimasi lambat atau gagal | Timeout 3 detik, fallback garis lurus, debounce di UI, self-host di akhir |
| Scope UI membengkak | Proyek tidak selesai | Selesaikan Customer dulu, lalu Driver; item opsional dibuang bila mepet |
| Urutan koordinat tertukar (OSRM/PostGIS `lng,lat` vs Leaflet `[lat,lng]`) | Rute muncul di tempat yang salah | Satu helper konversi bertes; aturan baru di AGENTS |
| Tes root ikut menjalankan tes `web/` | `bun run test` rusak | Exclude `web/**` di konfigurasi Vitest dan tsconfig root |
| Fee tidak konsisten antara estimasi dan order | Customer merasa ditipu | Server menghitung ulang di `POST /orders`; rumus tunggal di `FeeCalculator` |
| GPS tidak bisa dites di HP | Driver tidak bisa didemokan | Mode simulator mengikuti polyline rute |
| Cookie tidak terkirim (host berbeda, `SameSite`, atau CORS tanpa kredensial) | UI selalu 401 setelah login | Selalu pakai `localhost`, `credentials: 'include'`, `CORS_ORIGINS` eksplisit; e2e cookie |
| CSRF karena cookie dikirim otomatis | Aksi tak diinginkan dari situs lain | `SameSite=Lax` + CORS allowlist + header `X-Requested-With` wajib untuk request tidak aman berbasis cookie |
| Cross-site WebSocket hijacking | Koneksi WS memakai sesi korban | Cek `Origin` pada handshake berbasis cookie |
