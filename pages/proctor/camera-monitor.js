(function () {
  "use strict";
  const user = UjiStore.requireRole("proctor");
  if (!user) return;
  const $ = (id) => document.getElementById(id);
  const esc = UjiStore.esc;
  const connected = (s) => UjiStore.cameraConnected(s);
  const cameraLabel = (s) =>
    s.stationType === "simulation" ? "Tidak terhubung" : s.cameraStatus;
  const eventStatus = {
    new: "Perlu Ditinjau",
    review: "Sedang Dipantau",
    onsite: "Dalam Pemeriksaan",
    resolved: "Selesai",
  };
  let selectedId = null;
  let cameraViewStationId = null;
  let rtcClient = null;
  let cameraRemoteStream = null;
  let cameraStreamStatus = "closed";
  let cameraStreamError = "";
  let remoteCameraReady = false;
  function render() {
    const data = UjiStore.get();
    const stations = data.sessions
      .slice()
      .sort((a, b) => a.desk.localeCompare(b.desk));
    const demo = stations.filter((s) => s.stationType === "real-demo");
    const simulations = stations.filter((s) => s.stationType === "simulation");
    const activeDemo = demo.filter(connected).length;
    const needsReview = stations.filter(
      (s) => s.attentionStatus === "Perlu Ditinjau",
    ).length;
    const monitoring = data.monitoring || { active: false };
    $("monitoring-session-status").textContent = monitoring.active
      ? "Monitoring Aktif"
      : "Persiapan Sesi";
    $("monitoring-session-status").className =
      `tag ${monitoring.active ? "tag-green" : "tag-gray"}`;
    $("start-monitoring").textContent = monitoring.active
      ? "Akhiri Monitoring"
      : "Mulai Monitoring";
    $("start-monitoring").disabled = !monitoring.active && activeDemo === 0;
    $("cam-metric-ready").textContent = monitoring.active
      ? "Monitoring Aktif"
      : "Persiapan";
    $("cam-metric-session-foot").textContent = monitoring.active
      ? `Dimulai ${UjiStore.fmt(monitoring.startedAt)}`
      : "Siapkan station sebelum sesi dimulai";
    $("cam-metric-review").textContent = `${activeDemo}/${stations.length}`;
    $("cam-metric-offline").textContent = needsReview;
    $("cam-metric-total").textContent = simulations.length;
    $("readiness-summary").textContent =
      `${activeDemo}/${stations.length} station terhubung. ${simulations.length} station lain adalah data simulasi. ${monitoring.active ? "Monitoring aktif; pengawas dapat meninjau indikasi." : activeDemo ? "Monitoring dapat dimulai." : "Buka Station Demo dan siapkan kamera untuk mencoba monitoring."}`;
    $("readiness-list").innerHTML = stations
      .map(
        (s) =>
          `<span class="readiness-chip ${connected(s) ? "is-ready" : s.stationType === "simulation" ? "" : s.cameraStatus === "Bermasalah" ? "is-broken" : ""}"><b>${esc(s.desk)}</b> ${s.stationType === "simulation" ? "Data Simulasi" : cameraLabel(s)}</span>`,
      )
      .join("");
    const query = $("search-stations").value.trim().toLocaleLowerCase("id");
    const visibleStations = stations.filter((s) =>
      `${s.desk} ${s.name} ${s.participantNo}`
        .toLocaleLowerCase("id")
        .includes(query),
    );
    $("camera-grid").innerHTML = visibleStations
      .map((s) => {
        const status = s.attentionStatus;
        const cls =
          status === "Perlu Ditinjau"
            ? "needs-review"
            : status === "Dalam Pemeriksaan"
              ? "in-review"
              : "";
        const kind =
          s.stationType === "real-demo" ? "Station Demo" : "Data Simulasi";
        return `<button class="camera-card ${cls} ${selectedId === s.id ? "selected" : ""}" type="button" data-desk="${esc(s.id)}" aria-pressed="${selectedId === s.id}"><div class="camera-card-top"><span class="camera-desk">Nomor Meja ${esc(s.desk)}</span><span class="camera-badge ${connected(s) ? "ready" : status === "Perlu Ditinjau" ? "review" : "offline"}">${status}</span></div><div class="camera-card-bottom"><div class="camera-person-line"><span class="camera-person-avatar" aria-hidden="true">${esc(
          s.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join(""),
        )}</span><span class="camera-person-copy"><strong>${esc(s.name)}</strong><small>Nomor Peserta ${esc(s.participantNo)}</small></span></div><div class="station-connection"><span class="station-kind">${kind}</span><strong>${connected(s) ? "Kamera Aktif" : s.stationType === "simulation" ? "Kamera tidak terhubung" : cameraLabel(s)}</strong></div></div></button>`;
      })
      .join("");
    $("camera-empty").classList.toggle("hide", visibleStations.length > 0);
    $("camera-result-count").textContent = query
      ? `${visibleStations.length} dari ${stations.length} station`
      : `${stations.length} station · 1 Station Demo, ${simulations.length} data simulasi`;
    document.querySelectorAll("[data-desk]").forEach((button) =>
      button.addEventListener("click", () => {
        const nextId = button.dataset.desk;
        if (cameraViewStationId && nextId !== cameraViewStationId) {
          const activeRtc = rtcClient;
          rtcClient = null;
          cameraViewStationId = null;
          cameraRemoteStream = null;
          cameraStreamStatus = "closed";
          cameraStreamError = "";
          activeRtc?.close();
        }
        selectedId = nextId;
        render();
        detail(selectedId);
      }),
    );
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
    const kind =
      s.stationType === "real-demo" ? "Station Demo" : "Data Simulasi";
    const pending = events.find((event) => event.status !== "resolved");
    const recentCount = events.filter(
      (event) => Date.now() - event.time <= 300000,
    ).length;
    const repeatNote =
      recentCount > 0
        ? `<span class="detail-count">${recentCount} indikator dalam 5 menit</span>`
        : "";
    const actions = !pending
      ? ""
      : pending.status === "new" || pending.status === "review"
        ? `<button class="btn btn-light" data-act="review">Lanjut Pantau</button><button class="btn btn-primary" data-act="onsite">Periksa Langsung</button>`
        : `<button class="btn btn-light" data-act="resolved">Tandai Aman</button><button class="btn btn-danger" data-act="violation">Catat Pelanggaran</button>`;
    const inspectionStatus = pending
      ? eventStatus[pending.status]
      : last
        ? "Selesai"
        : "Belum ada pemeriksaan";
    const cameraUnavailable = s.stationType === "simulation";
    const cameraReady =
      connected(s) || (s.desk === "A-01" && remoteCameraReady);
    const canViewCamera =
      !cameraUnavailable && s.desk === "A-01" && cameraReady;
    const cameraMessage = cameraUnavailable
      ? "Kamera tidak tersedia pada station simulasi"
      : canViewCamera
        ? "Kamera Demo terhubung"
        : cameraLabel(s);
    const cameraOpen = cameraViewStationId === id;
    const reviewMeta = last?.reviewedBy
      ? `<small class="detail-human-review">Ditinjau oleh ${esc(last.reviewedBy)}</small>`
      : "";
    $("camera-detail-panel").innerHTML = `<div class="card-pad detail-card-pad">
      <header class="detail-heading"><div><div class="eyebrow">DETAIL STATION</div><h2>Meja ${esc(s.desk)}</h2></div><span class="station-kind">${kind}</span></header>
      <section class="detail-section participant-section"><strong class="detail-name">${esc(s.name)}</strong><span>Nomor Peserta ${esc(s.participantNo)}</span></section>
      <section class="detail-section"><h3>Status station</h3><div class="detail-status-grid"><div><span>Kamera</span><b>${esc(cameraReady ? "Kamera Aktif" : cameraLabel(s))}</b></div><div><span>Monitoring</span><b>${esc(s.monitoringStatus)}</b></div><div><span>Perhatian</span><b class="attention-${status === "Normal" ? "normal" : "review"}">${esc(status)}</b></div></div></section>
      <section class="detail-section latest-indicator"><h3>Indikator terakhir</h3>${last ? `<strong>${esc(last.title)}</strong><div class="detail-indicator-meta"><span>${esc(UjiStore.fmtLong(last.time))}</span><span>Sumber: ${esc(last.label || last.source || "Deteksi lokal")}</span></div>${last.detail ? `<p>${esc(last.detail)}</p>` : ""}${reviewMeta}${repeatNote}` : `<p class="muted">Belum ada indikator untuk station ini.</p>`}</section>
      <section class="detail-section"><h3>Riwayat indikator <span>${events.length}</span></h3>${events.length ? `<ol class="indicator-timeline">${events.map((event) => `<li><time>${esc(UjiStore.fmt(event.time))}</time><div><strong>${esc(event.title)}</strong><small>${esc(event.label || event.source || "Deteksi lokal")} · ${eventStatus[event.status] || esc(event.status)}</small>${event.note ? `<small class="detail-human-review">Catatan pengawas: ${esc(event.note)}${event.reviewedBy ? ` (oleh ${esc(event.reviewedBy)})` : ""}</small>` : ""}</div></li>`).join("")}</ol>` : `<p class="muted">Belum ada riwayat pemeriksaan.</p>`}</section>
      <section class="detail-section camera-detail-section"><div class="detail-section-title"><h3>Kamera</h3><span class="camera-status-indicator ${canViewCamera ? "is-connected" : ""}">${esc(cameraMessage)}</span></div>${cameraOpen ? `<div class="station-live-frame"><div class="station-live-heading"><span class="live-badge ${cameraStreamStatus === "live" ? "is-live" : ""}">${cameraStreamStatus === "live" ? "LIVE" : cameraStreamStatus === "connecting" ? "MENGHUBUNGKAN" : cameraStreamStatus === "error" ? "TERPUTUS" : "KAMERA"}</span><strong>Meja ${esc(s.desk)} · ${esc(s.name)}</strong></div><video id="station-live-video" autoplay playsinline muted aria-label="Live kamera station ${esc(s.desk)}"></video>${cameraStreamStatus !== "live" ? `<div class="station-live-message" role="status">${esc(cameraStreamError || (cameraStreamStatus === "error" ? "Stream tidak dapat dihubungkan." : "Menunggu stream dari Station Demo A-01…"))}</div>` : ""}</div><button class="btn btn-light btn-sm" id="close-station-camera">Tutup Kamera</button>` : `<button class="btn btn-light btn-sm" id="view-station-camera" ${canViewCamera ? "" : "disabled"}>Lihat Kamera</button>`}</section>
      <section class="detail-section supervisor-actions"><h3>Tindakan pengawas</h3><p class="detail-inspection-status">Status pemeriksaan: <b>${inspectionStatus}</b></p><div class="camera-action-stack">${actions || `<span class="muted">Tidak ada tindakan pemeriksaan yang menunggu.</span>`}</div></section>
      ${cameraUnavailable ? `<p class="muted detail-footnote">Data simulasi tidak memiliki kamera nyata. Semua keputusan pemeriksaan tetap pada pengawas.</p>` : ""}</div>`;
    const liveVideo = $("station-live-video");
    if (liveVideo && cameraRemoteStream) {
      liveVideo.srcObject = cameraRemoteStream;
      liveVideo.play().catch(() => {});
    }
    $("view-station-camera")?.addEventListener("click", () => {
      if (
        s.desk !== "A-01" ||
        s.stationType !== "real-demo" ||
        !(connected(s) || remoteCameraReady) ||
        !window.UjiRtc
      )
        return;
      cameraViewStationId = id;
      cameraStreamStatus = "connecting";
      cameraStreamError = "";
      detail(id);
      rtcClient = UjiRtc.startProctor(
        $("station-live-video"),
        (state, message, stream) => {
          cameraStreamStatus = state;
          cameraStreamError = message || "";
          if (state === "live") cameraRemoteStream = stream;
          if (state === "closed" || state === "error")
            cameraRemoteStream = null;
          detail(id);
        },
      );
      rtcClient.connect();
    });
    $("close-station-camera")?.addEventListener("click", () => {
      const activeRtc = rtcClient;
      rtcClient = null;
      cameraViewStationId = null;
      cameraRemoteStream = null;
      cameraStreamStatus = "closed";
      cameraStreamError = "";
      activeRtc?.close();
      detail(id);
    });
    document.querySelectorAll("[data-act]").forEach((button) =>
      button.addEventListener("click", () => {
        const latest = UjiStore.get().events.find(
          (event) => event.sessionId === id && event.status !== "resolved",
        );
        if (!latest) {
          UjiStore.toast("Belum ada indikasi aktif untuk diperbarui.");
          return;
        }
        const action = button.dataset.act;
        if (action === "violation" && latest.status !== "onsite") {
          UjiStore.toast(
            "Lakukan Periksa Langsung sebelum mencatat pelanggaran.",
          );
          return;
        }
        const changes =
          action === "violation"
            ? {
                status: "resolved",
                note: "Pelanggaran dicatat pengawas setelah pemeriksaan langsung.",
                reviewedBy: user.name,
                violation: true,
              }
            : {
                status: action,
                note:
                  action === "resolved"
                    ? "Meja ditandai aman setelah pemeriksaan langsung."
                    : action === "review"
                      ? "Pengawas sudah meninjau dan memilih untuk melanjutkan pemantauan."
                      : "Pengawas memeriksa langsung di ruangan.",
                reviewedBy: user.name,
              };
        UjiStore.updateEvent(latest.id, changes);
        render();
        detail(id);
      }),
    );
  }
  $("open-station-demo")?.addEventListener("click", () =>
    window.open("../student/exam.html?station-demo=1", "_blank"),
  );
  $("start-monitoring")?.addEventListener("click", () => {
    const current = UjiStore.get().monitoring?.active;
    const next = UjiStore.setMonitoring(!current);
    if (!current && !next) {
      UjiStore.toast("Aktifkan webcam pada Station Demo terlebih dahulu.");
      return;
    }
    UjiStore.toast(
      current ? "Monitoring sesi diakhiri." : "Monitoring Sesi 01 dimulai.",
    );
  });
  $("run-demo-scenario")?.addEventListener("click", () => {
    UjiStore.runDemoScenario();
    UjiStore.toast("Skenario indikasi A-03 dibuat sebagai Data Simulasi.");
  });
  $("reset-demo")?.addEventListener("click", () => {
    UjiStore.resetDemo();
    UjiStore.toast("Skenario dan data demo dikembalikan ke kondisi awal.");
  });
  $("refresh-camera")?.addEventListener("click", render);
  $("search-stations")?.addEventListener("input", render);
  window.addEventListener("storage", (event) => {
    if (event.key === UjiStore.KEY) render();
  });
  window.addEventListener("ujiguard:updated", render);
  window.addEventListener("pageshow", render);
  window.setInterval(render, 3000);
  const refreshCameraPresence = async () => {
    if (!window.UjiRtc) return;
    try {
      const status = await UjiRtc.getStationPresence();
      const next = !!status.online;
      if (next !== remoteCameraReady) {
        remoteCameraReady = next;
        render();
      }
    } catch (_) {}
  };
  refreshCameraPresence();
  window.setInterval(refreshCameraPresence, 2500);
  render();
})();
