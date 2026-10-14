(function () {
  "use strict";
  const session = window.UjiStore.getParticipantSession(window.UjiAuth.currentUser()?.id);
  const endedEarly = session?.monitoringStatus === "Keluar Sebelum Selesai";
  document.getElementById("finished-title").textContent = endedEarly ? "Anda keluar sebelum sesi selesai" : "Ujian selesai";
  document.getElementById("finished-message").textContent = endedEarly
    ? "Sesi ditandai keluar sebelum waktu selesai. Kamera dan mikrofon telah dihentikan."
    : "Waktu sesi telah berakhir. Monitoring dan perangkat sesi telah dihentikan.";
  document.getElementById("finished-name").textContent = session?.name || "-";
  document.getElementById("finished-id").textContent = session?.participantId || "-";
  document.getElementById("finished-status").textContent = session?.monitoringStatus || "-";
  const timestamp = session?.endedAt || session?.leftAt;
  document.getElementById("finished-time").textContent = timestamp
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(timestamp))
    : "-";
})();
