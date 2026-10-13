(function () {
  "use strict";
  const user = UjiStore.requireRole("proctor");
  if (!user) return;
  const esc = UjiStore.esc;
  const pagePath = location.pathname.split("/").pop();
  const current = window.UjiGuardPage || (pagePath === "incidents.html" ? "incidents" : pagePath === "sessions.html" ? "sessions" : pagePath === "camera-monitor.html" ? "camera-monitor" : "dashboard");
  document.querySelectorAll("[data-nav]").forEach((a) => { if (a.dataset.nav === current) a.classList.add("active"); });
  document.getElementById("mobile-menu")?.addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("open"));
  const priorities = { high: "TINGGI", medium: "SEDANG", low: "RENDAH" };
  const statusText = { new: "Perlu Ditinjau", review: "Sedang Dipantau", onsite: "Dalam Pemeriksaan", resolved: "Selesai" };
  const svg = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>';
  const deskEvents = (data, id) => data.events.filter((event) => event.sessionId === id);
  function badge(status) {
    const cls = status === "new" ? "tag-red" : status === "review" ? "tag-amber" : status === "onsite" ? "tag-blue" : "tag-green";
    return `<span class="tag ${cls}">${esc(statusText[status] || status)}</span>`;
  }
  function sourceLabel(event) { return event.isSimulation ? "Data Simulasi" : event.label || event.source || "Deteksi lokal"; }
  function wireScenarioButtons() {
    document.getElementById("run-demo-scenario")?.addEventListener("click", () => { UjiStore.runDemoScenario(); UjiStore.toast("Skenario indikasi A-03 dibuat sebagai Data Simulasi."); });
    document.getElementById("reset-demo")?.addEventListener("click", () => { UjiStore.resetDemo(); UjiStore.toast("Skenario demo dikembalikan ke kondisi awal."); });
  }
  function renderDashboard() {
    const data = UjiStore.get();
    const stations = data.sessions;
    const connected = stations.filter((s) => UjiStore.cameraConnected(s)).length;
    const simulation = stations.filter((s) => s.stationType === "simulation").length;
    const review = stations.filter((s) => s.attentionStatus === "Perlu Ditinjau").length;
    const status = document.getElementById("dashboard-session-status");
    if (status) { status.textContent = data.monitoring.active ? "Monitoring Aktif" : "Persiapan Sesi"; status.className = `tag ${data.monitoring.active ? "tag-green" : "tag-gray"}`; }
    document.getElementById("dashboard-cta").textContent = data.monitoring.active ? "Buka Monitor Ruangan" : "Siapkan Sesi";
    document.getElementById("dashboard-cta").href = "camera-monitor.html";
    document.getElementById("metric-total").textContent = stations.length;
    document.getElementById("metric-demo-connected").textContent = `${connected}/${stations.length}`;
    document.getElementById("metric-simulation").textContent = simulation;
    document.getElementById("metric-new").textContent = review;
    document.getElementById("side-new-count").textContent = data.events.filter((e) => e.status === "new").length;
    const events = data.events.slice(0, 5);
    document.getElementById("recent-table").innerHTML = events.map((event) => { const recentCount = data.events.filter((item) => item.sessionId === event.sessionId && Date.now() - item.time <= 300000).length; const repeat = event.status === "new" && recentCount > 1 ? `<br><small class="muted">${recentCount} indikator dalam 5 menit</small>` : ""; return `<tr><td>${UjiStore.fmt(event.time)}</td><td><strong>${esc(event.desk)}</strong></td><td>${esc(event.title)}${repeat}</td><td>${event.isSimulation ? '<span class="tag tag-blue">Data Simulasi</span>' : esc(sourceLabel(event))}</td><td>${badge(event.status)}</td></tr>`; }).join("");
    document.getElementById("dashboard-activity-empty").classList.toggle("hide", events.length > 0);
    document.getElementById("station-grid").innerHTML = stations.map((s) => `<a class="station ${s.attentionStatus === "Perlu Ditinjau" ? "flagged" : ""}" href="camera-monitor.html"><div class="station-top"><span class="station-code">${esc(s.desk)}</span><span class="station-dot"></span></div><div class="station-name">${esc(s.name.split(" ")[0])}</div><div class="station-caption">${esc(s.attentionStatus)}</div></a>`).join("");
  }
  let selectedId = null;
  function renderIncidents() {
    const data = UjiStore.get();
    const search = (document.getElementById("search-incidents").value || "").toLowerCase();
    const priority = document.getElementById("filter-priority").value;
    const status = document.getElementById("filter-status").value;
    const type = document.getElementById("filter-type").value;
    const order = { new: 0, onsite: 1, review: 2, resolved: 3 };
    const rows = data.events.filter((e) => (priority === "all" || e.priority === priority) && (status === "all" || e.status === status) && (type === "all" || e.type === type) && [e.student, e.desk, e.id, e.title, e.sessionId, e.source, e.label].join(" ").toLowerCase().includes(search)).sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4) || b.time - a.time);
    document.getElementById("incident-count").textContent = `${rows.length} indikasi ditemukan - ${data.events.filter((e) => e.status === "new").length} perlu ditinjau`;
    document.getElementById("side-new-count").textContent = data.events.filter((e) => e.status === "new").length;
    document.getElementById("incidents-empty").classList.toggle("hide", rows.length > 0);
    document.getElementById("incidents-table").innerHTML = rows.map((e) => { const recentCount = data.events.filter((item) => item.sessionId === e.sessionId && Date.now() - item.time <= 300000).length; const repeat = e.status === "new" && recentCount > 1 ? `<br><small class="muted">${recentCount} indikator dalam 5 menit</small>` : ""; return `<tr data-select-event="${esc(e.id)}" style="cursor:pointer;background:${selectedId === e.id ? "#f4fbf6" : ""}"><td>${UjiStore.fmt(e.time)}<br><small class="muted">${esc(e.id)}</small></td><td><strong>${esc(e.student)}</strong><br><small class="muted">Meja ${esc(e.desk)} - ${esc(e.participantNo || "")}</small></td><td>${esc(e.title)}${repeat}<br><small class="muted">${esc(sourceLabel(e))}</small></td><td><span class="priority ${esc(e.priority)}">${priorities[e.priority] || esc(e.priority)}</span></td><td>${badge(e.status)}</td></tr>`; }).join("");
    document.querySelectorAll("[data-select-event]").forEach((row) => row.addEventListener("click", () => { selectedId = row.dataset.selectEvent; renderIncidents(); renderDetail(); }));
    if (selectedId && !data.events.some((e) => e.id === selectedId)) selectedId = null;
    renderDetail();
  }
  function renderDetail() {
    const panel = document.getElementById("detail-panel");
    if (!selectedId) { panel.innerHTML = '<div class="detail-placeholder"><div class="detail-symbol placeholder-symbol" aria-hidden="true"></div><strong>Pilih sebuah indikasi</strong><p>Pilih baris di sebelah kiri untuk melihat alasan dan tindak lanjut.</p></div>'; return; }
    const event = UjiStore.get().events.find((e) => e.id === selectedId); if (!event) return;
    const simulationNote = event.isSimulation ? '<div class="notice-band" style="margin:12px 0"><b>Data Simulasi.</b> Event ini dibuat oleh Skenario Demo, bukan hasil deteksi kamera.</div>' : "";
    const repeatCount = UjiStore.get().events.filter((item) => item.sessionId === event.sessionId && Date.now() - item.time <= 300000).length;
    const repeatNote = event.status === "new" && repeatCount > 1 ? `<div class="notice-band" style="margin:12px 0">${repeatCount} indikator dalam 5 menit pada station ini.</div>` : "";
    const actions = event.status === "new" || event.status === "review" ? `<button class="btn btn-primary" id="mark-review">Lanjut Pantau</button><button class="btn btn-light" id="request-onsite">Periksa Langsung</button>` : event.status === "onsite" ? `<button class="btn btn-light" id="resolve-event">Tandai Aman</button><button class="btn btn-danger" id="record-violation">Catat Pelanggaran</button>` : "";
    panel.innerHTML = `<div class="eyebrow">DETAIL INDIKASI / ${esc(event.id)}</div><div class="detail-symbol">${svg}</div>${badge(event.status)}<h3>${esc(event.title)}</h3><p>${esc(event.detail)}</p>${simulationNote}${repeatNote}<div class="detail-meta"><div><span>Peserta</span><b>${esc(event.student)}</b></div><div><span>Nomor Peserta</span><b>${esc(event.participantNo || "-")}</b></div><div><span>Nomor Meja</span><b>${esc(event.desk)}</b></div><div><span>Waktu</span><b>${UjiStore.fmtLong(event.time)}</b></div><div><span>Sumber</span><b>${esc(sourceLabel(event))}</b></div><div><span>Status perhatian</span><b>${esc(statusText[event.status] || event.status)}</b></div><div><span>Catatan pemeriksaan</span><b>${esc(event.note || "Belum ada")}</b></div></div><div class="notice-band" style="margin-bottom:12px">Indikasi adalah sinyal untuk diperiksa dan bukan bukti pelanggaran.</div><div class="detail-actions">${actions}</div>`;
    document.getElementById("mark-review")?.addEventListener("click", () => change("review", "Pengawas sudah meninjau dan memilih untuk melanjutkan pemantauan."));
    document.getElementById("request-onsite")?.addEventListener("click", () => change("onsite", "Pengawas memeriksa langsung di ruangan."));
    document.getElementById("resolve-event")?.addEventListener("click", () => change("resolved", "Meja ditandai aman setelah pemeriksaan langsung."));
    document.getElementById("record-violation")?.addEventListener("click", () => {
      const latest = UjiStore.get().events.find((e) => e.id === selectedId);
      if (latest.status !== "onsite") { UjiStore.toast("Pilih Periksa Langsung sebelum mencatat pelanggaran."); return; }
      UjiStore.updateEvent(selectedId, { status: "resolved", note: "Pelanggaran dicatat setelah pemeriksaan langsung.", reviewedBy: user.name, violation: true });
      UjiStore.toast("Hasil pemeriksaan dicatat di riwayat.");
    };
  }
  function change(status, note) { UjiStore.updateEvent(selectedId, { status, note, reviewedBy: user.name }); UjiStore.toast("Status diperbarui: " + statusText[status]); }
  function renderStations() {
    const data = UjiStore.get();
    const query = (document.getElementById("search-stations").value || "").toLowerCase();
    const rows = data.sessions.filter((s) => [s.desk, s.name, s.participantNo, s.id].join(" ").toLowerCase().includes(query));
    document.getElementById("station-total").textContent = data.sessions.length;
    document.getElementById("station-connected").textContent = `${data.sessions.filter((s) => UjiStore.cameraConnected(s)).length}/${data.sessions.length}`;
    document.getElementById("station-simulation").textContent = data.sessions.filter((s) => s.stationType === "simulation").length;
    document.getElementById("station-review").textContent = data.sessions.filter((s) => s.attentionStatus === "Perlu Ditinjau").length;
    document.getElementById("stations-empty").classList.toggle("hide", rows.length > 0);
    document.getElementById("stations-table").innerHTML = rows.map((s) => {
      const recent = deskEvents(data, s.id).filter((e) => Date.now() - e.time <= 300000);
      const indicator = s.lastIndicator ? `${recent.length > 1 ? `${recent.length} indikator dalam 5 menit - ` : ""}${esc(s.lastIndicator)}${s.lastIndicator && recent[0]?.isSimulation ? " (Data Simulasi)" : ""}` : "-";
      const kind = s.stationType === "real-demo" ? "Station Demo" : "Data Simulasi";
      return `<tr><td><strong>${esc(s.desk)}</strong></td><td>${esc(s.name)}</td><td>${esc(s.participantNo)}</td><td>${kind}</td><td>${esc(s.cameraStatus)}</td><td>${esc(s.monitoringStatus)}</td><td>${esc(s.attentionStatus)}</td><td>${indicator}</td></tr>`;
    }).join("");
  }
  function exportEvents() {
    const data = UjiStore.get();
    const lines = [["ID", "Waktu", "Peserta", "Nomor Peserta", "Meja", "Indikasi", "Sumber", "Status", "Catatan"], ...data.events.map((e) => [e.id, new Date(e.time).toISOString(), e.student, e.participantNo || "", e.desk, e.title, sourceLabel(e), statusText[e.status] || e.status, e.note || ""])];
    const csv = lines.map((row) => row.map((item) => '"' + String(item ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); link.download = "ujiguard-riwayat-demo.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  if (current === "dashboard") { wireScenarioButtons(); renderDashboard(); }
  if (current === "sessions") { wireScenarioButtons(); document.getElementById("search-stations").addEventListener("input", renderStations); renderStations(); }
  if (current === "incidents") {
    ["search-incidents", "filter-priority", "filter-status", "filter-type"].forEach((id) => document.getElementById(id).addEventListener("input", renderIncidents));
    document.getElementById("export-csv").addEventListener("click", exportEvents); renderIncidents();
  }
  function refresh() { if (current === "dashboard") renderDashboard(); if (current === "sessions") renderStations(); if (current === "incidents") renderIncidents(); }
  window.addEventListener("storage", (event) => { if (event.key === UjiStore.KEY) refresh(); });
  window.addEventListener("ujiguard:updated", refresh);
  window.setInterval(refresh, 3000);
})();
