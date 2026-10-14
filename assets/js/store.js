(function () {
  "use strict";
  const KEY = "ujiguard_demo_v2";
  const SCHEMA = 6;
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
    ];
  }
  function fresh() { return { schemaVersion: SCHEMA, sessions: seed.map((s) => ({ ...s })), events: demoIndications(), reviewHistory: [], violations: [], participantSessions: [], lastEvent: 1048, monitoring: { active: false, startedAt: null } }; }
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
    x.reviewHistory = Array.isArray(x.reviewHistory) ? x.reviewHistory : [];
    x.violations = Array.isArray(x.violations) ? x.violations : [];
    x.participantSessions = Array.isArray(x.participantSessions) ? x.participantSessions : [];
    for (const demoEvent of demoIndications()) {
      if (!x.events.some((event) => event.id === demoEvent.id)) x.events.push(demoEvent);
    }
    for (const event of x.events) {
      if (event.status === "review" || event.status === "onsite") event.status = "new";
    }
    x.events.sort((a, b) => Number(b.time) - Number(a.time));
    x.monitoring = x.monitoring || { active: false, startedAt: null };
    if (x.monitoring.active && !x.sessions.some(cameraConnected)) x.monitoring = { active: false, startedAt: null };
    for (const event of x.events) {
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
    const ev = { id: "EV-" + n, time: now, status: "new", priority: "medium", repeatCount: recentIndicators, repeatWindowMinutes: 5, ...data };
    x.events.unshift(ev); write(x); return ev;
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
    Object.assign(event, { status, note, reviewedBy: reviewer, updatedAt: time });
    x.reviewHistory.unshift({ id: `RV-${time}-${id}`, eventId: id, participantId: event.participantId || null, sessionId: event.examSessionId || null, action, fromStatus, toStatus: status, reviewer, note, time });
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
  window.UjiStore = { KEY, get, addEvent, runDemoScenario, resetDemo, updateEvent, reviewEvent, addViolation, upsertSession, updateSession, setMonitoring, saveParticipantSession, getParticipantSession, updateParticipantSession, currentUser, setUser, logout, fmt, fmtLong, ago, esc, toast, requireRole, cameraConnected };
})();
