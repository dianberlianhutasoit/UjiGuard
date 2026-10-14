(function () {
  "use strict";
  const user = window.UjiAuth.currentUser();
  if (!user || user.role !== "proctor") { location.replace("../login/index.html"); return; }
  const $ = (id) => document.getElementById(id);
  const esc = window.UjiStore.esc;
  const viewTitles = { dashboard: "Dashboard Pengawas", monitor: "Monitor Peserta", indications: "Indikasi", violations: "Rekap Pelanggaran" };
  let activeView = "dashboard";
  let selectedSessionId = null;
  let selectedParticipantId = null;
  let rtc = null;
  let rtcStatus = "closed";
  let remotePresence = null;
  let presenceTimer = null;
  let violationParticipantId = null;
  const video = $("proctor-video");

  $("proctor-name").textContent = user.name;
  $("proctor-id").textContent = user.id;

  const admin = () => window.UjiAdminStore.get();
  const store = () => window.UjiStore.get();
  function assignedSessions() {
    const data = admin();
    const ids = new Set(data.proctorAssignments.filter((item) => item.proctorId === user.id).map((item) => item.sessionId));
    return data.examSessions.filter((item) => ids.has(item.id)).map((session) => ({
      ...session,
      exam: data.exams.find((exam) => exam.id === session.examId),
      participants: data.participants.filter((participant) => participant.sessionId === session.id),
    }));
  }
  function selectedSession() { return assignedSessions().find((item) => item.id === selectedSessionId) || null; }
  function eventMatches(event, participant) {
    return event.participantId === participant.id || (participant.participantNo && event.participantNo === participant.participantNo) || event.student === participant.name;
  }
  function indicatorsFor(participant) {
    return store().events.filter((event) => eventMatches(event, participant) && (!event.examSessionId || event.examSessionId === participant.sessionId)).sort((a, b) => b.time - a.time);
  }
  function attentionFor(participant) {
    const events = indicatorsFor(participant);
    return events.some((event) => event.status !== "resolved") ? "Ada Indikasi" : "Normal";
  }
  function runtimeFor(participant) {
    const local = store().participantSessions.find((item) => item.participantId === participant.id) || null;
    if (participant.id === "PST-001" && remotePresence?.online && remotePresence.session?.participantId === participant.id) return { ...local, ...remotePresence.session, _remote: true };
    return local;
  }
  function isActive(runtime) { return runtime?.monitoringStatus === "Monitoring Aktif"; }
  function cameraStatus(participant, runtime) {
    if (participant.demoData) return "Data Simulasi";
    if (!runtime) return "Belum Terhubung";
    return runtime.cameraStatus || "Belum Terhubung";
  }
  function microphoneStatus(participant, runtime) {
    if (participant.demoData) return "Data Simulasi";
    if (!runtime) return "Belum Terhubung";
    return runtime.microphoneStatus || "Belum Terhubung";
  }
  function monitoringStatus(participant, runtime) {
    if (participant.demoData) return "Data Simulasi";
    if (!runtime) return "Belum Terhubung";
    return runtime.monitoringStatus || "Belum Terhubung";
  }
  function participantRows() {
    const session = selectedSession();
    return (session?.participants || []).map((participant) => {
      const runtime = runtimeFor(participant);
      const events = indicatorsFor(participant);
      const recent = events.filter((event) => Date.now() - event.time <= 5 * 60 * 1000).length;
      return { participant, runtime, events, recent, attention: attentionFor(participant) };
    });
  }
  function formatTime(value) {
    return value ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
  }
  function fullTime(value) {
    return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
  }
  function attentionClass(status) {
    return status === "Ada Indikasi" ? "review" : "";
  }
  function statusSummary(session) {
    const rows = (session?.participants || []).map((participant) => ({ participant, runtime: runtimeFor(participant), attention: attentionFor(participant) }));
    return {
      total: rows.length,
      active: rows.filter((row) => isActive(row.runtime)).length,
      camera: rows.filter((row) => row.runtime?.cameraStatus === "Aktif").length,
      microphone: rows.filter((row) => row.runtime?.microphoneStatus === "Aktif").length,
      review: rows.filter((row) => row.attention === "Ada Indikasi").length,
    };
  }
  function renderSessionPicker(sessions) {
    const host = $("session-picker");
    if (!sessions.length) { host.innerHTML = ""; return; }
    if (!selectedSessionId && sessions.length === 1) selectedSessionId = sessions[0].id;
    if (sessions.length === 1) { host.innerHTML = ""; return; }
    if (!selectedSessionId) {
      host.innerHTML = `<div class="session-select-grid">${sessions.map((session) => `<button class="session-select-card" data-choose-session="${esc(session.id)}"><strong>${esc(session.exam?.name || session.examId)}</strong><span>${esc(session.name)} · ${session.mode === "ONSITE" ? "Onsite" : "Remote"}</span><small>${esc(session.date)} · ${esc(session.startTime)}–${esc(session.endTime)} WIB · ${session.participants.length} peserta</small></button>`).join("")}</div>`;
      return;
    }
    host.innerHTML = `<div class="session-switcher">${sessions.map((session) => `<button class="${session.id === selectedSessionId ? "is-active" : ""}" data-choose-session="${esc(session.id)}"><strong>${esc(session.name)} · ${esc(session.exam?.name || session.examId)}</strong><small>${esc(session.date)} · ${esc(session.startTime)}–${esc(session.endTime)} WIB</small></button>`).join("")}</div>`;
  }
  function renderOverview(session) {
    if (!session) return "";
    const metrics = statusSummary(session);
    return `<section class="session-overview"><div><h2>${esc(session.exam?.name || session.examId)} · ${esc(session.name)}</h2><p>${esc(session.date)} · ${esc(session.startTime)}–${esc(session.endTime)} WIB${session.mode === "ONSITE" && session.location ? ` · ${esc(session.location)}` : ""}</p></div><span class="session-mode">${session.mode === "ONSITE" ? "ONSITE" : "REMOTE"}</span></section><div class="proctor-metrics">${[["Peserta terdaftar", metrics.total], ["Peserta aktif", metrics.active], ["Kamera aktif", metrics.camera], ["Mikrofon aktif", metrics.microphone], ["Ada indikasi", metrics.review]].map(([label, value]) => `<article class="proctor-metric"><span>${label}</span><strong>${value}</strong></article>`).join("")}<article class="proctor-metric"><span>Status sesi</span><strong style="font-size:12px">${esc(session.status || "-")}</strong></article></div>`;
  }
  function renderCatalog(rows, indicationsOnly = false) {
    const filtered = indicationsOnly ? rows.filter((row) => row.attention === "Ada Indikasi") : rows;
    if (!filtered.length) return `<div class="empty-state">${indicationsOnly ? "Tidak ada peserta dengan indikasi aktif pada sesi ini." : "Belum ada peserta terdaftar pada sesi ini."}</div>`;
    return `<div class="participant-list">${filtered.map(({ participant, runtime, events, recent, attention }) => {
      const latest = events.find((event) => event.status !== "resolved") || events[0];
      const camera = cameraStatus(participant, runtime);
      const microphone = microphoneStatus(participant, runtime);
      const monitoring = monitoringStatus(participant, runtime);
      const connected = isActive(runtime);
      const source = latest ? latest.isSimulation ? "Data Simulasi" : latest.source || latest.label || latest.type : "-";
      return `<button class="participant-card ${selectedParticipantId === participant.id ? "is-selected" : ""}" data-select-participant="${esc(participant.id)}"><div class="participant-card-head"><div><strong>${esc(participant.name)}</strong><small>${esc(participant.id)}${participant.participantNo ? ` · ${esc(participant.participantNo)}` : ""}${participant.demoData ? " · Data Simulasi" : ""}</small></div><span class="attention-pill ${attentionClass(attention)}">${esc(attention)}</span></div><div class="participant-card-status"><span>Kamera<b>${esc(camera)}</b></span><span>Mikrofon<b>${esc(microphone)}</b></span><span>Monitoring<b>${esc(connected ? "Monitoring Aktif" : monitoring)}</b></span></div><div class="participant-card-status"><span>Status<b>${esc(attention)}</b></span><span>Indikator terakhir<b>${latest ? `${esc(latest.title)} · ${formatTime(latest.time)}` : "Tidak ada"}</b></span>${indicationsOnly ? `<span>Sumber<b>${esc(source)}</b></span>` : `<span>${recent > 1 ? `<b>${recent} indikator dalam 5 menit</b>` : ""}</span>`}</div></button>`;
    }).join("")}</div>`;
  }
  function renderDetail(row) {
    const panel = $("participant-detail");
    if (!row) { panel.innerHTML = `<div class="detail-empty">Pilih peserta untuk melihat identitas, status perangkat, indikator, dan tindakan pengawas.</div>`; return; }
    const { participant, runtime, events, attention, recent } = row;
    const session = selectedSession();
    const data = admin();
    const exam = data.exams.find((item) => item.id === participant.examId);
    const canVideo = participant.id === "PST-001" && !!remotePresence?.online && remotePresence.session?.cameraStatus === "Aktif";
    const simNote = participant.demoData ? `<span class="source-pill simulation">Data Simulasi</span>` : "";
    const activeEvents = events.filter((event) => event.status !== "resolved");
    const latest = activeEvents[0] || events[0];
    const timeline = events.slice(0, 8).map((event) => `<div class="indicator-item"><div><strong>${esc(event.title)}</strong><small>${esc(event.source || event.label || (event.type === "visual" ? "Visual" : "Audio"))}${event.isSimulation ? " · Data Simulasi" : ""}</small></div><time>${formatTime(event.time)}</time></div>`).join("");
    const activeIndicatorMarkup = activeEvents.map((event) => `<div class="indicator-item"><div><strong>${esc(event.title)}</strong><small>${fullTime(event.time)} · ${esc(event.source || event.label || event.type)} · ${event.isSimulation ? "Data Simulasi" : "Event nyata"}</small><small>${esc(event.detail || "")}</small></div></div>`).join("");
    let cameraActions = "";
    if (participant.demoData) cameraActions = `<button class="btn btn-light" disabled>Data Simulasi - live camera tidak tersedia</button>`;
    else if (participant.id !== "PST-001") cameraActions = `<button class="btn btn-light" disabled>Live camera prototype hanya tersedia untuk Station Demo A-01</button>`;
    else if (!canVideo) cameraActions = `<button class="btn btn-light" disabled>Kamera peserta belum terhubung</button>`;
    else cameraActions = `<button class="btn btn-primary" id="toggle-camera">${rtc ? "Tutup Kamera" : "Lihat Kamera"}</button>`;
    const attentionActions = attention === "Ada Indikasi"
      ? `<button class="btn btn-primary" data-review-action="safe">Tandai Aman</button><button class="btn btn-danger" data-review-action="violation">Catat Pelanggaran</button>` : "";
    const isLive = rtcStatus === "live" && canVideo;
    panel.innerHTML = `<div class="detail-title"><div><div class="eyebrow">DETAIL PESERTA · ${esc(participant.id)}</div><h2>${esc(participant.name)}</h2><p>${esc(participant.participantNo || "ID peserta")}</p></div><div class="detail-tags"><span class="attention-pill ${attentionClass(attention)}">${esc(attention)}</span>${simNote}</div></div>
      <div class="detail-facts"><div><span>Ujian</span><strong>${esc(exam?.name || participant.examId)}</strong></div><div><span>Sesi</span><strong>${esc(session?.name || participant.sessionId)}</strong></div><div><span>Mode</span><strong>${session?.mode === "ONSITE" ? "Onsite" : "Remote"}</strong></div><div><span>Status pendaftaran</span><strong>${esc(participant.status || "Terdaftar")}</strong></div></div>
      <section class="detail-section"><h3>Status perangkat & sesi</h3><div class="detail-facts"><div><span>Kamera</span><strong>${esc(cameraStatus(participant, runtime))}</strong></div><div><span>Mikrofon</span><strong>${esc(microphoneStatus(participant, runtime))}</strong></div><div><span>Monitoring</span><strong>${esc(monitoringStatus(participant, runtime))}</strong></div><div><span>Koneksi / sesi</span><strong>${esc(runtime?._remote ? "Terhubung via signaling" : runtime ? runtime.monitoringStatus : "Belum Terhubung")}</strong></div></div><small class="detail-note">Mikrofon hanya diperiksa statusnya. Audio tidak dikirim atau dianalisis.</small></section>
      <section class="detail-section"><h3>Indikator aktif <small>${activeEvents.length ? `${activeEvents.length} aktif` : ""}</small></h3>${activeIndicatorMarkup || `<div class="empty-state">Tidak ada indikasi aktif.</div>`}</section>
      <section class="detail-section"><h3>Indikator terakhir <small>${recent > 1 ? `${recent} indikator dalam 5 menit` : ""}</small></h3>${latest ? `<div class="indicator-item"><div><strong>${esc(latest.title)}</strong><small>${esc(latest.source || latest.label || latest.type)}${latest.isSimulation ? " · Data Simulasi" : " · Event nyata"}</small><small>${esc(latest.detail || "")}</small></div><time>${fullTime(latest.time)}</time></div>` : `<div class="empty-state">Belum ada indikator.</div>`}</section>
      <section class="detail-section"><h3>Riwayat indikator</h3>${timeline || `<div class="empty-state">Riwayat indikator kosong.</div>`}</section>
      <section class="detail-section"><h3>Kamera peserta</h3><div class="video-frame"><video id="detail-video" autoplay playsinline class="${isLive ? "" : "hide"}"></video>${isLive ? `<span class="video-label">LIVE</span>` : `<div class="video-placeholder" id="camera-message">${participant.demoData ? "Data Simulasi - live camera tidak tersedia." : canVideo ? "Stream menunggu koneksi Station Demo A-01." : "Pratinjau hanya tersedia saat kamera Station Demo A-01 aktif. Tidak ada kamera pengawas yang digunakan."}</div>`}</div><div class="detail-actions">${cameraActions}</div></section>
      <section class="detail-section"><h3>Tindakan Pengawas</h3><div class="detail-actions">${attentionActions || `<small>Tidak ada indikasi aktif untuk diproses.</small>`}</div></section>`;
    if (isLive && video.srcObject) $("detail-video").srcObject = video.srcObject;
    const toggleCamera = $("toggle-camera");
    toggleCamera?.addEventListener("click", () => {
      if (rtc) { rtc.stop(); rtc = null; render(); return; }
      rtcStatus = "connecting";
      rtc = UjiRtc.startProctor(video, (state, message, stream) => {
        rtcStatus = state;
        const currentRow = participantRows().find((item) => item.participant.id === participant.id);
        if (!currentRow) return;
        if (state === "live") {
          const frameVideo = $("detail-video");
          const placeholder = $("camera-message");
          if (frameVideo && stream) { frameVideo.srcObject = stream; frameVideo.classList.remove("hide"); }
          placeholder?.remove();
          const frame = document.querySelector(".video-frame");
          if (frame && !frame.querySelector(".video-label")) frame.insertAdjacentHTML("beforeend", '<span class="video-label">LIVE</span>');
        } else if (state === "error") {
          const placeholder = $("camera-message");
          if (placeholder) placeholder.textContent = `Live camera masih prototype: ${message || "koneksi belum tersedia"}`;
          else window.UjiStore.toast(`Live camera masih prototype: ${message || "koneksi belum tersedia"}`);
        }
      });
      rtc.connect();
      render();
    });
    panel.querySelectorAll("[data-review-action]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.reviewAction === "safe") applyReview(participant);
      if (button.dataset.reviewAction === "violation") openViolationForm(participant);
    }));
  }
  function focusNextIndication(excludedParticipantId) {
    const next = participantRows().find((row) => row.participant.id !== excludedParticipantId && row.attention === "Ada Indikasi");
    selectedParticipantId = next?.participant.id || null;
  }
  function applyReview(participant) {
    const targets = indicatorsFor(participant).filter((event) => event.status !== "resolved");
    if (!targets.length) { window.UjiStore.toast("Tidak ada indikasi aktif untuk diproses."); return; }
    targets.forEach((event) => UjiStore.reviewEvent(event.id, "resolved", user.name, "Tandai Aman", "Pengawas telah meninjau dan menandai peserta aman."));
    focusNextIndication(participant.id);
    render();
    window.UjiStore.toast("Indikasi ditandai aman. Tidak ada pelanggaran yang dicatat.");
  }
  function openViolationForm(participant) {
    if (!indicatorsFor(participant).some((event) => event.status !== "resolved")) {
      window.UjiStore.toast("Tidak ada indikasi aktif untuk diproses.");
      return;
    }
    violationParticipantId = participant.id;
    $("violation-form").reset();
    $("violation-dialog").showModal();
  }
  function submitViolation(event) {
    event.preventDefault();
    const participant = admin().participants.find((item) => item.id === violationParticipantId && item.sessionId === selectedSessionId);
    const targets = participant ? indicatorsFor(participant).filter((item) => item.status !== "resolved") : [];
    if (!participant || !targets.length) {
      $("violation-dialog").close();
      window.UjiStore.toast("Tidak ada indikasi aktif untuk diproses.");
      return;
    }
    const violationType = $("violation-type").value;
    const note = $("violation-note").value.trim();
    if (!violationType || !note) return;
    const createdAt = new Date().toISOString();
    for (const indication of targets) {
      UjiStore.addViolation({
        participantId: participant.id,
        participantName: participant.name,
        examId: participant.examId,
        sessionId: participant.sessionId,
        indicationTitle: indication.title,
        violationType,
        note,
        reviewer: user.name,
        createdAt,
      });
      UjiStore.reviewEvent(indication.id, "resolved", user.name, "Catat Pelanggaran", `${violationType}: ${note}`);
      UjiStore.updateEvent(indication.id, { violation: true });
    }
    $("violation-dialog").close();
    violationParticipantId = null;
    focusNextIndication(participant.id);
    render();
    window.UjiStore.toast("Pelanggaran dicatat pada Rekap Pelanggaran.");
  }
  function renderViolations() {
    const rows = store().violations.filter((item) => item.sessionId === selectedSessionId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!rows.length) return `<div class="proctor-panel empty-state">Belum ada pelanggaran yang dicatat pada sesi ini.</div>`;
    return `<div class="proctor-panel history-table-wrap"><table class="history-table"><thead><tr><th>Waktu</th><th>Peserta</th><th>ID peserta</th><th>Indikasi awal</th><th>Jenis pelanggaran</th><th>Catatan</th><th>Pengawas</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${fullTime(item.createdAt)}</td><td>${esc(item.participantName)}</td><td>${esc(item.participantId)}</td><td>${esc(item.indicationTitle)}</td><td>${esc(item.violationType)}</td><td>${esc(item.note)}</td><td>${esc(item.reviewer)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function renderContent() {
    const sessions = assignedSessions();
    if (selectedSessionId && !sessions.some((item) => item.id === selectedSessionId)) selectedSessionId = null;
    renderSessionPicker(sessions);
    const session = selectedSession();
    $("page-title").textContent = viewTitles[activeView];
    document.querySelectorAll(".proctor-nav [data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === activeView));
    const indicationCount = session ? participantRows().filter((row) => row.attention === "Ada Indikasi").length : sessions.reduce((sum, item) => sum + item.participants.filter((participant) => attentionFor(participant) === "Ada Indikasi").length, 0);
    $("nav-review-count").textContent = indicationCount;
    if (!sessions.length) { $("proctor-view").innerHTML = `<section class="proctor-panel empty-state">Belum ada sesi yang ditugaskan ke akun ${esc(user.id)}. Hubungi admin untuk penugasan sesi.</section>`; return; }
    if (!session) { $("proctor-view").innerHTML = `<section class="proctor-panel empty-state">Pilih sesi yang ditugaskan kepada Anda untuk melihat monitoring peserta.</section>`; return; }
    const overview = renderOverview(session);
    const rows = participantRows();
    selectedParticipantId ||= rows[0]?.participant.id || null;
    const indicationRows = rows.filter((row) => row.attention === "Ada Indikasi");
    if (activeView === "indications" && !indicationRows.some((row) => row.participant.id === selectedParticipantId)) {
      selectedParticipantId = indicationRows[0]?.participant.id || null;
    }
    const selected = rows.find((row) => row.participant.id === selectedParticipantId) || null;
    if (activeView === "violations") { $("proctor-view").innerHTML = `${overview}${renderViolations()}`; return; }
    if (activeView === "dashboard") {
      $("proctor-view").innerHTML = `${overview}<div class="demo-callout"><div><strong>Skenario Demo · Data Simulasi</strong><small>Membuat indikasi contoh untuk PST-003 Dewi Anggraini. Bukan hasil AI atau kamera.</small></div><button class="btn btn-light btn-sm" id="run-demo">Jalankan Skenario Demo</button></div><div class="proctor-toolbar"><div><h2>Ringkasan Pengawasan</h2><p>Peserta dan indikasi pada sesi tugas Anda.</p></div><button class="btn btn-light btn-sm" data-open-view="monitor">Buka Monitor Peserta</button></div><div class="proctor-workspace"><section class="proctor-panel">${renderCatalog(rows)}</section><section class="proctor-panel detail-card" id="participant-detail"></section></div>`;
    } else if (activeView === "monitor") {
      $("proctor-view").innerHTML = `${overview}<div class="demo-callout"><div><strong>Data indikator simulasi</strong><small>Contoh ditandai Data Simulasi dan bukan hasil deteksi AI.</small></div><button class="btn btn-light btn-sm" id="run-demo">Tambah Indikasi Demo</button></div><div class="proctor-toolbar"><div><h2>Monitor Peserta</h2><p>Ringkasan perangkat dan status peserta pada sesi yang ditugaskan.</p></div></div><div class="proctor-workspace"><section class="proctor-panel">${renderCatalog(rows)}</section><section class="proctor-panel detail-card" id="participant-detail"></section></div>`;
    } else {
      $("proctor-view").innerHTML = `${overview}<div class="proctor-toolbar"><div><h2>Indikasi aktif</h2><p>Verifikasi setiap indikasi dan pilih Tandai Aman atau Catat Pelanggaran.</p></div></div><div class="proctor-workspace"><section class="proctor-panel">${renderCatalog(rows, true)}</section><section class="proctor-panel detail-card" id="participant-detail"></section></div>`;
    }
    if (activeView !== "violations") renderDetail(selected);
    $("run-demo")?.addEventListener("click", () => {
      const session = selectedSession();
      const demoParticipant = session?.participants.find((item) => item.id === "PST-003");
      if (!demoParticipant) { window.UjiStore.toast("PST-003 tidak terdaftar pada sesi yang sedang dipilih."); return; }
      UjiStore.runDemoScenario();
      selectedParticipantId = "PST-003";
      activeView = "indications";
      render();
    });
    document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => { activeView = button.dataset.openView; render(); }));
  }
  function render() {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const catalogScroll = document.querySelector(".participant-list")?.scrollTop;
    const detailScroll = document.getElementById("participant-detail")?.scrollTop;
    renderContent();
    window.scrollTo(scrollX, scrollY);
    const catalog = document.querySelector(".participant-list");
    const detail = document.getElementById("participant-detail");
    if (catalog && catalogScroll !== undefined) catalog.scrollTop = catalogScroll;
    if (detail && detailScroll !== undefined) detail.scrollTop = detailScroll;
  }
  function presenceSignature(presence) {
    return JSON.stringify({
      online: !!presence?.online,
      session: presence?.online ? presence.session || null : null,
    });
  }
  let presenceRequestPending = false;
  function refreshPresence() {
    if (!window.UjiRtc?.getStationPresence || presenceRequestPending) return;
    presenceRequestPending = true;
    UjiRtc.getStationPresence().then((presence) => {
      const previous = presenceSignature(remotePresence);
      const next = presenceSignature(presence);
      remotePresence = presence;
      if (previous !== next) render();
    }).catch(() => {
      const fallback = { online: false, session: null };
      const changed = presenceSignature(remotePresence) !== presenceSignature(fallback);
      remotePresence = fallback;
      if (changed) render();
    }).finally(() => { presenceRequestPending = false; });
  }
  document.querySelectorAll(".proctor-nav [data-view]").forEach((button) => button.addEventListener("click", () => { activeView = button.dataset.view; render(); }));
  $("session-picker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-choose-session]");
    if (button) { selectedSessionId = button.dataset.chooseSession; selectedParticipantId = null; if (rtc) { rtc.stop(); rtc = null; } render(); }
  });
  $("proctor-view").addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-participant]");
    if (button) { selectedParticipantId = button.dataset.selectParticipant; if (rtc) { rtc.stop(); rtc = null; } render(); }
  });
  $("proctor-logout").addEventListener("click", () => { if (rtc) rtc.stop(); window.UjiAuth.signOut(); location.href = "../login/index.html"; });
  $("violation-form").addEventListener("submit", submitViolation);
  $("cancel-violation").addEventListener("click", () => { $("violation-dialog").close(); violationParticipantId = null; });
  $("violation-dialog").addEventListener("click", (event) => { if (event.target === $("violation-dialog")) { $("violation-dialog").close(); violationParticipantId = null; } });
  $("violation-dialog").addEventListener("close", () => { violationParticipantId = null; });
  window.addEventListener("storage", (event) => { if ([UjiAdminStore.KEY, UjiStore.KEY].includes(event.key)) render(); });
  window.addEventListener("ujiguard:updated", render);
  window.addEventListener("ujiguard:admin-data-updated", render);
  render();
  refreshPresence();
  presenceTimer = window.setInterval(refreshPresence, 3500);
  window.addEventListener("pagehide", () => { window.clearInterval(presenceTimer); if (rtc) rtc.stop(); });
})();
