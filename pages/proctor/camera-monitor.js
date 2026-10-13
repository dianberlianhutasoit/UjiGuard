(function () {
  "use strict";
  const user = UjiStore.requireRole("proctor");
  if (!user) return;
  const $ = (id) => document.getElementById(id);
  const esc = UjiStore.esc;
  const connected = (s) => UjiStore.cameraConnected(s);
  const cameraLabel = (s) => s.stationType === "simulation" ? "Tidak terhubung" : s.cameraStatus;
  const eventStatus = { new: "Perlu Ditinjau", review: "Sedang Dipantau", onsite: "Dalam Pemeriksaan", resolved: "Selesai" };
  let selectedId = null;
  function render() {
    const data = UjiStore.get();
    const stations = data.sessions.slice().sort((a, b) => a.desk.localeCompare(b.desk));
    const demo = stations.filter((s) => s.stationType === "real-demo");
    const simulations = stations.filter((s) => s.stationType === "simulation");
    const activeDemo = demo.filter(connected).length;
    const needsReview = stations.filter((s) => s.attentionStatus === "Perlu Ditinjau").length;
    const monitoring = data.monitoring || { active: false };
    $("monitoring-session-status").textContent = monitoring.active ? "Monitoring Aktif" : "Persiapan Sesi";
    $("monitoring-session-status").className = `tag ${monitoring.active ? "tag-green" : "tag-gray"}`;
    $("start-monitoring").textContent = monitoring.active ? "Akhiri Monitoring" : "Mulai Monitoring";
    $("start-monitoring").disabled = !monitoring.active && activeDemo === 0;
    $("cam-metric-ready").textContent = monitoring.active ? "Monitoring Aktif" : "Persiapan";
    $("cam-metric-session-foot").textContent = monitoring.active ? `Dimulai ${UjiStore.fmt(monitoring.startedAt)}` : "Siapkan station sebelum sesi dimulai";
    $("cam-metric-review").textContent = `${activeDemo}/${stations.length}`;
    $("cam-metric-offline").textContent = needsReview;
    $("cam-metric-total").textContent = simulations.length;
    $("readiness-summary").textContent = `${activeDemo}/${stations.length} station terhubung. ${simulations.length} station lain adalah data simulasi. ${monitoring.active ? "Monitoring aktif; pengawas dapat meninjau indikasi." : activeDemo ? "Monitoring dapat dimulai." : "Buka Station Demo dan siapkan kamera untuk mencoba monitoring."}`;
    $("readiness-list").innerHTML = stations.map((s) => `<span class="readiness-chip ${connected(s) ? "is-ready" : s.stationType === "simulation" ? "" : s.cameraStatus === "Bermasalah" ? "is-broken" : ""}"><b>${esc(s.desk)}</b> ${s.stationType === "simulation" ? "Data Simulasi" : cameraLabel(s)}</span>`).join("");
    const query = $("search-stations").value.trim().toLocaleLowerCase("id");
    const visibleStations = stations.filter((s) => `${s.desk} ${s.name} ${s.participantNo}`.toLocaleLowerCase("id").includes(query));
    $("camera-grid").innerHTML = visibleStations.map((s) => {
      const status = s.attentionStatus;
      const cls = status === "Perlu Ditinjau" ? "needs-review" : status === "Dalam Pemeriksaan" ? "in-review" : "";
      const kind = s.stationType === "real-demo" ? "Station Demo" : "Data Simulasi";
      return `<button class="camera-card ${cls} ${selectedId === s.id ? "selected" : ""}" type="button" data-desk="${esc(s.id)}" aria-pressed="${selectedId === s.id}"><div class="camera-card-top"><span class="camera-desk">Nomor Meja ${esc(s.desk)}</span><span class="camera-badge ${connected(s) ? "ready" : status === "Perlu Ditinjau" ? "review" : "offline"}">${status}</span></div><div class="camera-card-bottom"><div class="camera-person-line"><span class="camera-person-avatar" aria-hidden="true">${esc(s.name.split(" ").map((part) => part[0]).slice(0, 2).join(""))}</span><span class="camera-person-copy"><strong>${esc(s.name)}</strong><small>Nomor Peserta ${esc(s.participantNo)}</small></span></div><div class="station-connection"><span class="station-kind">${kind}</span><strong>${connected(s) ? "Kamera Aktif" : s.stationType === "simulation" ? "Kamera tidak terhubung" : cameraLabel(s)}</strong></div></div></button>`;
    }).join("");
    $("camera-empty").classList.toggle("hide", visibleStations.length > 0);
    $("camera-result-count").textContent = query ? `${visibleStations.length} dari ${stations.length} station` : `${stations.length} station - 1 Station Demo, ${simulations.length} data simulasi`;
    document.querySelectorAll("[data-desk]").forEach((button) => button.addEventListener("click", () => { selectedId = button.dataset.desk; render(); detail(selectedId); }));
    if (selectedId) detail(selectedId);
  }
  function detail(id) {
    const data = UjiStore.get();
    const s = data.sessions.find((item) => item.id === id);
    if (!s) return;
    selectedId = id;
    const events = data.events.filter((event) => event.sessionId === id);
    const last = events[0];
    const status = s.attentionStatus;
    const kind = s.stationType === "real-demo" ? "Station Demo" : "Data Simulasi";
    const pending = events.find((event) => event.status !== "resolved");
    const recentCount = events.filter((event) => Date.now() - event.time <= 300000).length;
    const repeatNote = status === "Perlu Ditinjau" && recentCount > 1 ? `<p class="notice-band">${recentCount} indikator dalam 5 menit pada station ini.</p>` : "";
    const actions = !pending ? "" : pending.status === "new" || pending.status === "review" ? `<button class="btn btn-light" data-act="review">Lanjut Pantau</button><button class="btn btn-primary" data-act="onsite">Periksa Langsung</button>` : `<button class="btn btn-light" data-act="resolved">Tandai Aman</button><button class="btn btn-danger" data-act="violation">Catat Pelanggaran</button>`;
    const inspectionStatus = pending ? eventStatus[pending.status] : last ? "Selesai" : "Belum ada pemeriksaan";
    $("camera-detail-panel").innerHTML = `<div class="card-pad"><div class="eyebrow">DETAIL STATION</div><h2>Nomor Meja ${esc(s.desk)}</h2><p>Nomor Peserta ${esc(s.participantNo)} - ${esc(s.name)}</p><p><b>Jenis station:</b> ${kind}</p><p><b>Status kamera:</b> ${cameraLabel(s)}</p><p><b>Status monitoring:</b> ${s.monitoringStatus}</p><p><b>Status perhatian:</b> ${status}</p><p><b>Indikator terakhir:</b> ${last ? esc(last.title) : "Belum ada indikator"}</p>${repeatNote}<p><b>Sumber:</b> ${last ? esc(last.label || last.source || "Deteksi lokal") : "-"}</p><p><b>Alasan:</b> ${last ? esc(last.detail) : "Belum ada indikasi."}</p><p><b>Waktu kejadian:</b> ${last ? esc(UjiStore.fmtLong(last.time)) : "-"}</p><p><b>Status pemeriksaan:</b> ${inspectionStatus}</p><h3>Riwayat indikator</h3>${events.length ? events.map((event) => `<p>${esc(UjiStore.fmtLong(event.time))} - ${esc(event.label || event.source || "Deteksi lokal")} - ${esc(event.title)} - ${eventStatus[event.status] || event.status}${event.note ? ` - ${esc(event.note)}` : ""}</p>`).join("") : "<p>Belum ada riwayat pemeriksaan.</p>"}<div class="camera-action-stack">${actions}</div><p class="muted">Data Simulasi bukan deteksi nyata. Semua keputusan pemeriksaan tetap pada pengawas.</p></div>`;
    document.querySelectorAll("[data-act]").forEach((button) => button.addEventListener("click", () => {
      const latest = UjiStore.get().events.find((event) => event.sessionId === id && event.status !== "resolved");
      if (!latest) { UjiStore.toast("Belum ada indikasi aktif untuk diperbarui."); return; }
      const action = button.dataset.act;
      if (action === "violation" && latest.status !== "onsite") { UjiStore.toast("Lakukan Periksa Langsung sebelum mencatat pelanggaran."); return; }
      const changes = action === "violation" ? { status: "resolved", note: "Pelanggaran dicatat pengawas setelah pemeriksaan langsung.", reviewedBy: user.name, violation: true } : { status: action, note: action === "resolved" ? "Meja ditandai aman setelah pemeriksaan langsung." : action === "review" ? "Pengawas sudah meninjau dan memilih untuk melanjutkan pemantauan." : "Pengawas memeriksa langsung di ruangan.", reviewedBy: user.name };
      UjiStore.updateEvent(latest.id, changes); render(); detail(id);
    }));
  }
  $("open-station-demo")?.addEventListener("click", () => window.open("../student/exam.html?station-demo=1", "_blank"));
  $("start-monitoring")?.addEventListener("click", () => {
    const current = UjiStore.get().monitoring?.active;
    const next = UjiStore.setMonitoring(!current);
    if (!current && !next) { UjiStore.toast("Aktifkan webcam pada Station Demo terlebih dahulu."); return; }
    UjiStore.toast(current ? "Monitoring sesi diakhiri." : "Monitoring Sesi 01 dimulai.");
  });
  $("run-demo-scenario")?.addEventListener("click", () => { UjiStore.runDemoScenario(); UjiStore.toast("Skenario indikasi A-03 dibuat sebagai Data Simulasi."); });
  $("reset-demo")?.addEventListener("click", () => { UjiStore.resetDemo(); UjiStore.toast("Skenario dan data demo dikembalikan ke kondisi awal."); });
  $("refresh-camera")?.addEventListener("click", render);
  $("search-stations")?.addEventListener("input", render);
  window.addEventListener("storage", (event) => { if (event.key === UjiStore.KEY) render(); });
  window.addEventListener("ujiguard:updated", render);
  window.addEventListener("pageshow", render);
  window.setInterval(render, 3000);
  render();
})();
