## ADR-022 — Sesi browser lewat cookie HttpOnly

> Tambahkan ke `docs/11-adr-v1.1.md` setelah ADR-021.

**Konteks:** Web app (PRD v1.1) perlu menjaga sesi login. Rancangan awal menyimpan JWT di `localStorage` dan mengirimnya lewat header `Authorization` dan `auth.token` Socket.IO. Token di `localStorage` bisa dibaca skrip apa pun di halaman, sehingga satu celah XSS cukup untuk mencurinya.

**Keputusan:**
1. Gateway meng-set JWT sebagai cookie `HttpOnly` (`Path=/`, `SameSite=Lax`, `Secure` lewat `COOKIE_SECURE`, tanpa `Domain`, `Max-Age` dari klaim `exp`) pada `POST /auth/login`, dan menghapusnya lewat `POST /auth/logout`.
2. Frontend tidak pernah menyimpan atau membaca token. Status login ditentukan oleh `GET /auth/me`. Semua request memakai `credentials: 'include'` dan header `X-Requested-With: XMLHttpRequest`.
3. Gateway menerima token dari `Authorization: Bearer` lebih dulu, lalu dari cookie. Klien non-browser (Swagger, Postman, script, e2e) tetap memakai Bearer dan `auth.token`; body respons `login` tetap memuat `accessToken` untuk mereka.
4. Pertahanan CSRF berlapis: `SameSite=Lax`, CORS allowlist ber-kredensial (tidak pernah `*`), dan header `X-Requested-With` wajib untuk request tidak aman yang autentikasinya berasal dari cookie (403 `CSRF_HEADER_REQUIRED`).
5. Handshake Socket.IO berbasis cookie wajib berasal dari origin di `CORS_ORIGINS` (cegah cross-site WebSocket hijacking). Opsi `cors` Socket.IO saja tidak cukup karena server tetap menerima handshake dari origin mana pun.
6. Dependensi baru di backend: `cookie-parser` dan `cookie` (kecil, hanya untuk parsing).

**Alternatif yang ditolak:**
- *Token di `localStorage`/`sessionStorage`:* rentan dicuri lewat XSS.
- *Cookie yang di-set JavaScript (`document.cookie`):* tetap terbaca skrip, tidak memberi perlindungan XSS dan tidak bisa `HttpOnly`.
- *Sesi sisi server (Redis) atau BFF:* menambah infrastruktur di luar scope latihan.
- *Refresh token berotasi:* menambah kompleksitas yang tidak dibutuhkan; masa berlaku JWT tetap satu hari.
- *Hanya Bearer untuk semua:* mempertahankan risiko XSS di browser.

**Konsekuensi:**
- Web dan Gateway harus satu *situs* (`localhost:5173` dan `localhost:3000` aman; `127.0.0.1` tidak). Domain berbeda di produksi butuh `SameSite=None; Secure` atau reverse proxy satu domain.
- CORS wajib memakai origin eksplisit dan `credentials: true`; Gateway menolak start bila `CORS_ORIGINS` kosong atau `*`.
- Dua mode autentikasi hidup berdampingan, jadi `JwtAuthGuard` dan handshake WebSocket harus punya tes untuk keduanya.
- JWT stateless: logout hanya menghapus cookie, tidak mencabut token yang sudah bocor.
- Swagger memakai Bearer; request berbasis cookie dari Swagger akan ditolak aturan CSRF.
