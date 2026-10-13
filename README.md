# UjiGuard

UjiGuard adalah prototipe lokal untuk membantu pengawas ujian CBT luring melihat meja yang perlu diperiksa. Indikasi memberi konteks awal; pengawas tetap memeriksa langsung dan mencatat hasilnya. UjiGuard tidak memutuskan peserta curang.

## Masalah dan pengguna

Dalam ujian luring, pengawas perlu mengetahui meja mana yang membutuhkan perhatian tanpa harus memantau setiap peserta melalui dashboard yang rumit. Pengguna utama prototipe ini adalah pengawas ujian. Halaman station merupakan station demo teknis, bukan layar peserta untuk menampilkan skor atau vonis.

## Scope MVP

Satu station demo dapat membuka kamera lokal, satu indikator visual diperiksa, meja terkait ditandai, lalu pengawas mencatat tindak lanjut. Indikator tunggalnya adalah wajah tidak terdeteksi selama lima detik, melalui Face Detection API bawaan browser. Tidak ada video yang direkam atau dikirim. API ini belum tersedia di semua browser. Jika browser tidak mendukungnya, UI menyatakan bahwa deteksi tidak berjalan.

## Fitur yang bekerja

- Login demo peran pengawas dan station.
- Dashboard dengan ringkasan peserta aktif dan status meja normal, perlu dipantau, atau perlu ditinjau.
- Monitor Ruangan berbentuk peta meja dengan detail peserta, indikasi terakhir, waktu, riwayat, dan status pemeriksaan.
- Tindakan pengawas: Pantau, Periksa Langsung, Tandai Aman, dan Catat Pelanggaran setelah pemeriksaan langsung.
- Penyimpanan lokal, filter riwayat, dan ekspor CSV.
- Deteksi wajah lokal hanya pada browser yang mendukung `FaceDetector`; status dan indikasi disimpan sebagai metadata di `localStorage`.

## Simulasi dan roadmap

Data stasiun awal adalah data demo. Peran login dikelola di frontend. Data station dan indikasi tersimpan di `localStorage`, sehingga perubahan hanya berbagi pada origin/browser yang sama; tidak ada sinkronisasi lintas perangkat. Roadmap: backend dengan kontrol akses yang sesuai, dukungan deteksi yang teruji pada perangkat sasaran, kebijakan retensi metadata, dan pengujian aksesibilitas serta akurasi. Roadmap belum diimplementasikan.

Tidak termasuk MVP: hand-to-ear, RF detection, gaze tracking, face recognition, klasifikasi audio, multi-camera, berbagai CCTV, atau skor/probabilitas kecurangan.

## Menjalankan lokal

1. Ekstrak folder project dan buka terminal di folder `UjiGuard_Submission`.
2. Pastikan Python 3 tersedia.
3. Jalankan server statis:
   - Windows: `py -m http.server 8000`
   - macOS/Linux: `python3 -m http.server 8000`
4. Buka `http://localhost:8000`.
5. Login menggunakan salah satu akun demo:

| Peran | Email | Kata sandi |
|---|---|---|
| Pengawas | `pengawas@ujiguard.demo` | `UjiGuard2026!` |
| Station demo | `station@ujiguard.demo` | `UjiGuard2026!` |

Kamera memerlukan izin browser dan secure context (localhost dapat digunakan). Untuk indikator otomatis, browser harus menyediakan Face Detection API eksperimental `FaceDetector`.

## Mencoba skenario utama

1. Login sebagai panitia station demo, buka Monitor Ruangan, pilih **Buka Station Demo**, lalu aktifkan webcam pada tab station.
2. Jika browser mendukung Face Detection API, arahkan kamera ke wajah lalu tutupi/keluarkan wajah dari bingkai selama lebih dari lima detik.
3. Di tab pengawas, mulai monitoring setelah status Station Demo terhubung. Jalankan **Skenario Indikasi** untuk mencoba alur tinjauan tanpa bergantung pada dukungan deteksi browser.
4. Pilih **Periksa Langsung**, kemudian **Tandai Aman** atau **Catat Pelanggaran** setelah pemeriksaan demo.
5. Periksa hasilnya di **Riwayat Pemeriksaan**.

Jika Face Detection API tidak didukung, alur pendeteksian tidak dapat dicoba pada browser tersebut; halaman memberi tahu bahwa deteksi tidak berjalan. Jangan gunakan tombol atau data demo sebagai bukti kejadian nyata.

## Struktur folder

- `index.html`: pengarah ke login.
- `pages/login/`: login demo.
- `pages/proctor/`: dashboard, Perlu Diperiksa/Riwayat Pemeriksaan, sesi, dan Monitor Ruangan.
- `pages/student/`: station demo dengan kamera lokal dan indikator terbatas.
- `assets/css/`: token tema; `assets/js/store.js`: data demo dan penyimpanan lokal; `assets/js/nav.js`: navigasi/profil.
- `docs/`: concept paper dan tutorial yang menyertai project.

## Keterbatasan

- Login hanya validasi frontend dan bukan autentikasi aman.
- Tidak ada backend, database, streaming, atau sinkronisasi antarperangkat.
- Face Detection API tidak tersedia secara konsisten. Deteksi dapat keliru karena pencahayaan, posisi, dan dukungan browser; kejadian perlu diperiksa pengawas.
- Hanya metadata kejadian yang disimpan; tidak ada snapshot atau video.
- Status station awal merupakan data contoh, bukan perangkat yang terhubung sungguhan.
- Sistem tidak menentukan kecurangan dan tidak menggantikan prosedur ujian.

## Troubleshooting

- **Halaman kosong / kamera tak bisa diakses:** jalankan server dari folder root dan buka `http://localhost:8000`; akses melalui `file://` dapat menghalangi kamera.
- **Browser meminta izin kamera:** pilih Izinkan dan pastikan kamera tidak sedang dipakai aplikasi lain.
- **Deteksi tidak tersedia:** browser belum menyediakan `FaceDetector`; skenario otomatis tidak berjalan pada browser itu.
- **Perubahan tidak muncul antar tab:** gunakan origin dan profil browser yang sama, lalu muat ulang halaman.
- **Data demo lama:** hapus data situs/local storage untuk `localhost:8000`, lalu muat ulang.

## Alur demo 3–5 menit

1. **0:00–0:45** Login sebagai pengawas dan jelaskan tiga status meja.
2. **0:45–1:30** Buka Monitor Ruangan dan tunjukkan peta meja serta Detail Indikasi.
3. **1:30–2:30** Buka station demo di tab lain, aktifkan kamera; uji indikator jika API didukung.
4. **2:30–3:30** Kembali ke pengawas, pilih meja yang ditandai, lalu lakukan pemeriksaan langsung.
5. **3:30–4:30** Catat hasil aman atau pelanggaran, lalu tunjukkan Riwayat Pemeriksaan.
6. **4:30–5:00** Tegaskan bahwa indikasi bukan vonis dan keputusan tetap pada pengawas.

