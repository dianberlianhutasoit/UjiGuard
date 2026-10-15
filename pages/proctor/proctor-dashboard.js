(function () {
  "use strict";
  const user = window.UjiAuth.currentUser();
  if (!user || user.role !== "proctor") { location.replace("../login/index.html"); return; }
  const $ = (id) => document.getElementById(id);
  const esc = window.UjiStore.esc;
  const viewTitles = { dashboard: "Dashboard Pengawas", monitor: "Monitor Peserta", indications: "Indikasi", violations: "Rekap Pelanggaran", history: "Riwayat Pemeriksaan" };
  let activeView = "dashboard";
  let selectedSessionId = null;
  let selectedParticipantId = null;
  let rtc = null;
  let rtcParticipantId = null;
  let rtcStatus = "closed";
  let rtcStreams = { camera: null, screen: null };
  let screenStreamEnded = false;
  let activeEvidence = "screen";
  let remotePresence = null;
  let presenceTimer = null;
  let monitoringEventTimer = null;
  let monitoringEventCursor = 0;
  let violationParticipantId = null;
  const video = $("proctor-video");
  const screenVideo = $("proctor-screen-video");

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
    const events = store()?.events;
    return (Array.isArray(events) ? events : []).filter((event) => eventMatches(event, participant) && (!event.examSessionId || event.examSessionId === participant.sessionId)).sort((a, b) => Number(b.time) - Number(a.time));
  }
  function needsReview(event) {
    return event.status !== "resolved" && (event.status === "new" || event.status === "review" || event.status === "onsite" || event.severity === "warning" || event.priority === "high");
  }
  function reviewHistoryFor(participant) {
    const reviews = store()?.reviewHistory;
    return (Array.isArray(reviews) ? reviews : []).filter((review) => review.participantId === participant.id && (!review.sessionId || review.sessionId === participant.sessionId)).sort((a, b) => Number(b.time) - Number(a.time));
  }
  function attentionFor(participant) {
    const events = indicatorsFor(participant);
    return events.some(needsReview) ? "Ada Indikasi" : "Normal";
  }
  function runtimeFor(participant) {
    const runtimes = store()?.participantSessions;
    const local = (Array.isArray(runtimes) ? runtimes : []).find((item) => item.participantId === participant.id && (!item.sessionId || item.sessionId === participant.sessionId)) || null;
    if (participant.id === "PST-001" && remotePresence?.online && remotePresence.session?.participantId === participant.id) return { ...local, ...remotePresence.session, _remote: true };
    return local;
  }
  function isActive(runtime) { return runtime?.monitoringStatus === "Monitoring Aktif"; }
  function cameraStatus(participant, runtime) {
    if (participant.demoData) return runtime?.cameraStatus || "Data Simulasi";
    if (!runtime) return "Belum Terhubung";
    return runtime.cameraStatus || "Belum Terhubung";
  }
  function microphoneStatus(participant, runtime) {
    if (participant.demoData) return runtime?.microphoneStatus || "Data Simulasi";
    if (!runtime) return "Belum Terhubung";
    return runtime.microphoneStatus || "Belum Terhubung";
  }
  function monitoringStatus(participant, runtime) {
    if (participant.demoData) return runtime?.monitoringStatus || "Data Simulasi";
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
    return value ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "-";
  }
  function fullTime(value) {
    return value ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "-";
  }
  function attentionClass(status) {
    return status === "Ada Indikasi" ? "review" : "";
  }
  function cameraPreview(participant, activeEvents, isLive, canVideo, runtime = null) {
    if (!participant.demoData) return `<video id="detail-video" autoplay playsinline class="${isLive ? "" : "hide"}"></video>${isLive ? `<span class="video-label">LIVE</span>` : `<div class="video-placeholder" id="camera-message"><svg viewBox="0 0 48 40" aria-hidden="true"><path d="M5 9h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Zm28 8 13-7v20l-13-7V17Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg><strong>${canVideo ? "Menghubungkan kamera peserta" : "Menunggu kamera peserta"}</strong><small>${canVideo ? "Stream Station Demo A-01 sedang disiapkan." : "Stream nyata tersedia saat Station Demo A-01 terhubung."}</small></div>`}`;

    const activeText = activeEvents.map((event) => `${event.title || ""} ${event.source || ""}`).join(" ").toLowerCase();
    let scene = "normal";
    let caption = "Normal – Data Simulasi";
    if (activeEvents.length && /wajah.*tidak terdeteksi/.test(activeText)) {
      scene = "no-face";
      caption = "Wajah tidak terdeteksi – Data Simulasi";
    } else if (activeEvents.length && /kamera.*(tidak aktif|bermasalah)|perangkat \/ kamera/.test(activeText)) {
      scene = "camera-off";
      caption = "Kamera tidak tersedia – Data Simulasi";
    } else if (activeEvents.length && /keluar frame|keluar dari frame/.test(activeText)) {
      scene = "out-of-frame";
      caption = "Keluar frame – Data Simulasi";
    } else if (runtime?.cameraConnectionStatus === "Tidak Stabil") {
      scene = "lag";
      caption = "Koneksi tidak stabil – Data Simulasi";
    } else if (runtime?.microphoneStatus === "Bermasalah" && (!activeEvents.length || /mikrofon|audio/.test(activeText))) {
      scene = `normal-${participant.id.toLowerCase()}`;
      caption = "Mikrofon bermasalah – Data Simulasi";
    } else scene = `normal-${participant.id.toLowerCase()}`;
    const audioWarning = activeEvents.some((event) => event.type === "audio" || /mikrofon|audio/.test(`${event.title || ""} ${event.source || ""}`)) || runtime?.microphoneStatus === "Bermasalah";
    return `<div class="camera-preview simulation-preview scene-${scene}" role="img" aria-label="Pratinjau simulasi: ${esc(caption)}">
      <div class="preview-topline"><span><i></i> DATA SIMULASI</span><span>PREVIEW</span></div>
      <div class="preview-scene"><span class="preview-corner corner-tl"></span><span class="preview-corner corner-tr"></span><span class="preview-corner corner-bl"></span><span class="preview-corner corner-br"></span>
        ${scene === "no-face" ? `<div class="preview-scan"><span></span><b>Wajah tidak terdeteksi</b></div>` : scene === "camera-off" ? `<div class="preview-off"><span><svg viewBox="0 0 48 40" aria-hidden="true"><path d="M5 9h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Zm28 8 13-7v20l-13-7V17Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="m8 5 32 30" stroke="currentColor" stroke-width="3"/></svg></span><b>Kamera tidak aktif</b></div>` : `<div class="preview-person"><span class="person-hair"></span><span class="person-head"><i></i><i></i><em></em></span><span class="person-neck"></span><span class="person-body"></span></div>`}
        ${audioWarning ? `<span class="preview-mic-warning">? Mic perlu diperiksa</span>` : ""}
      </div>
      <div class="preview-caption"><span>${esc(participant.name)}</span><small>${esc(caption)}</small></div>
    </div>`;
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
      host.innerHTML = `<div class="session-select-grid">${sessions.map((session) => `<button class="session-select-card" data-choose-session="${esc(session.id)}"><strong>${esc(session.exam?.name || session.examId)}</strong><span>${esc(session.name)} – ${session.mode === "ONSITE" ? "Luring" : "Daring"}</span><small>${esc(session.date)} – ${esc(session.startTime)}–${esc(session.endTime)} WIB – ${session.participants.length} peserta</small></button>`).join("")}</div>`;
      return;
    }
    host.innerHTML = `<div class="session-switcher">${sessions.map((session) => `<button class="${session.id === selectedSessionId ? "is-active" : ""}" data-choose-session="${esc(session.id)}"><strong>${esc(session.name)} – ${esc(session.exam?.name || session.examId)}</strong><small>${esc(session.date)} – ${esc(session.startTime)}–${esc(session.endTime)} WIB</small><span class="session-mode-label">${session.mode === "ONSITE" ? "Luring" : "Daring"}</span></button>`).join("")}</div>`;
  }
  function renderSessionLine(session) {
    if (!session) return "";
    return `<section class="session-overview session-line"><div><h2>${esc(session.exam?.name || session.examId)} – ${esc(session.name)}</h2><p>${esc(session.date)} – ${esc(session.startTime)}–${esc(session.endTime)} WIB</p></div><span class="session-mode">${session.mode === "ONSITE" ? "Luring" : "Daring"}</span></section>`;
  }
  function renderOverview(session) {
    if (!session) return "";
    const metrics = statusSummary(session);
    return `<section class="session-overview"><div><h2>${esc(session.exam?.name || session.examId)} – ${esc(session.name)}</h2><p>${esc(session.date)} – ${esc(session.startTime)}–${esc(session.endTime)} WIB${session.mode === "ONSITE" && session.location ? ` – ${esc(session.location)}` : ""}</p></div><span class="session-mode">${session.mode === "ONSITE" ? "Luring" : "Daring"}</span></section><div class="proctor-metrics">${[["Peserta terdaftar", metrics.total], ["Peserta aktif", metrics.active], ["Kamera aktif", metrics.camera], ["Mikrofon aktif", metrics.microphone], ["Ada indikasi", metrics.review]].map(([label, value]) => `<article class="proctor-metric"><span>${label}</span><strong>${value}</strong></article>`).join("")}<article class="proctor-metric"><span>Status sesi</span><strong style="font-size:12px">${esc(session.status || "-")}</strong></article></div>`;
  }
  function renderCatalog(rows, indicationsOnly = false) {
    const filtered = indicationsOnly ? rows.filter((row) => row.attention === "Ada Indikasi") : rows;
    if (!filtered.length) return `<div class="empty-state">${indicationsOnly ? "Tidak ada peserta dengan indikasi aktif pada sesi ini." : "Belum ada peserta terdaftar pada sesi ini."}</div>`;
    return `<div class="participant-list">${filtered.map(({ participant, runtime, events, recent, attention }) => {
      const latest = events.find((event) => event.status !== "resolved") || events[0];
      const camera = cameraStatus(participant, runtime);
      const microphone = microphoneStatus(participant, runtime);
      const screen = runtime?.screenStatus === "Layar penuh aktif" ? "Layar Aktif" : /Dihentikan|Berhenti/.test(runtime?.screenStatus || "") ? "Berhenti" : (runtime ? "Belum Aktif" : "Belum Aktif");
      const monitoring = monitoringStatus(participant, runtime);
      const connected = isActive(runtime);
      const source = latest ? latest.isSimulation ? "Data Simulasi" : latest.source || latest.label || latest.type : "-";
      return `<button class="participant-card ${selectedParticipantId === participant.id ? "is-selected" : ""}" data-select-participant="${esc(participant.id)}"><div class="participant-card-head"><div><strong>${esc(participant.name)}</strong><small>${esc(participant.id)}${participant.participantNo ? ` – ${esc(participant.participantNo)}` : ""}${participant.demoData ? " – Data Simulasi" : ""}</small></div><span class="attention-pill ${attentionClass(attention)}">${esc(attention)}</span></div><div class="participant-card-status"><span>Kamera<b>${esc(camera)}</b></span><span>Mikrofon<b>${esc(microphone)}</b></span><span>Layar<b>${esc(screen)}</b></span><span>Monitoring<b>${esc(connected ? "Monitoring Aktif" : monitoring)}</b></span></div><div class="participant-card-status"><span>Status<b>${esc(attention)}</b></span><span>Indikator terakhir<b>${latest ? `${esc(latest.title)} – ${formatTime(latest.time)}` : "Tidak ada"}</b></span>${indicationsOnly ? `<span>Sumber<b>${esc(source)}</b></span>` : `<span>${recent > 1 ? `<b>${recent} indikator dalam 5 menit</b>` : ""}</span>`}</div></button>`;
    }).join("")}</div>`;
  }
  function renderDashboardPriority(rows) {
    const priority = rows.filter((row) => row.attention === "Ada Indikasi").slice(0, 3);
    const priorityMarkup = priority.length ? priority.map(({ participant, events }) => {
      const latest = events.find((event) => event.status !== "resolved") || events[0];
      return `<button class="dashboard-priority-item" data-priority-participant="${esc(participant.id)}"><span class="priority-dot"></span><span><strong>${esc(participant.name)} – ${esc(participant.id)}</strong><small>${esc(latest?.title || "Indikasi aktif")}${latest?.isSimulation ? " – Data Simulasi" : ""}</small></span><time>${formatTime(latest?.time)}</time></button>`;
    }).join("") : `<div class="dashboard-priority-empty">Tidak ada indikasi aktif. Semua peserta kembali berstatus Normal setelah ditinjau.</div>`;
    return `<section class="dashboard-summary"><div class="dashboard-summary-heading"><div><h2>Ringkasan Pengawasan</h2></div><div class="dashboard-shortcuts"><button class="btn btn-light btn-sm" data-open-view="monitor">Monitor Peserta</button><button class="btn btn-primary btn-sm" data-open-view="indications">Buka Indikasi (${rows.filter((row) => row.attention === "Ada Indikasi").length})</button></div></div><div class="dashboard-priority"><h3>Peserta prioritas <small>Maksimal 3</small></h3>${priorityMarkup}</div></section>`;
  }
  function renderDetail(row) {
    const panel = $("participant-detail");
    if (!panel) return;
    if (!row || !row.participant) {
      panel.innerHTML = `<div class="detail-empty"><div class="empty-state"><strong>Belum ada peserta dipilih</strong><p>${activeView === "indications" ? "Tidak ada peserta dengan indikasi aktif pada sesi ini." : "Pilih salah satu kartu peserta di sebelah kiri untuk melihat identitas, status perangkat, indikator, dan tindakan pengawas."}</p></div></div>`;
      return;
    }
    // The catalog is built from the assigned session snapshot. Resolve the selected
    // ID again against the Admin master so detail never depends on a stale card row.
    const data = admin() || {};
    const session = selectedSession();
    const selectedId = String(row.participant.id || "");
    const participant = (Array.isArray(data.participants) ? data.participants : []).find((item) => String(item.id) === selectedId && (!session || item.sessionId === session.id))
      || (session?.participants || []).find((item) => String(item.id) === selectedId)
      || row.participant;
    if (!participant.id || !participant.name) {
      panel.innerHTML = `<div class="detail-empty">Detail peserta tidak dapat ditampilkan karena data identitas tidak lengkap.</div>`;
      return;
    }
    try {
    const runtime = runtimeFor(participant) || row.runtime || null;
    const events = indicatorsFor(participant);
    const attention = row.attention || "Normal";
    const recent = Number.isFinite(row.recent) ? row.recent : 0;
    const reviews = reviewHistoryFor(participant);
    const screenStatus = runtime?.screenStatus === "Layar penuh aktif" ? "Layar Aktif" : /Dihentikan|Berhenti/.test(runtime?.screenStatus || "") ? "Berhenti" : "Belum Aktif";
    const exams = Array.isArray(data.exams) ? data.exams : [];
    const exam = exams.find((item) => item.id === participant.examId);
    const canVideo = participant.id === "PST-001" && !!remotePresence?.online && remotePresence.session?.cameraStatus === "Aktif";
    const canScreen = participant.id === "PST-001" && !!remotePresence?.online && remotePresence.session?.screenStatus === "Layar penuh aktif" && !screenStreamEnded;
    const simNote = participant.demoData ? `<span class="source-pill simulation">Data Simulasi</span>` : "";
    const activeEvents = events.filter(needsReview);
    const latest = activeEvents[0] || events[0];
    const activityLogs = store()?.activityLogs;
    const logs = (Array.isArray(activityLogs) ? activityLogs : []).filter((item) => item.participantId === participant.id && (!item.sessionId || item.sessionId === participant.sessionId));
    const timelineItems = new Map();
    logs.forEach((item) => timelineItems.set(item.eventId || item.id, item));
    events.forEach((item) => timelineItems.set(item.id, item));
    const timeline = [...timelineItems.values()].sort((a, b) => Number(b.time) - Number(a.time)).slice(0, 8).map((event) => `<div class="indicator-item"><div><strong>${esc(event.title || "Aktivitas peserta")}</strong><small>${esc(event.description || event.source || event.label || (event.type === "visual" ? "Visual" : event.type === "audio" ? "Audio" : "Aktivitas"))}${event.isSimulation ? " – Data Simulasi" : ""}</small></div><time>${formatTime(event.time)}</time></div>`).join("");
    const warningEvents = events.filter(needsReview).sort((a, b) => Number(a.time) - Number(b.time));
    const bundle = warningEvents.length >= 2 && warningEvents[warningEvents.length - 1].time - warningEvents[0].time <= 120000 ? `<div class="incident-bundle"><strong>${warningEvents.length} indikator dalam 2 menit${warningEvents.some((event) => event.isSimulation) ? " · Data Simulasi" : ""}</strong><small>Beberapa indikator muncul berdekatan dan dapat ditinjau bersama. Bundle bukan bukti pelanggaran.</small></div>` : "";
    const reviewTimeline = reviews.slice(0, 6).map((review) => `<div class="review-item"><div><strong>${esc(review.action)}</strong><small>${esc(review.reviewer)}${review.note ? ` – ${esc(review.note)}` : ""}</small></div><time>${formatTime(review.time)}</time></div>`).join("");
    const activeIndicatorMarkup = activeEvents.map((event) => `<div class="indicator-item"><div><strong>${esc(event.title)}</strong><small>${fullTime(event.time)} – ${esc(event.source || event.label || event.type)} – ${event.isSimulation ? "Data Simulasi" : "Event nyata"}</small><small>${esc(event.detail || "")}</small></div></div>`).join("");
    const attentionActions = attention === "Ada Indikasi"
      ? `<button class="btn btn-primary" data-review-action="safe">Tandai Aman</button><button class="btn btn-danger" data-review-action="violation">Catat Pelanggaran</button>` : "";
    const cameraIsLive = rtcStatus === "live" && !!rtcStreams.camera && canVideo;
    const screenIsLive = rtcStatus === "live" && !!rtcStreams.screen && canScreen;
    const screenContent = screenIsLive ? `<video id="detail-screen-video" autoplay playsinline></video><span class="video-label">LIVE · LAYAR</span>` : participant.demoData ? `<div class="video-placeholder simulated-evidence"><span class="source-pill simulation">Data Simulasi</span><strong>Pratinjau layar simulasi</strong><small>Tidak menampilkan layar peserta secara live.</small></div>` : `<div class="video-placeholder" id="screen-message"><strong>${canScreen ? "Menghubungkan layar peserta" : "Layar peserta belum tersedia."}</strong><small>Layar live muncul saat sesi monitoring peserta terhubung.</small></div>`;
    const evidenceTabs = `<div class="evidence-tabs" role="tablist" aria-label="Pilih evidence peserta"><button type="button" role="tab" aria-selected="${activeEvidence === "screen"}" data-evidence-tab="screen" class="${activeEvidence === "screen" ? "is-active" : ""}">Layar Peserta</button><button type="button" role="tab" aria-selected="${activeEvidence === "camera"}" data-evidence-tab="camera" class="${activeEvidence === "camera" ? "is-active" : ""}">Kamera Peserta</button></div>`;
    panel.innerHTML = `<div class="detail-title"><div><div class="eyebrow">DETAIL PESERTA – ${esc(participant.id)}</div><h2>${esc(participant.name)}</h2><p>${esc(participant.participantNo || "ID peserta")}</p></div><div class="detail-tags"><span class="attention-pill ${attentionClass(attention)}">${esc(attention)}</span>${simNote}</div></div>
      <div class="detail-facts"><div><span>Ujian</span><strong>${esc(exam?.name || participant.examId)}</strong></div><div><span>Sesi</span><strong>${esc(session?.name || participant.sessionId)}</strong></div><div><span>Mode</span><strong>${session?.mode === "ONSITE" ? "Luring" : "Daring"}</strong></div><div><span>Status pendaftaran</span><strong>${esc(participant.status || "Terdaftar")}</strong></div></div>
      <section class="detail-section"><h3>Status perangkat & sesi</h3><div class="detail-facts"><div><span>Kamera</span><strong>${esc(cameraStatus(participant, runtime))}</strong></div><div><span>Mikrofon</span><strong>${esc(microphoneStatus(participant, runtime))}</strong></div><div><span>Berbagi layar</span><strong>${esc(screenStatus)}</strong></div><div><span>Monitoring</span><strong>${esc(monitoringStatus(participant, runtime))}</strong></div><div><span>Koneksi / sesi</span><strong>${esc(runtime?._remote ? "Terhubung via signaling" : runtime ? runtime.monitoringStatus : "Belum Terhubung")}</strong></div></div><small class="detail-note">Mikrofon hanya diperiksa statusnya. Audio tidak dikirim atau dianalisis.</small></section>
      <section class="detail-section"><h3>Indikator aktif <small>${activeEvents.length ? `${activeEvents.length} aktif` : ""}</small></h3>${activeIndicatorMarkup || `<div class="empty-state">Tidak ada indikasi aktif.</div>`}</section>
      <section class="detail-section"><h3>Indikator terakhir <small>${recent > 1 ? `${recent} indikator dalam 5 menit` : ""}</small></h3>${latest ? `<div class="indicator-item"><div><strong>${esc(latest.title)}</strong><small>${esc(latest.source || latest.label || latest.type)}${latest.isSimulation ? " – Data Simulasi" : " – Event nyata"}</small><small>${esc(latest.detail || "")}</small></div><time>${fullTime(latest.time)}</time></div>` : `<div class="empty-state">Belum ada indikator.</div>`}</section>
      <section class="detail-section"><h3>Timeline aktivitas</h3>${bundle}${timeline || `<div class="empty-state">Riwayat indikator kosong.</div>`}</section>
      <section class="detail-section"><h3>Riwayat review</h3>${reviewTimeline || `<div class="empty-state">Belum ada riwayat review.</div>`}</section>
      <section class="detail-section"><h3>Evidence monitoring</h3>${evidenceTabs}<div class="evidence-pane ${activeEvidence === "screen" ? "" : "hide"}" data-evidence-view="screen"><div class="video-frame evidence-frame">${screenContent}</div></div><div class="evidence-pane ${activeEvidence === "camera" ? "" : "hide"}" data-evidence-view="camera"><div class="video-frame">${cameraPreview(participant, activeEvents, cameraIsLive, canVideo, runtime)}</div></div></section>
      <section class="detail-section"><h3>Tindakan Pengawas</h3><div class="detail-actions">${attentionActions || `<small>Tidak ada indikasi aktif untuk diproses.</small>`}</div></section>`;
    if (cameraIsLive && $("detail-video")) $("detail-video").srcObject = rtcStreams.camera;
    if (screenIsLive && $("detail-screen-video")) $("detail-screen-video").srcObject = rtcStreams.screen;
    if ((canScreen || canVideo) && !rtc) {
      rtcStatus = "connecting";
      rtcParticipantId = participant.id;
      rtc = UjiRtc.startProctor(video, screenVideo, (state, message, streams) => {
        rtcStatus = state;
        if (streams) rtcStreams = streams;
        const currentRow = participantRows().find((item) => item.participant.id === participant.id);
        if (!currentRow) return;
        if (state === "live") {
          render();
        } else if (state === "screen-ended") {
          rtcStreams.screen = null;
          screenStreamEnded = true;
          render();
        } else if (state === "error") {
          window.UjiStore.toast(message || "Koneksi monitoring belum tersedia.");
        }
      });
      rtc.connect();
    }
    panel.querySelectorAll("[data-review-action]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.reviewAction === "safe") applyReview(participant);
      if (button.dataset.reviewAction === "violation") openViolationForm(participant);
    }));
    } catch (error) {
      console.error("Gagal menampilkan detail peserta:", error);
      panel.innerHTML = `<div class="detail-empty">Detail peserta belum dapat dimuat. Pilih peserta kembali atau periksa data sesi.</div>`;
    }
  }
  function focusNextIndication(excludedParticipantId) {
    const next = participantRows().find((row) => row.participant.id !== excludedParticipantId && row.attention === "Ada Indikasi");
    selectedParticipantId = next?.participant.id || null;
  }
  function applyReview(participant) {
    const targets = indicatorsFor(participant).filter(needsReview);
    if (!targets.length) { window.UjiStore.toast("Tidak ada indikasi aktif untuk diproses."); return; }
    targets.forEach((event) => UjiStore.reviewEvent(event.id, "resolved", user.name, "Tandai Aman", "Pengawas telah meninjau dan menandai peserta aman."));
    focusNextIndication(participant.id);
    render();
    window.UjiStore.toast("Indikasi ditandai aman. Tidak ada pelanggaran yang dicatat.");
  }
  function openViolationForm(participant) {
    if (!indicatorsFor(participant).some(needsReview)) {
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
    const targets = participant ? indicatorsFor(participant).filter(needsReview) : [];
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
    const data = admin();
    return `<div class="proctor-panel history-table-wrap"><table class="history-table"><thead><tr><th>Waktu</th><th>Peserta</th><th>ID peserta</th><th>Ujian / sesi</th><th>Indikasi awal</th><th>Jenis pelanggaran</th><th>Catatan</th><th>Pengawas</th></tr></thead><tbody>${rows.map((item) => {
      const exam = data.exams.find((record) => record.id === item.examId);
      const session = data.examSessions.find((record) => record.id === item.sessionId);
      return `<tr><td>${fullTime(item.createdAt)}</td><td>${esc(item.participantName)}</td><td>${esc(item.participantId)}</td><td>${esc(exam?.name || item.examId)}<small>${esc(session?.name || item.sessionId)}</small></td><td>${esc(item.indicationTitle)}</td><td>${esc(item.violationType)}</td><td>${esc(item.note)}</td><td>${esc(item.reviewer)}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  function renderHistory() {
    const data = admin();
    const reviews = store()?.reviewHistory;
    const rows = (Array.isArray(reviews) ? reviews : []).slice().sort((a, b) => Number(b.time) - Number(a.time));
    if (!rows.length) return `<div class="proctor-panel empty-state"><div class="empty-state"><strong>Belum ada riwayat pemeriksaan</strong><p>Setiap Tandai Aman atau Catat Pelanggaran akan tercatat di sini.</p></div></div>`;
    const events = store()?.events;
    const participants = Array.isArray(data.participants) ? data.participants : [];
    return `<div class="proctor-panel history-table-wrap"><table class="history-table"><thead><tr><th>Waktu</th><th>Peserta</th><th>Alasan review</th><th>Keputusan</th><th>Pengawas</th></tr></thead><tbody>${rows.map((review) => {
      const participant = participants.find((item) => item.id === review.participantId);
      const event = (Array.isArray(events) ? events : []).find((item) => item.id === review.eventId);
      return `<tr><td>${fullTime(review.time)}</td><td>${esc(participant?.name || review.participantId || "-")}<small>${esc(review.participantId || "")}</small></td><td>${esc(event?.title || review.note || "-")}</td><td>${esc(review.action || `${review.fromStatus || ""} menjadi ${review.toStatus || ""}`)}</td><td>${esc(review.reviewer || "-")}</td></tr>`;
    }).join("")}</tbody></table></div>`;
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
    if (!sessions.length) { stopDetailRtc(); $("proctor-view").innerHTML = `<section class="proctor-panel empty-state">Belum ada sesi yang ditugaskan ke akun ${esc(user.id)}. Hubungi admin untuk penugasan sesi.</section>`; return; }
    if (!session) { stopDetailRtc(); $("proctor-view").innerHTML = `<section class="proctor-panel empty-state">Pilih sesi yang ditugaskan kepada Anda untuk melihat monitoring peserta.</section>`; return; }
    const rows = participantRows();
    const indicationRows = rows.filter((row) => row.attention === "Ada Indikasi");
    if (activeView === "indications" && !indicationRows.some((row) => row.participant.id === selectedParticipantId)) {
      selectedParticipantId = indicationRows[0]?.participant.id || null;
    }
    if (activeView !== "indications" && !rows.some((row) => row.participant.id === selectedParticipantId)) {
      selectedParticipantId = rows[0]?.participant.id || null;
    }
    if (!(["monitor", "indications"].includes(activeView)) || (rtcParticipantId && rtcParticipantId !== selectedParticipantId)) stopDetailRtc();
    const selected = rows.find((row) => row.participant.id === selectedParticipantId) || null;
    const overview = activeView === "dashboard" || activeView === "monitor" ? renderOverview(session) : renderSessionLine(session);
    if (activeView === "violations") { $("proctor-view").innerHTML = `${overview}${renderViolations()}`; return; }
    if (activeView === "history") { $("proctor-view").innerHTML = `${overview}${renderHistory()}`; return; }
    if (activeView === "dashboard") {
      $("proctor-view").innerHTML = `${overview}<div class="demo-callout"><div><strong>Skenario Demo</strong><small>Indikasi simulasi untuk PST-003; bukan hasil kamera.</small></div><button class="btn btn-light btn-sm" id="run-demo">Jalankan Skenario Demo</button></div>${renderDashboardPriority(rows)}`;
    } else if (activeView === "monitor") {
      $("proctor-view").innerHTML = `${overview}<div class="demo-callout"><div><strong>Data Simulasi</strong><small>Contoh indikasi untuk demo.</small></div><button class="btn btn-light btn-sm" id="run-demo">Tambah Indikasi Demo</button></div><div class="proctor-toolbar"><div><h2>Monitor Peserta</h2></div></div><div class="proctor-workspace"><section class="proctor-panel">${renderCatalog(rows)}</section><section class="proctor-panel detail-card" id="participant-detail"></section></div>`;
    } else {
      $("proctor-view").innerHTML = `${overview}<div class="proctor-toolbar"><div><h2>Indikasi aktif</h2><p>Pilih peserta untuk verifikasi.</p></div></div><div class="proctor-workspace indications-workspace"><section class="proctor-panel">${renderCatalog(rows, true)}</section><section class="proctor-panel detail-card" id="participant-detail"></section></div>`;
    }
    if (activeView === "monitor" || activeView === "indications" || activeView === "dashboard") renderDetail(selected);
    $("run-demo")?.addEventListener("click", () => {
      const session = selectedSession();
      const demoParticipant = session?.participants.find((item) => item.id === "PST-003");
      if (!demoParticipant) { window.UjiStore.toast("PST-003 tidak terdaftar pada sesi yang sedang dipilih."); return; }
      UjiStore.runDemoScenario();
      selectedParticipantId = "PST-003";
      activeView = "indications";
      render();
    });
    document.querySelectorAll("[data-priority-participant]").forEach((button) => button.addEventListener("click", () => {
      selectedParticipantId = button.dataset.priorityParticipant;
      activeView = "indications";
      render();
    }));
    document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.openView)));
  }
  function changeView(view) {
    activeView = view;
    const rows = participantRows();
    const candidates = view === "indications" ? rows.filter((row) => row.attention === "Ada Indikasi") : rows;
    selectedParticipantId = candidates[0]?.participant.id || null;
    render();
  }
  function render() {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const catalogScroll = document.querySelector(".participant-list")?.scrollTop;
    renderContent();
    window.scrollTo(scrollX, scrollY);
    const catalog = document.querySelector(".participant-list");
    if (catalog && catalogScroll !== undefined) catalog.scrollTop = catalogScroll;
  }
  function stopDetailRtc() {
    if (rtc) rtc.stop();
    rtc = null;
    rtcParticipantId = null;
    rtcStatus = "closed";
    rtcStreams = { camera: null, screen: null };
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
  let monitoringEventsPending = false;
  async function refreshMonitoringEvents() {
    if (monitoringEventsPending) return;
    monitoringEventsPending = true;
    try {
      const response = await fetch(`/monitoring-events?since=${monitoringEventCursor}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      for (const event of payload.events || []) {
        UjiStore.ingestMonitoringEvent(event);
        monitoringEventCursor = Math.max(monitoringEventCursor, Number(String(event.id).replace("REMOTE-", "")) || 0);
      }
      monitoringEventCursor = Math.max(monitoringEventCursor, Number(payload.cursor) || 0);
    } catch (_) {} finally { monitoringEventsPending = false; }
  }
  document.querySelectorAll(".proctor-nav [data-view]").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.view)));
  $("session-picker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-choose-session]");
    if (button) { selectedSessionId = button.dataset.chooseSession; selectedParticipantId = null; screenStreamEnded = false; stopDetailRtc(); render(); }
  });
  $("proctor-view").addEventListener("click", (event) => {
    const evidenceTab = event.target.closest("[data-evidence-tab]");
    if (evidenceTab) {
      activeEvidence = evidenceTab.dataset.evidenceTab;
      document.querySelectorAll("[data-evidence-tab]").forEach((button) => { const selected = button === evidenceTab; button.classList.toggle("is-active", selected); button.setAttribute("aria-selected", String(selected)); });
      document.querySelectorAll("[data-evidence-view]").forEach((panel) => panel.classList.toggle("hide", panel.dataset.evidenceView !== activeEvidence));
      return;
    }
    const button = event.target.closest("[data-select-participant]");
    if (button && button.dataset.selectParticipant !== selectedParticipantId) { selectedParticipantId = button.dataset.selectParticipant; activeEvidence = "screen"; screenStreamEnded = false; stopDetailRtc(); render(); }
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
  refreshMonitoringEvents();
  monitoringEventTimer = window.setInterval(refreshMonitoringEvents, 2000);
  window.addEventListener("pagehide", () => { window.clearInterval(presenceTimer); window.clearInterval(monitoringEventTimer); if (rtc) rtc.stop(); });
})();
