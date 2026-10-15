# Tervia Prototype

Prototype multi-role untuk menyiapkan monitoring ujian eksternal. Tervia bukan penyedia soal atau platform pengerjaan ujian: Admin mengelola sesi dan Link Ujian, lalu peserta membuka platform institusi/LMS/CBT yang sudah digunakan. Tervia mempertahankan halaman monitoring, menyusun event timeline, dan membantu Human Review.

## Menjalankan

Jalankan server lokal dengan `npm start` bila Node.js tersedia, lalu buka `http://localhost:8000`. Akses kamera dan mikrofon memerlukan izin browser dan secure context (`localhost` atau HTTPS).

## Akun demo

| Role | ID | Email | Kata sandi |
|---|---|---|---|
| Peserta | `PST-001` | — | — |
| Pengawas | `PGW-001` | `pengawas@tervia.demo` | `demo123` |
| Admin | `ADM-001` | `admin@tervia.demo` | `demo123` |

## Struktur data prototype

- `assets/js/admin-store.js` menyimpan master `users` (akun admin/pengawas), `participants`, `exams`, `examSessions`, dan `proctorAssignments` di localStorage dengan key `ujiguard_admin_master_v1`.
- `assets/js/store.js` menyimpan state runtime `participantSessions` di store prototype terpisah, bersama data station/event lama. Runtime sesi tidak dicampur ke master admin.
- `assets/js/demo-users.js` membentuk data lookup login peserta dan staff dari master admin, termasuk nama ujian dan waktu sesi hasil relasi.
- `examSessions[].examUrl` menyimpan Link Ujian eksternal. Sesi Daring memerlukan URL HTTP(S); Tervia membuka URL itu di tab baru setelah peserta memulai monitoring.
- `assets/js/auth.js` menjalankan lookup ID, konfirmasi identitas peserta, dan login staff.

## Flow yang tersedia

- Login satu pintu menentukan role berdasarkan ID. Peserta mengonfirmasi identitas; admin/pengawas memakai email dan kata sandi.
- Admin memiliki menu Dashboard, Ujian, Sesi Ujian, Peserta, Pengawas, dan Penugasan. Data tersimpan lokal untuk prototype.
- Dashboard Pengawas membaca hanya sesi yang ditugaskan melalui `proctorAssignments`, lalu menampilkan katalog peserta, indikator, tindakan human review, dan riwayat pemeriksaan.
- Skenario indikator PST-003 / Dewi Anggraini diberi label Data Simulasi dan tidak berasal dari AI atau kamera.
- Hanya PST-001 / Station Demo A-01 yang dapat menyiarkan video peserta melalui WebRTC saat sesi aktif dan signaling server demo berjalan. Peserta/station simulasi tidak memiliki live camera. Pengawas tidak memakai kameranya sendiri.
- Peserta hanya dapat masuk jika `waktu mulai <= waktu sekarang < waktu selesai`. Sebelum sesi mulai, pemeriksaan perangkat tersedia, tombol masuk disabled, dan countdown menuju mulai ditampilkan. Waktu sesi disimpan sebagai tanggal serta jam WIB. Saat waktu akhir tercapai, store menandai sesi `SELESAI`, menyimpan `leftAt`/`endedAt`, menghentikan media tracks, lalu membuka halaman Ujian Selesai.
- Setelah pemeriksaan kamera/mikrofon, peserta meminta screen sharing lewat `getDisplayMedia()`. Browser tetap menentukan pilihan sumber; Tervia menerima sesi hanya jika browser melaporkan `displaySurface: "monitor"`, lalu menampilkan status "Layar penuh aktif". Pilihan browser/window ditolak. Laporan ini tidak memastikan jumlah monitor fisik atau mengunci sistem operasi.
- Event monitoring peserta PST-001 dapat direlay lintas perangkat oleh endpoint demo `/monitoring-events`; data event hanya berada di memori server dan hilang saat server restart. Visibility/focus dicatat sebagai aktivitas informasional, bukan pelanggaran.
- Screen sharing berhenti, kamera berhenti, dan koneksi jaringan terputus menghasilkan indikasi untuk Human Review. Beberapa indikasi nyata dalam 2 menit ditampilkan sebagai bundle; bundle bukan bukti atau skor kecurangan. Keputusan Aman/Pelanggaran tetap oleh Pengawas.
- Keluar sebelum waktu akhir meminta konfirmasi, menghentikan media, dan menandai `Keluar Sebelum Selesai` dengan `leftAt`.

## Catatan prototype

Kamera dan status mikrofon dipantau selama halaman sesi Tervia aktif. Mikrofon hanya dicek status/track-nya; audio tidak dikirim atau dianalisis. Pada PST-001, layar dan kamera dikirim via WebRTC tanpa rekaman; Pengawas membuka stream hanya pada Detail Peserta yang dipilih. Peserta simulasi memakai pratinjau berlabel Data Simulasi. Browser yang melaporkan `displaySurface: "monitor"` tidak membuktikan jumlah monitor fisik dan tidak mengunci sistem operasi. Tervia tidak membaca browser history, URL tab lain, atau memblokir browser lain. Secure exam browser/SEB integration dan monitoring agent belum diimplementasikan. Signaling, presence, dan relay event berjalan di memori server demo dengan STUN tanpa TURN. Runtime store serta master/assignment Admin masih lokal per browser/origin; relay event lintas perangkat hanya tersedia saat server demo aktif.

Flow peserta lama di `pages/student/` tetap disimpan sebagai referensi; URL station lamanya mengarah ke login agar akses kamera mengikuti sesi peserta dan batas waktu yang berlaku. URL halaman Pengawas lama mengarah ke dashboard yang membatasi sesi berdasarkan assignment. `assets/js/webrtc.js` dan signaling `server.js` dipakai hanya untuk live video PST-001 / A-01. Data station/event lama tetap disimpan di store untuk mendukung skenario demo.
