# UjiGuard Prototype

Prototype multi-role untuk menyiapkan pelaksanaan ujian. Admin mengelola ujian, jadwal sesi, peserta, akun pengawas, dan penugasan; peserta memakai jadwal sesi yang sama untuk flow persiapan dan sesi ujian.

## Menjalankan

Jalankan server lokal dengan `npm start` bila Node.js tersedia, lalu buka `http://localhost:8000`. Akses kamera dan mikrofon memerlukan izin browser dan secure context (`localhost` atau HTTPS).

## Akun demo

| Role | ID | Email | Kata sandi |
|---|---|---|---|
| Peserta | `PST-001` | — | — |
| Pengawas | `PGW-001` | `pengawas@ujiguard.demo` | `demo123` |
| Admin | `ADM-001` | `admin@ujiguard.demo` | `demo123` |

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
- Station Demo A-01 dapat menyiarkan kamera peserta melalui WebRTC saat sesi peserta aktif dan signaling server demo berjalan. Pengawas tidak memakai kameranya sendiri. Kamera station simulasi tidak tersedia.
- Waktu sesi disimpan sebagai tanggal serta jam WIB. Peserta melihat waktu mulai/selesai dan hitung mundur. Saat waktu akhir tercapai, store menandai sesi `SELESAI`, menyimpan `leftAt`/`endedAt`, menghentikan media tracks, lalu membuka halaman Ujian Selesai.
- Keluar sebelum waktu akhir meminta konfirmasi, menghentikan media, dan menandai `Keluar Sebelum Selesai` dengan `leftAt`.

## Catatan prototype

Kamera dan mikrofon dipertahankan halaman peserta; Station Demo A-01 dapat mengirim stream WebRTC tanpa merekam. Signaling dan presence berjalan di memori server demo, memakai STUN publik tanpa TURN, sehingga koneksi lintas jaringan tidak dijamin stabil. Runtime store serta master/assignment Admin masih lokal per browser/origin; signaling presence hanya menyediakan status kamera/session ringan untuk demo lintas perangkat. Browser dapat menurunkan prioritas atau menangguhkan tab; timer peserta akan mengejar waktu akhir saat halaman berjalan kembali, tetapi prototype tidak menjamin monitoring terus berlangsung ketika tab ditangguhkan atau browser ditutup.

Halaman lama di `pages/student/`, halaman proctor lama selain placeholder, `assets/js/webrtc.js`, dan signaling `server.js` tetap disimpan sebagai referensi prototype terdahulu. Flow baru tidak memanggil fitur tersebut. Data station/event lama di store juga dipertahankan agar alur demo sebelumnya tidak terhapus.
