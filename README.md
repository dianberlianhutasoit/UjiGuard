# UjiGuard Prototype

Prototype multi-role untuk menyiapkan pelaksanaan ujian. Admin mengelola ujian, jadwal sesi, peserta, akun pengawas, dan penugasan; peserta memakai jadwal sesi yang sama untuk flow persiapan dan sesi ujian.

## Menjalankan

Jalankan server lokal dengan `npm start` bila Node.js tersedia, lalu buka `http://localhost:8000`. Akses kamera dan mikrofon memerlukan izin browser dan secure context (`localhost` atau HTTPS).

## Akun demo

| Role     | ID        | Email                    | Kata sandi |
| -------- | --------- | ------------------------ | ---------- |
| Peserta  | `PST-001` | —                        | —          |
| Pengawas | `PGW-001` | `pengawas@ujiguard.demo` | `demo123`  |
| Admin    | `ADM-001` | `admin@ujiguard.demo`    | `demo123`  |

## Struktur data prototype

- `assets/js/admin-store.js` menyimpan master `users` (akun admin/pengawas), `participants`, `exams`, `examSessions`, dan `proctorAssignments` di localStorage dengan key `ujiguard_admin_master_v1`.
- `assets/js/store.js` menyimpan state runtime `participantSessions` di store prototype terpisah, bersama data station/event lama. Runtime sesi tidak dicampur ke master admin.
- `assets/js/demo-users.js` membentuk data lookup login peserta dan staff dari master admin, termasuk nama ujian dan waktu sesi hasil relasi.
- `assets/js/auth.js` menjalankan lookup ID, konfirmasi identitas peserta, dan login staff.

## Flow yang tersedia

- Login satu pintu menentukan role berdasarkan ID. Peserta mengonfirmasi identitas; admin/pengawas memakai email dan kata sandi.
- Admin memiliki menu Dashboard, Ujian, Sesi Ujian, Peserta, Pengawas, dan Penugasan. Data tersimpan lokal untuk prototype.
- Dashboard Pengawas membaca hanya sesi yang ditugaskan melalui `proctorAssignments`, lalu menampilkan katalog peserta, indikator, tindakan human review, dan riwayat pemeriksaan.
- Skenario indikator PST-003 / Dewi Anggraini diberi label Data Simulasi dan tidak berasal dari AI atau kamera.
- Hanya PST-001 / Station Demo A-01 yang dapat menyiarkan video peserta melalui WebRTC saat sesi aktif dan signaling server demo berjalan. Peserta/station simulasi tidak memiliki live camera. Pengawas tidak memakai kameranya sendiri.
- Peserta hanya dapat masuk jika `waktu mulai <= waktu sekarang < waktu selesai`. Sebelum sesi mulai, pemeriksaan perangkat tersedia, tombol masuk disabled, dan countdown menuju mulai ditampilkan. Waktu sesi disimpan sebagai tanggal serta jam WIB. Saat waktu akhir tercapai, store menandai sesi `SELESAI`, menyimpan `leftAt`/`endedAt`, menghentikan media tracks, lalu membuka halaman Ujian Selesai.
- Keluar sebelum waktu akhir meminta konfirmasi, menghentikan media, dan menandai `Keluar Sebelum Selesai` dengan `leftAt`.

## Catatan prototype

Kamera dan status mikrofon dipantau selama halaman sesi UjiGuard aktif. Mikrofon hanya dicek status/track-nya; audio tidak dikirim ke pengawas dan tidak dianalisis untuk anomali. Secure exam browser dan monitoring agent belum diimplementasikan, sehingga prototype tidak menjamin pemantauan saat tab ditangguhkan atau browser ditutup. Station Demo A-01 mengirim video WebRTC tanpa merekam. Signaling dan presence berjalan di memori server demo dengan STUN tanpa TURN, sehingga koneksi lintas jaringan tidak dijamin stabil. Runtime store serta master/assignment Admin masih lokal per browser/origin; signaling presence hanya menyediakan status kamera/session ringan untuk demo lintas perangkat.

Flow peserta lama di `pages/student/` tetap disimpan sebagai referensi; URL station lamanya mengarah ke login agar akses kamera mengikuti sesi peserta dan batas waktu yang berlaku. URL halaman Pengawas lama mengarah ke dashboard yang membatasi sesi berdasarkan assignment. `assets/js/webrtc.js` dan signaling `server.js` dipakai hanya untuk live video PST-001 / A-01. Data station/event lama tetap disimpan di store untuk mendukung skenario demo.
