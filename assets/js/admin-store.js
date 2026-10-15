(function () {
  "use strict";
  const KEY = "ujiguard_admin_master_v1";
  const COLLECTIONS = ["users", "participants", "exams", "examSessions", "proctorAssignments"];
  const seed = {
    users: [
      { id: "PGW-001", role: "proctor", name: "Alya Pratama", email: "pengawas@ujiguard.demo", password: "demo123", status: "Aktif" },
      { id: "ADM-001", role: "admin", name: "Admin UjiGuard", email: "admin@ujiguard.demo", password: "demo123", status: "Aktif" },
      { id: "PGW-002", role: "proctor", name: "Surya Mahendra", email: "surya@ujiguard.demo", password: "demo123", status: "Aktif" },
      { id: "PGW-003", role: "proctor", name: "Nita Kusuma", email: "nita@ujiguard.demo", password: "demo123", status: "Aktif" },
      { id: "PGW-004", role: "proctor", name: "Arif Santoso", email: "arif@ujiguard.demo", password: "demo123", status: "Nonaktif" },
    ],
    participants: [
      { id: "PST-001", participantNo: "26-001", role: "participant", name: "Nadia Putri", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar" },
      { id: "PST-002", participantNo: "26-002", role: "participant", name: "Rafi Pratama", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-003", participantNo: "26-003", role: "participant", name: "Dewi Anggraini", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-004", participantNo: "26-004", role: "participant", name: "Bima Saputra", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-005", participantNo: "26-005", role: "participant", name: "Salsa Maharani", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-006", participantNo: "26-006", role: "participant", name: "Farhan Akbar", examId: "EXAM-001", sessionId: "SESSION-01", status: "Terdaftar", demoData: true },
      { id: "PST-007", participantNo: "26-007", role: "participant", name: "Intan Permata", examId: "EXAM-002", sessionId: "SESSION-02", status: "Aktif", demoData: true },
      { id: "PST-008", participantNo: "26-008", role: "participant", name: "Arman Wijaya", examId: "EXAM-003", sessionId: "SESSION-03", status: "Nonaktif", demoData: true },
    ],
    exams: [
      { id: "EXAM-001", name: "Ujian Kompetensi Dasar", type: "Mandiri", description: "Ujian demo UjiGuard.", status: "Aktif" },
      { id: "EXAM-002", name: "Uji Kompetensi Lapangan", type: "Terjadwal", description: "Sesi onsite untuk variasi demo admin.", status: "Aktif" },
      { id: "EXAM-003", name: "Sertifikasi Lanjutan", type: "Terjadwal", description: "Ujian demo yang akan datang.", status: "Draft" },
      { id: "EXAM-004", name: "Ujian Kompetensi Dasar 2025", type: "Mandiri", description: "Contoh ujian yang telah selesai.", status: "Selesai" },
    ],
    examSessions: [
      { id: "SESSION-01", examId: "EXAM-001", name: "Sesi 01", date: "2026-10-16", startTime: "09:00", endTime: "10:00", mode: "REMOTE", location: "", examUrl: "https://example.com/exam/123", status: "Akan Datang" },
      { id: "SESSION-02", examId: "EXAM-002", name: "Sesi Onsite 01", date: "2026-10-14", startTime: "13:00", endTime: "15:00", mode: "ONSITE", location: "Kampus UjiGuard · Ruang Cendekia", examUrl: "https://example.org/cbt/session-02", status: "Aktif" },
      { id: "SESSION-03", examId: "EXAM-003", name: "Sesi 01", date: "2026-10-18", startTime: "09:00", endTime: "11:00", mode: "REMOTE", location: "", examUrl: "https://example.net/moodle/quiz/103", status: "Akan Datang" },
      { id: "SESSION-04", examId: "EXAM-004", name: "Sesi Arsip", date: "2026-10-10", startTime: "09:00", endTime: "11:00", mode: "ONSITE", location: "Aula Utama", status: "Selesai" },
    ],
    proctorAssignments: [
      { sessionId: "SESSION-01", proctorId: "PGW-001" },
      { sessionId: "SESSION-02", proctorId: "PGW-002" },
    ],
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function get() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && typeof saved === "object") {
        const state = {};
        COLLECTIONS.forEach((key) => { state[key] = Array.isArray(saved[key]) ? saved[key] : clone(seed[key]); });
        // Add demo master data to existing prototype data without replacing admin edits.
        ["users", "exams", "examSessions"].forEach((collection) => {
          for (const demoRecord of seed[collection]) {
            const existing = state[collection].find((item) => item.id === demoRecord.id);
            if (!existing) state[collection].push(clone(demoRecord));
            else if (collection === "examSessions") {
              if (!Object.prototype.hasOwnProperty.call(existing, "examUrl") && demoRecord.examUrl) existing.examUrl = demoRecord.examUrl;
            }
          }
        });
        for (const demoParticipant of seed.participants) {
          if (!state.participants.some((item) => item.id === demoParticipant.id)) state.participants.push(clone(demoParticipant));
        }
        for (const assignment of seed.proctorAssignments) {
          if (!state.proctorAssignments.some((item) => item.sessionId === assignment.sessionId && item.proctorId === assignment.proctorId)) state.proctorAssignments.push(clone(assignment));
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
  function resetDemo() {
    const state = clone(seed);
    write(state);
    return get();
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
  window.UjiAdminStore = { KEY, get, write, save, resetDemo, assignProctor, removeAssignment, sessionBounds, formatSessionTime };
})();
