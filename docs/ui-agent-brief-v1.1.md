# Brief Agent UI — `web/` (v1.1)

## Tujuan

Bangun satu web app (React) untuk proyek `on-demand-delivery-tracking` dengan area **Customer** dan **Driver** yang memakai API Gateway yang sudah ada. Kamu bebas memilih detail implementasi selama invarian di bagian 3 terpenuhi. Kerjakan hanya `web/`; jangan mengubah `apps/` dan `libs/`.

## 1. Sumber

- `AGENTS.md`.
- `docs/06` PRD v1.1 (user story, scope, AC-15 sampai 24), `docs/07` SDD v1.1, `docs/08` TSD v1.1 (terutama **§13 frontend** dan **§17 sesi cookie**).
- Kontrak API aktual: `http://localhost:3000/docs-json` lewat `bun run api:types`. Event WebSocket ada di TSD §7.

Bila dokumen bertentangan dengan backend, berhenti dan laporkan; jangan mengarang kontrak.

## 2. Stack

Vite + React + TypeScript (strict), React Router, TanStack Query, `socket.io-client`, `leaflet@1.9` + `react-leaflet` (versi yang cocok dengan React), Tailwind CSS, `openapi-typescript` + `openapi-fetch`, Vitest + React Testing Library. Package manager Bun. Dependensi lain boleh bila ada alasan dan disebut di laporan.

## 3. Invarian (wajib)

1. **Token tidak boleh disentuh JavaScript**: dilarang `localStorage`, `sessionStorage`, dan `document.cookie`. Sesi berupa cookie `HttpOnly` dari Gateway; status login = hasil `GET /auth/me`.
2. Semua request API memakai `credentials: 'include'` dan header `X-Requested-With: XMLHttpRequest` (lewat satu client). Socket memakai `withCredentials: true` dan `transports: ['websocket']`, tanpa `auth.token`, dan dibuat hanya setelah `me` sukses.
3. Pakai host `localhost` di mana pun (`VITE_API_URL`, `VITE_WS_URL`, alamat browser); `127.0.0.1` membuat cookie tidak terkirim.
4. Konversi urutan koordinat (`[lng, lat]` dari backend/GeoJSON, `[lat, lng]` di Leaflet) hanya lewat satu helper (`lib/geo.ts`).
5. UI tidak menghitung fee, jarak, atau rute, dan tidak memanggil OSRM; semuanya dari backend. Tidak mengimpor dari `libs/common`.
6. Atribusi peta (`VITE_MAP_ATTRIBUTION`) tampil di setiap layar peta. Tanpa geocoding; titik dipilih lewat peta.

Di luar invarian ini, keputusan desain, struktur, dan tampilan ada di tanganmu.

## 4. Yang dibangun

**Customer:** login/register; pilih titik jemput dan tujuan di peta; lihat estimasi (jarak, waktu, biaya, rute; beri tanda bila `routeSource = STRAIGHT_LINE`) lalu pesan; riwayat order dan detail dengan rute; profil dan keluar; halaman tracking yang menampilkan status dan posisi driver bergerak tanpa reload, dengan indikator bila koneksi real-time putus (cadangan: polling `GET /orders/:id`, subscribe ulang setelah tersambung kembali).

**Driver:** login/register; online/offline; order aktif beserta rute; tombol "Sudah dijemput" dan "Selesai"; pengirim lokasi lewat **simulator** (menggerakkan titik sepanjang `route` order, kirim `driver:location` tiap ±3 detik dengan `orderId`) dan GPS browser sebagai pelengkap; riwayat order dan profil.

Urutan: fondasi dan auth → Customer → tracking dan Driver → poles. Mulai setelah backend memberi tahu kontrak siap (gerbang G0); login dan socket sungguhan setelah G1 (sebelum itu boleh dengan mock).

## 5. Selesai bila

- AC-15, 16, 18, 19, 20 terpenuhi dalam demo dua browser (Customer di jendela biasa, Driver di incognito).
- `cd web && bun run lint && bun run test && bun run build` bersih. Tulis tes secukupnya untuk logika murni (helper koordinat dan format, simulator, hook tracking, `AuthProvider`); tidak ada daftar tes yang dipaksakan.
- Draf README bagian web: setup, perintah, skenario demo, dan troubleshooting singkat.

## 6. Laporan

Sertakan: apa yang selesai, cara mencobanya, hasil `lint`/`test`/`build`, keputusan yang kamu ambil sendiri, dan hal yang menunggu backend atau bertentangan dengan dokumen. Jangan mengklaim sesuatu berjalan bila belum dijalankan. Sebelum laporan akhir, jalankan dan tempel hasilnya (keduanya harus kosong):

```bash
grep -rnE "localStorage|sessionStorage|document\.cookie" web/src
grep -rn "libs/common" web/src
```
