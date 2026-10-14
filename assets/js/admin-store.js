(function () {
  "use strict";
  const KEY = "ujiguard_admin_master_v1";
  const COLLECTIONS = ["users", "participants", "exams", "examSessions", "proctorAssignments"];
  const seed = {
    users: [
      { id: "PGW-001", role: "proctor", name: "Alya Pratama", email: "pengawas@ujiguard.demo", password: "demo123", status: "Aktif" },
      { id: "ADM-001", role: "admin", name: "Admin UjiGuard", email: "admin@ujiguard.demo", password: "demo123", status: "Aktif" },
    ],
    participants: [
      { id: "PST-001", participantNo: "26-001", role: "participant", name: "Nadia Putri", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar" },
      { id: "PST-002", participantNo: "26-002", role: "participant", name: "Rafi Pratama", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-003", participantNo: "26-003", role: "participant", name: "Dewi Anggraini", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-004", participantNo: "26-004", role: "participant", name: "Bima Saputra", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-005", participantNo: "26-005", role: "participant", name: "Salsa Maharani", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-006", participantNo: "26-006", role: "participant", name: "Farhan Akbar", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
    ],
    exams: [
      { id: "EXAM-001", name: "Ujian Kompetensi Dasar", type: "Mandiri", description: "Ujian demo UjiGuard.", status: "Aktif" },
    ],
    examSessions: [
      { id: "SESSION-01", examId: "EXAM-001", name: "Sesi 01", date: "2026-10-15", startTime: "09:00", endTime: "10:00", mode: "REMOTE", location: "", status: "Akan Datang" },
    ],
    proctorAssignments: [
      { sessionId: "SESSION-01", proctorId: "PGW-001" },
    ],
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function get() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && typeof saved === "object") {
        const state = {};
        COLLECTIONS.forEach((key) => { state[key] = Array.isArray(saved[key]) ? saved[key] : clone(seed[key]); });
        // Add demo participants to existing prototype data without replacing admin edits.
        for (const demoParticipant of seed.participants.filter((item) => item.demoData)) {
          if (!state.participants.some((item) => item.id === demoParticipant.id)) state.participants.push(clone(demoParticipant));
        }
        return state;
      }
    } catch (_) {}
    const state = clone(seed);
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }
  function write(state) {
    const next = {};
    COLLECTIONS.forEach((key) => { next[key] = Array.isArray(state[key]) ? state[key] : []; });
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("ujiguard:admin-data-updated", { detail: { key: KEY } }));
    return clone(next);
  }
  function save(collection, record) {
    if (!COLLECTIONS.includes(collection) || !record?.id) return null;
    const state = get();
    const rows = state[collection];
    const id = String(record.id).trim();
    const index = rows.findIndex((row) => row.id === id);
    const saved = { ...(index >= 0 ? rows[index] : {}), ...record, id };
    if (index >= 0) rows[index] = saved;
    else rows.unshift(saved);
    write(state);
    return saved;
  }
  function assignProctor(sessionId, proctorId) {
    const state = get();
    if (!state.examSessions.some((item) => item.id === sessionId) || !state.users.some((item) => item.id === proctorId && item.role === "proctor" && item.status === "Aktif")) return null;
    if (!state.proctorAssignments.some((item) => item.sessionId === sessionId && item.proctorId === proctorId)) {
      state.proctorAssignments.push({ sessionId, proctorId });
      write(state);
    }
    return state.proctorAssignments.find((item) => item.sessionId === sessionId && item.proctorId === proctorId) || null;
  }
  function removeAssignment(sessionId, proctorId) {
    const state = get();
    state.proctorAssignments = state.proctorAssignments.filter((item) => !(item.sessionId === sessionId && item.proctorId === proctorId));
    write(state);
  }
  function sessionDateTime(date, time) {
    if (!date || !time) return NaN;
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite)) return NaN;
    // Demo schedule values are WIB (UTC+7), independent of the device timezone.
    return Date.UTC(year, month - 1, day, hour - 7, minute);
  }
  function sessionBounds(session) {
    return { startAt: sessionDateTime(session?.date, session?.startTime), endAt: sessionDateTime(session?.date, session?.endTime) };
  }
  function formatSessionTime(session) {
    if (!session) return "Jadwal sesi belum tersedia";
    const startAt = sessionDateTime(session.date, session.startTime);
    const endAt = sessionDateTime(session.date, session.endTime);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return "Jadwal sesi belum valid";
    const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" }).format(new Date(startAt));
    return `${date} · ${session.startTime}–${session.endTime} WIB`;
  }
  window.UjiAdminStore = { KEY, get, write, save, assignProctor, removeAssignment, sessionBounds, formatSessionTime };
})();
