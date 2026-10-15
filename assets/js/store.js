(function () {
  "use strict";
  const KEY = "ujiguard_demo_v2";
  const SCHEMA = 8;
  const seed = [
    { id: "UG-2401", participantNo: "26-001", name: "Nadia Putri", email: "nadia@student.demo", desk: "A-01", stationType: "real-demo", status: "idle", started: Date.now(), device: "Kamera belum aktif" },
    { id: "UG-2402", participantNo: "26-002", name: "Rafi Pratama", email: "rafi@student.demo", desk: "A-02", stationType: "simulation", status: "active", started: Date.now(), device: "Data Simulasi" },
    { id: "UG-2403", participantNo: "26-003", name: "Dewi Anggraini", email: "dewi@student.demo", desk: "A-03", stationType: "simulation", status: "active", started: Date.now(), device: "Data Simulasi" },
    { id: "UG-2404", participantNo: "26-004", name: "Bima Saputra", email: "bima@student.demo", desk: "A-04", stationType: "simulation", status: "active", started: Date.now(), device: "Data Simulasi" },
    { id: "UG-2405", participantNo: "26-005", name: "Salsa Maharani", email: "salsa@student.demo", desk: "A-05", stationType: "simulation", status: "idle", started: Date.now(), device: "Data Simulasi" },
    { id: "UG-2406", participantNo: "26-006", name: "Farhan Akbar", email: "farhan@student.demo", desk: "A-06", stationType: "simulation", status: "active", started: Date.now(), device: "Data Simulasi" },
  ];
  function demoIndications() {
    const now = Date.now();
    return [
      { id: "EV-DEMO-PST-002", time: now - 180000, sessionId: "UG-2402", examSessionId: "SESSION-01", participantId: "PST-002", student: "Rafi Pratama", participantNo: "26-002", desk: "A-02", type: "visual", title: "Wajah tidak terdeteksi selama 8 detik", detail: "Skenario simulasi untuk memeriksa alur verifikasi pengawas.", source: "Visual / Simulasi", label: "Data Simulasi", isSimulation: true, status: "new", priority: "high" },
      { id: "EV-DEMO-PST-003", time: now - 120000, sessionId: "UG-2403", examSessionId: "SESSION-01", participantId: "PST-003", student: "Dewi Anggraini", participantNo: "26-003", desk: "A-03", type: "device", title: "Kamera peserta tidak aktif", detail: "Skenario simulasi gangguan kamera; bukan status kamera nyata.", source: "Perangkat / Kamera", label: "Data Simulasi", isSimulation: true, status: "new", priority: "high" },
      { id: "EV-DEMO-PST-004", time: now - 60000, sessionId: "UG-2404", examSessionId: "SESSION-01", participantId: "PST-004", student: "Bima Saputra", participantNo: "26-004", desk: "A-04", type: "visual", title: "Wajah beberapa kali keluar frame", detail: "Skenario simulasi untuk memeriksa alur verifikasi pengawas.", source: "Visual / Simulasi", label: "Data Simulasi", isSimulation: true, status: "new", priority: "medium" },
      { id: "EV-DEMO-PST-005", time: now - 30000, sessionId: "UG-2405", examSessionId: "SESSION-01", participantId: "PST-005", student: "Salsa Maharani", participantNo: "26-005", desk: "A-05", type: "SCREEN_STOPPED", title: "Berbagi layar dihentikan", detail: "Skenario simulasi untuk menunjukkan indikasi berbagi layar berhenti.", description: "Skenario demonstrasi; bukan event perangkat nyata.", source: "Browser / Simulasi", label: "Data Simulasi", isSimulation: true, status: "new", severity: "warning", reviewStatus: "PENDING", priority: "high" },
      { id: "EV-DEMO-PST-005-CONNECTION", time: now - 90000, sessionId: "UG-2405", examSessionId: "SESSION-01", participantId: "PST-005", student: "Salsa Maharani", participantNo: "26-005", desk: "A-05", type: "CONNECTION_LOST", title: "Koneksi monitoring tidak stabil", detail: "Skenario simulasi gangguan koneksi yang berdekatan dengan event screen sharing.", description: "Skenario demonstrasi; bukan gangguan jaringan nyata.", source: "Koneksi / Simulasi", label: "Data Simulasi", isSimulation: true, status: "new", severity: "warning", reviewStatus: "PENDING", priority: "high" },
    ];
  }
  function jakartaTimeToday(hour, minute) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), hour - 7, minute);
  }
  function demoReviewOutcomes() {
    return [
      { eventId: "EV-DEMO-PST-002", participantId: "PST-002", action: "Tandai Aman", reviewer: "Alya Pratama", time: jakartaTimeToday(17, 36), note: "Sudah diperiksa; tidak ditemukan pelanggaran." },
      { eventId: "EV-DEMO-PST-003", participantId: "PST-003", action: "Catat Pelanggaran", reviewer: "Alya Pratama", time: jakartaTimeToday(17, 37), note: "Kamera peserta tidak aktif saat sesi berlangsung.", violation: { id: "VI-DEMO-PST-003", participantName: "Dewi Anggraini", indicationTitle: "Kamera peserta tidak aktif", violationType: "Perangkat tidak sesuai", note: "Kamera peserta tidak aktif saat sesi berlangsung.", createdAt: new Date(jakartaTimeToday(17, 37)).toISOString() } },
      { eventId: "EV-DEMO-PST-004", participantId: "PST-004", action: "Catat Pelanggaran", reviewer: "Alya Pratama", time: jakartaTimeToday(17, 38), note: "Wajah beberapa kali keluar dari frame kamera.", violation: { id: "VI-DEMO-PST-004", participantName: "Bima Saputra", indicationTitle: "Wajah beberapa kali keluar frame", violationType: "Aktivitas mencurigakan", note: "Wajah beberapa kali keluar dari frame kamera.", createdAt: new Date(jakartaTimeToday(17, 38)).toISOString() } },
    ];
  }
  function demoActivityLogs() {
    const at = (hour, minute) => jakartaTimeToday(hour, minute);
    return [
      { id: "ACT-PST-002-1731", participantId: "PST-002", sessionId: "SESSION-01", title: "Monitoring dimulai", type: "monitoring", source: "Data Simulasi", time: at(17, 31), status: "info", isSimulation: true },
      { id: "ACT-PST-002-1734", participantId: "PST-002", sessionId: "SESSION-01", title: "Wajah keluar dari frame", type: "visual", source: "Data Simulasi", time: at(17, 34), status: "info", isSimulation: true },
      { id: "EV-PROTOTYPE-PST-002-1736", participantId: "PST-002", sessionId: "SESSION-01", title: "Wajah tidak terdeteksi selama 8 detik", type: "visual", source: "Data Simulasi", time: at(17, 36), status: "new", isSimulation: true },
      { id: "ACT-PST-003-1730", participantId: "PST-003", sessionId: "SESSION-01", title: "Monitoring dimulai", type: "monitoring", source: "Data Simulasi", time: at(17, 30), status: "info", isSimulation: true },
      { id: "ACT-PST-003-1735", participantId: "PST-003", sessionId: "SESSION-01", title: "Kamera mengalami gangguan", type: "device", source: "Data Simulasi", time: at(17, 35), status: "info", isSimulation: true },
      { id: "EV-PROTOTYPE-PST-003-1737", participantId: "PST-003", sessionId: "SESSION-01", title: "Kamera peserta tidak aktif", type: "device", source: "Data Simulasi", time: at(17, 37), status: "new", isSimulation: true },
      { id: "ACT-PST-004-1732", participantId: "PST-004", sessionId: "SESSION-01", title: "Monitoring dimulai", type: "monitoring", source: "Data Simulasi", time: at(17, 32), status: "info", isSimulation: true },
      { id: "ACT-PST-004-1734", participantId: "PST-004", sessionId: "SESSION-01", title: "Wajah keluar frame", type: "visual", source: "Data Simulasi", time: at(17, 34), status: "info", isSimulation: true },
      { id: "ACT-PST-004-1736", participantId: "PST-004", sessionId: "SESSION-01", title: "Wajah kembali terlihat", type: "visual", source: "Data Simulasi", time: at(17, 36), status: "info", isSimulation: true },
      { id: "EV-PROTOTYPE-PST-004-1738", participantId: "PST-004", sessionId: "SESSION-01", title: "Wajah beberapa kali keluar frame", type: "visual", source: "Data Simulasi", time: at(17, 38), status: "new", isSimulation: true },
      { id: "ACT-PST-005-1729", participantId: "PST-005", sessionId: "SESSION-01", title: "Monitoring dimulai", type: "monitoring", source: "Data Simulasi", time: at(17, 29), status: "info", isSimulation: true },
      { id: "ACT-PST-005-1733", participantId: "PST-005", sessionId: "SESSION-01", title: "Frame kamera terlambat", type: "device", source: "Data Simulasi", time: at(17, 33), status: "info", isSimulation: true },
      { id: "ACT-PST-005-1734", participantId: "PST-005", sessionId: "SESSION-01", title: "Koneksi kembali stabil", type: "device", source: "Data Simulasi", time: at(17, 34), status: "info", isSimulation: true },
      { id: "ACT-PST-006-1730", participantId: "PST-006", sessionId: "SESSION-01", title: "Monitoring dimulai", type: "monitoring", source: "Data Simulasi", time: at(17, 30), status: "info", isSimulation: true },
      { id: "ACT-PST-006-1735", participantId: "PST-006", sessionId: "SESSION-01", title: "Mikrofon tidak merespons", type: "device", source: "Data Simulasi", time: at(17, 35), status: "info", isSimulation: true },
      { id: "EV-PROTOTYPE-PST-006-1736", participantId: "PST-006", sessionId: "SESSION-01", title: "Mikrofon peserta tidak aktif", type: "device", source: "Data Simulasi", time: at(17, 36), status: "new", isSimulation: true },
    ];
  }
  function demoParticipantSessions() {
    const joinedAt = (hour, minute) => new Date(jakartaTimeToday(hour, minute)).toISOString();
    return [
      { participantId: "PST-002", name: "Rafi Pratama", examId: "EXAM-001", sessionId: "SESSION-01", cameraStatus: "Aktif", microphoneStatus: "Aktif", monitoringStatus: "Monitoring Aktif", joinedAt: joinedAt(17, 31), simulation: true },
      { participantId: "PST-003", name: "Dewi Anggraini", examId: "EXAM-001", sessionId: "SESSION-01", cameraStatus: "Tidak Aktif", microphoneStatus: "Aktif", monitoringStatus: "Monitoring Aktif", joinedAt: joinedAt(17, 30), simulation: true },
      { participantId: "PST-004", name: "Bima Saputra", examId: "EXAM-001", sessionId: "SESSION-01", cameraStatus: "Aktif", microphoneStatus: "Aktif", monitoringStatus: "Monitoring Aktif", joinedAt: joinedAt(17, 32), simulation: true },
      { participantId: "PST-005", name: "Salsa Maharani", examId: "EXAM-001", sessionId: "SESSION-01", cameraStatus: "Aktif", cameraConnectionStatus: "Tidak Stabil", microphoneStatus: "Aktif", screenStatus: "Berhenti · Data Simulasi", monitoringStatus: "Monitoring Aktif", joinedAt: joinedAt(17, 29), simulation: true },
      { participantId: "PST-006", name: "Farhan Akbar", examId: "EXAM-001", sessionId: "SESSION-01", cameraStatus: "Aktif", microphoneStatus: "Bermasalah", monitoringStatus: "Monitoring Aktif", joinedAt: joinedAt(17, 30), simulation: true },
    ];
  }
  function seedDemoReviewOutcomes(x) {
    for (const outcome of demoReviewOutcomes()) {
      const event = x.events.find((item) => item.id === outcome.eventId);
      if (!event) continue;
      const existingReview = x.reviewHistory.find((item) => item.eventId === outcome.eventId);
      if (!existingReview) {
        event.time = outcome.time;
        event.status = "resolved";
        event.reviewedBy = outcome.reviewer;
        event.updatedAt = outcome.time;
        event.violation = !!outcome.violation;
        event.note = outcome.note;
        x.reviewHistory.push({ id: `RV-DEMO-${outcome.participantId}`, eventId: outcome.eventId, participantId: outcome.participantId, sessionId: "SESSION-01", action: outcome.action, fromStatus: "new", toStatus: "resolved", reviewer: outcome.reviewer, note: outcome.note, time: outcome.time });
      }
      const confirmed = outcome.violation && (!existingReview || existingReview.action === "Catat Pelanggaran");
      if (confirmed && !x.violations.some((item) => item.id === outcome.violation.id || item.indicationEventId === outcome.eventId)) {
        const participant = outcome.participantId === "PST-003" ? { id: "PST-003", examId: "EXAM-001", sessionId: "SESSION-01" } : { id: "PST-004", examId: "EXAM-001", sessionId: "SESSION-01" };
        x.violations.push({ id: outcome.violation.id, indicationEventId: outcome.eventId, participantId: participant.id, participantName: outcome.violation.participantName, examId: participant.examId, sessionId: participant.sessionId, indicationTitle: outcome.violation.indicationTitle, violationType: outcome.violation.violationType, note: outcome.violation.note, reviewer: outcome.reviewer, createdAt: outcome.violation.createdAt });
      }
    }
  }
  function fresh() { return { schemaVersion: SCHEMA, sessions: seed.map((s) => ({ ...s })), events: demoIndications(), activityLogs: demoActivityLogs(), reviewHistory: [], violations: [], participantSessions: demoParticipantSessions(), lastEvent: 1048, monitoring: { active: false, startedAt: null } }; }
  function cameraConnected(s) { return s.stationType === "real-demo" && s.device === "Kamera lokal aktif" && Date.now() - (s.cameraHeartbeat || 0) < 10000; }
  function reconcile(x) {
    const old = Array.isArray(x.sessions) ? x.sessions : [];
    x.sessions = seed.map((base) => {
      const saved = old.find((s) => s.desk === base.desk) || {};
      const s = { ...base, ...saved, id: base.id, participantNo: base.participantNo, name: base.name, email: base.email, desk: base.desk, stationType: base.stationType };
      if (s.stationType !== "real-demo") { s.device = "Data Simulasi"; s.cameraHeartbeat = null; }
      s.cameraStatus = s.stationType === "simulation" ? "Tidak terhubung" : cameraConnected(s) ? "Kamera Aktif" : /bermasalah/i.test(s.device || "") ? "Bermasalah" : "Belum Aktif";
      return s;
    });
    x.events = Array.isArray(x.events) ? x.events : [];
    x.activityLogs = Array.isArray(x.activityLogs) ? x.activityLogs : [];
    x.reviewHistory = Array.isArray(x.reviewHistory) ? x.reviewHistory : [];
    x.violations = Array.isArray(x.violations) ? x.violations : [];
    x.participantSessions = Array.isArray(x.participantSessions) ? x.participantSessions : [];
    for (const demoSession of demoParticipantSessions()) {
      if (!x.participantSessions.some((item) => item.participantId === demoSession.participantId)) x.participantSessions.push(demoSession);
    }
    for (const demoEvent of demoIndications()) {
      if (!x.events.some((event) => event.id === demoEvent.id)) x.events.push(demoEvent);
    }
    for (const activity of demoActivityLogs()) {
      if (!x.activityLogs.some((item) => item.id === activity.id)) x.activityLogs.push(activity);
      const linkedEvent = x.events.find((event) => event.id === activity.id);
      if (linkedEvent && linkedEvent.status === "resolved") {
        const savedActivity = x.activityLogs.find((item) => item.id === activity.id);
        if (savedActivity) savedActivity.status = "resolved";
      }
      if (activity.status !== "info" && !linkedEvent) {
        const stations = { "PST-002": ["UG-2402", "26-002", "Rafi Pratama", "A-02"], "PST-003": ["UG-2403", "26-003", "Dewi Anggraini", "A-03"], "PST-004": ["UG-2404", "26-004", "Bima Saputra", "A-04"], "PST-006": ["UG-2406", "26-006", "Farhan Akbar", "A-06"] };
        const [stationId, participantNo, student, desk] = stations[activity.participantId];
        x.events.push({ id: activity.id, time: activity.time, sessionId: stationId, examSessionId: activity.sessionId, participantId: activity.participantId, participantNo, student, desk, type: activity.type, title: activity.title, detail: `${activity.title}. Skenario demonstrasi; bukan deteksi otomatis.`, source: activity.source, label: activity.source, status: activity.status, priority: "high", isSimulation: activity.isSimulation });
      }
    }
    for (const event of x.events) {
      if (event.status === "review" || event.status === "onsite") event.status = "new";
    }
    seedDemoReviewOutcomes(x);
    x.events.sort((a, b) => Number(b.time) - Number(a.time));
    x.monitoring = x.monitoring || { active: false, startedAt: null };
    if (x.monitoring.active && !x.sessions.some(cameraConnected)) x.monitoring = { active: false, startedAt: null };
    for (const event of x.events) {
      event.timestamp = event.timestamp || new Date(Number(event.time) || Date.now()).toISOString();
      event.description = event.description || event.detail || "";
      event.severity = event.severity || (event.status !== "resolved" && (event.priority === "high" || event.status === "new") ? "warning" : "info");
      event.reviewStatus = event.reviewStatus || (event.status === "resolved" ? "REVIEWED" : "PENDING");
      event.isSimulation = !!event.isSimulation;
      const station = x.sessions.find((s) => s.id === event.sessionId || s.desk === event.desk);
      if (station && event.sessionId !== station.id) event.sessionId = station.id;
    }
    for (const s of x.sessions) {
      const events = x.events.filter((e) => e.sessionId === s.id);
      const open = events.filter((e) => e.status !== "resolved");
      s.attentionStatus = open.some((e) => e.status === "new") ? "Perlu Ditinjau" : open.some((e) => e.status === "onsite") ? "Dalam Pemeriksaan" : open.some((e) => e.status === "review") ? "Sedang Dipantau" : events.length ? "Selesai" : "Normal";
      s.lastIndicator = events[0]?.title || "";
      s.lastIndicatorAt = events[0]?.time || null;
      s.monitoringStatus = s.stationType === "simulation" ? "Simulasi" : x.monitoring.active && cameraConnected(s) ? "Monitoring Aktif" : x.monitoring.active ? "Menunggu Kamera" : "Belum Dimulai";
    }
    x.schemaVersion = SCHEMA;
    return x;
  }
  function read() {
    try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && Array.isArray(raw.sessions)) return reconcile(raw); } catch (_) {}
    return reconcile(fresh());
  }
  function write(x) {
    x = reconcile(x);
    localStorage.setItem(KEY, JSON.stringify(x));
    window.dispatchEvent(new CustomEvent("ujiguard:updated"));
    return x;
  }
  function get() {
    const x = read();
    try { const raw = JSON.parse(localStorage.getItem(KEY)); if (!raw || raw.schemaVersion !== SCHEMA || raw.monitoring?.active !== x.monitoring.active) localStorage.setItem(KEY, JSON.stringify(x)); } catch (_) { localStorage.setItem(KEY, JSON.stringify(x)); }
    return x;
  }
  function addEvent(data) {
    const x = get(); const n = (x.lastEvent || 1048) + 1; x.lastEvent = n;
    const now = Date.now();
    const recentIndicators = x.events.filter((event) => event.sessionId === data.sessionId && now - event.time <= 5 * 60 * 1000).length + 1;
    const ev = { id: "EV-" + n, time: now, timestamp: new Date(now).toISOString(), status: "new", priority: "medium", severity: "warning", reviewStatus: "PENDING", repeatCount: recentIndicators, repeatWindowMinutes: 5, ...data };
    x.events.unshift(ev);
    if (ev.participantId && ev.examSessionId) x.activityLogs.unshift({ id: `ACT-${ev.id}`, eventId: ev.id, participantId: ev.participantId, sessionId: ev.examSessionId, title: ev.title, type: ev.type || "indicator", source: ev.isSimulation ? "Data Simulasi" : ev.source || "Tidak diketahui", time: ev.time, status: ev.status, isSimulation: !!ev.isSimulation });
    write(x); return ev;
  }
  function ingestMonitoringEvent(data) {
    if (!data?.id || get().events.some((event) => event.id === data.id || (data.originEventId && event.id === data.originEventId))) return null;
    const station = get().sessions.find((item) => item.participantNo === String(data.participantId).replace("PST-", "26-") || item.name === data.student);
    const event = { ...data, time: Date.parse(data.timestamp) || Date.now(), sessionId: station?.id || data.participantId, examSessionId: data.sessionId, student: data.student || data.participantName || data.participantId, participantNo: data.participantNo || "", desk: station?.desk || "A-01", detail: data.description || "", label: data.source, status: data.severity === "warning" ? "new" : "info", priority: data.severity === "warning" ? "high" : "low", isSimulation: false };
    const x = get(); x.events.unshift(event);
    x.activityLogs.unshift({ id: `ACT-${event.id}`, eventId: event.id, participantId: event.participantId, sessionId: event.examSessionId, title: event.title, type: event.type, source: event.source, time: event.time, status: event.status, isSimulation: false });
    write(x); return event;
  }
  function runDemoScenario() {
    return addEvent({ sessionId: "UG-2403", examSessionId: "SESSION-01", participantId: "PST-003", student: "Dewi Anggraini", participantNo: "26-003", desk: "A-03", type: "visual", title: "Wajah tidak terdeteksi selama 6 detik", detail: "Skenario demo untuk memperlihatkan alur tinjauan. Ini data simulasi, bukan hasil deteksi kamera atau AI.", source: "Visual / Simulasi", label: "Data Simulasi", isSimulation: true, priority: "medium" });
  }
  function resetDemo() {
    const x = fresh(); write(x);
    try { const channel = new BroadcastChannel("ujiguard-demo"); channel.postMessage({ type: "reset" }); channel.close(); } catch (_) {}
    return x;
  }
  function updateEvent(id, changes) {
    const x = get(); const e = x.events.find((item) => item.id === id); if (!e) return null;
    Object.assign(e, changes, { updatedAt: Date.now() }); write(x); return e;
  }
  function reviewEvent(id, status, reviewer, action, note = "") {
    const x = get();
    const event = x.events.find((item) => item.id === id);
    if (!event) return null;
    const fromStatus = event.status;
    const time = Date.now();
    Object.assign(event, { status, note, reviewedBy: reviewer, updatedAt: time, reviewStatus: status === "resolved" ? "REVIEWED" : status.toUpperCase() });
    x.reviewHistory.unshift({ id: `RV-${time}-${id}`, eventId: id, participantId: event.participantId || null, sessionId: event.examSessionId || null, action, fromStatus, toStatus: status, reviewer, note, time });
    x.activityLogs.filter((item) => item.eventId === id || item.id === id).forEach((item) => { item.status = status; });
    write(x);
    return event;
  }
  function addViolation(data) {
    if (!data?.participantId || !data?.sessionId || !data?.indicationTitle || !data?.violationType || !data?.reviewer) return null;
    const x = get();
    const record = { id: data.id || `VI-${Date.now()}-${x.violations.length + 1}`, ...data, createdAt: data.createdAt || new Date().toISOString() };
    x.violations.unshift(record);
    write(x);
    return record;
  }
  function upsertSession(s) { return updateSession(s.id, s) || s; }
  function updateSession(id, changes) {
    const x = get(); const s = x.sessions.find((item) => item.id === id || item.desk === id); if (!s) return null;
    Object.assign(s, changes); write(x); return s;
  }
  function setMonitoring(active) {
    const x = get();
    if (active && !x.sessions.some(cameraConnected)) return null;
    x.monitoring = { active: !!active, startedAt: active ? (x.monitoring?.startedAt || Date.now()) : null };
    write(x); return x.monitoring;
  }
  function saveParticipantSession(record) {
    if (!record?.participantId || !record?.sessionId) return null;
    const x = get();
    const index = x.participantSessions.findIndex((item) => item.participantId === record.participantId);
    const saved = { ...record };
    if (index >= 0) x.participantSessions[index] = saved;
    else x.participantSessions.unshift(saved);
    write(x);
    return saved;
  }
  function getParticipantSession(participantId) {
    return get().participantSessions.find((item) => item.participantId === participantId) || null;
  }
  function updateParticipantSession(participantId, changes) {
    const x = get();
    const record = x.participantSessions.find((item) => item.participantId === participantId);
    if (!record) return null;
    Object.assign(record, changes, { updatedAt: Date.now() });
    write(x);
    return record;
  }
  function currentUser() { try { return JSON.parse(sessionStorage.getItem("ujiguard_user") || "null"); } catch (_) { return null; } }
  function setUser(u) { sessionStorage.setItem("ujiguard_user", JSON.stringify(u)); }
  function logout() { sessionStorage.removeItem("ujiguard_user"); location.href = "../../pages/login/index.html"; }
  function fmt(ts) { return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts)); }
  function fmtLong(ts) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts)); }
  function ago(ts) { const n = Math.max(0, Math.floor((Date.now() - ts) / 60000)); return n < 1 ? "baru saja" : n < 60 ? n + " mnt lalu" : Math.floor(n / 60) + " jam lalu"; }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function toast(msg) { let el = document.querySelector(".toast"); if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); } el.textContent = msg; el.classList.remove("hide"); clearTimeout(window.__ugToast); window.__ugToast = setTimeout(() => el.classList.add("hide"), 2800); }
  function requireRole(role) { const u = currentUser(); if (!u || u.role !== role) { location.replace("../../pages/login/index.html"); return null; } return u; }
  window.UjiStore = { KEY, get, addEvent, ingestMonitoringEvent, runDemoScenario, resetDemo, updateEvent, reviewEvent, addViolation, upsertSession, updateSession, setMonitoring, saveParticipantSession, getParticipantSession, updateParticipantSession, currentUser, setUser, logout, fmt, fmtLong, ago, esc, toast, requireRole, cameraConnected };
})();
