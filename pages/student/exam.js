(function () {
  "use strict";
  var QUESTIONS = [
    { q: "Sistem informasi pada dasarnya merupakan kombinasi dari …", options: ["Perangkat keras, perangkat lunak, data, prosedur, dan manusia", "Hanya perangkat keras dan jaringan", "Hanya aplikasi dan database", "Server, kabel, dan listrik"] },
    { q: "Komponen sistem informasi yang berupa aturan dan tata cara kerja disebut …", options: ["Prosedur", "Perangkat keras", "Database", "Jaringan"] },
    { q: "Perbedaan utama data dan informasi adalah …", options: ["Informasi adalah data yang telah diolah dan bermakna", "Data selalu berbentuk angka", "Informasi tidak membutuhkan data", "Keduanya hal yang sama"] },
    { q: "Kumpulan data yang terorganisasi dan mudah diakses disebut …", options: ["Arsip kertas", "Database", "Spreadsheet acak", "Catatan manual"] },
    { q: "Primary key pada tabel database berfungsi sebagai …", options: ["Pengenal unik setiap baris data", "Kata sandi pengguna", "Nama tabel", "Ukuran file database"] },
    { q: "Diagram yang menggambarkan entitas beserta relasinya adalah …", options: ["DFD", "Flowchart", "ERD", "Use case"] },
    { q: "DFD (Data Flow Diagram) digunakan untuk menggambarkan …", options: ["Aliran data dalam sistem", "Struktur organisasi", "Jadwal proyek", "Anggaran biaya"] },
    { q: "Tahap pertama dalam SDLC model waterfall adalah …", options: ["Pengodean", "Analisis kebutuhan", "Pengujian", "Pemeliharaan"] },
    { q: "Pengujian black-box berfokus pada …", options: ["Struktur kode program", "Fungsi dan keluaran tanpa melihat kode", "Kecepatan prosesor", "Desain kemasan"] },
    { q: "Tujuan normalisasi dalam perancangan database adalah …", options: ["Menambah duplikasi data", "Mengurangi redundansi data", "Memperlambat query", "Menghapus seluruh relasi"] },
    { q: "Perintah SQL yang digunakan untuk menampilkan data adalah …", options: ["DELETE", "UPDATE", "SELECT", "DROP"] },
    { q: "Jaringan komputer dalam satu gedung atau kampus disebut …", options: ["WAN", "Internet", "LAN", "VPN"] },
    { q: "Layanan komputasi melalui internet dengan bayar sesuai pakai disebut …", options: ["Cloud computing", "Mainframe", "Intranet", "Firmware"] },
    { q: "Upaya memperoleh data pribadi dengan menyamar disebut …", options: ["Phishing", "Browsing", "Caching", "Streaming"] },
    { q: "Salinan cadangan data untuk antisipasi kehilangan disebut …", options: ["Backup", "Virus", "Spam", "Cache"] },
    { q: "Simbol belah ketupat pada flowchart menyatakan …", options: ["Proses", "Keputusan/percabangan", "Mulai/selesai", "Input/output"] },
    { q: "Metode pengembangan perangkat lunak yang menekankan iterasi cepat dan umpan balik adalah …", options: ["Waterfall", "Agile", "Big bang", "Code and fix"] },
    { q: "Tahap pemeliharaan (maintenance) dilakukan …", options: ["Sebelum analisis", "Setelah sistem digunakan", "Bersamaan pengodean", "Tidak pernah"] },
    { q: "Antarmuka yang memudahkan pengguna berinteraksi dengan sistem disebut …", options: ["UI/UX", "CPU", "RAM", "BIOS"] },
    { q: "Contoh informasi yang berkualitas bagi pengambil keputusan adalah …", options: ["Akurat, tepat waktu, dan relevan", "Banyak, acak, dan terlambat", "Singkat tanpa konteks", "Rahasia dan tidak dibagikan"] },
  ];
  var TOTAL = QUESTIONS.length;
  var answers = new Array(TOTAL).fill(null);
  var index = 0;
  var remain = 59 * 60 + 42;
  var LETTERS = ["A", "B", "C", "D"];

  function $(id) { return document.getElementById(id); }
  function fmt(s) {
    var m = Math.floor(s / 60), sec = s % 60;
    return (m < 10 ? "0" + m : "" + m) + ":" + (sec < 10 ? "0" + sec : "" + sec);
  }
  function renderGrid() {
    var grid = $("cbt-grid");
    grid.innerHTML = "";
    for (var i = 0; i < TOTAL; i++) {
      (function (n) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = n + 1;
        b.className = "cbt-num" + (n === index ? " is-current" : "") + (answers[n] !== null ? " is-answered" : "");
        b.setAttribute("aria-label", "Soal " + (n + 1));
        b.addEventListener("click", function () { index = n; render(); });
        grid.appendChild(b);
      })(i);
    }
  }
  function render() {
    var item = QUESTIONS[index];
    $("cbt-qpos").textContent = "Soal " + (index + 1) + " dari " + TOTAL;
    $("cbt-qtext").textContent = item.q;
    var box = $("cbt-options");
    box.innerHTML = "";
    item.options.forEach(function (text, n) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cbt-opt" + (answers[index] === n ? " is-picked" : "");
      b.innerHTML = "<b>" + LETTERS[n] + "</b><span></span>";
      b.querySelector("span").textContent = text;
      b.addEventListener("click", function () { answers[index] = n; render(); });
      box.appendChild(b);
    });
    var done = answers.filter(function (a) { return a !== null; }).length;
    $("cbt-answered").textContent = done + "/" + TOTAL + " terjawab";
    $("cbt-prev").disabled = index === 0;
    $("cbt-next").disabled = index === TOTAL - 1;
    renderGrid();
  }
  $("cbt-prev").addEventListener("click", function () { if (index > 0) { index--; render(); } });
  $("cbt-next").addEventListener("click", function () { if (index < TOTAL - 1) { index++; render(); } });
  $("cbt-timer").textContent = fmt(remain);
  render();
  var timer = setInterval(function () {
    if (remain <= 0) {
      clearInterval(timer);
      $("cbt-timeup").hidden = false;
      return;
    }
    remain--;
    $("cbt-timer").textContent = fmt(remain);
  }, 1000);
})();
