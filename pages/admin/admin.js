(function () {
  "use strict";
  const user = window.UjiAuth.currentUser();
  if (!user || user.role !== "admin") { location.replace("../login/index.html"); return; }
  const $ = (id) => document.getElementById(id);
  const esc = (value) => window.UjiStore.esc(value);
  const content = $("admin-content");
  const dialog = $("record-dialog");
  let activeView = "dashboard";
  let editing = null;
  const titles = { dashboard: "Dashboard Admin", exams: "Kelola Ujian", sessions: "Kelola Sesi Ujian", participants: "Kelola Peserta", proctors: "Kelola Pengawas", assignments: "Penugasan Pengawas" };
  const data = () => window.UjiAdminStore.get();
  const examName = (state, id) => state.exams.find((exam) => exam.id === id)?.name || "Ujian belum dipilih";
  const proctorName = (state, id) => state.users.find((item) => item.id === id)?.name || "Pengawas tidak ditemukan";
  const sessionName = (state, id) => state.examSessions.find((item) => item.id === id)?.name || "Sesi tidak ditemukan";
  const statusTag = (status) => `<span class="status-tag ${status === "Aktif" || status === "Terdaftar" ? "good" : status === "Akan Datang" ? "warn" : ""}">${esc(status || "-")}</span>`;
  const actions = (entity, id, extra = "") => `<div class="admin-actions"><button class="admin-action" data-action="edit" data-entity="${entity}" data-id="${esc(id)}">Edit</button>${extra}</div>`;
  const table = (headers, rows, empty) => rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map((item) => `<th>${item}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>` : `<div class="empty-admin">${empty}</div>`;
  const pageHead = (title, subtitle, button = "") => `<div class="admin-page-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${button}</div>`;
  const panel = (title, subtitle, inner) => `<section class="admin-panel"><header class="admin-panel-head"><div><h3>${title}</h3><p>${subtitle}</p></div></header>${inner}</section>`;

  function renderDashboard(state) {
    const upcoming = state.examSessions.map((session) => ({ session, ...UjiAdminStore.sessionBounds(session) }))
      .filter((item) => item.session.status === "Akan Datang" && item.startAt >= Date.now())
      .sort((a, b) => a.startAt - b.startAt).slice(0, 4);
    const metrics = [
      ["Total ujian", state.exams.length],
      ["Sesi aktif", state.examSessions.filter((item) => item.status === "Aktif").length],
      ["Total peserta", state.participants.length],
      ["Total pengawas", state.users.filter((item) => item.role === "proctor").length],
      ["Sesi akan datang", state.examSessions.filter((item) => item.status === "Akan Datang").length],
    ];
    const shortcuts = [["Buat Ujian", "exams"], ["Kelola Sesi", "sessions"], ["Kelola Peserta", "participants"], ["Kelola Pengawas", "proctors"]];
    const nextSession = upcoming.length ? upcoming.map(({ session }) => `<div class="upcoming-row"><div><strong>${esc(session.name)} · ${esc(examName(state, session.examId))}</strong><small>${esc(session.date)} · ${esc(session.startTime)}–${esc(session.endTime)} WIB · ${session.mode}</small></div>${statusTag(session.status)}</div>`).join("") : `<div class="empty-admin">Belum ada sesi yang akan datang.</div>`;
    content.innerHTML = `${pageHead("Ringkasan pelaksanaan", "Kelola ujian, jadwal sesi, peserta, dan penugasan pengawas.")}
      <div class="admin-metrics">${metrics.map(([label, value]) => `<article class="admin-metric"><span>${label}</span><strong>${value}</strong></article>`).join("")}</div>
      <div class="admin-shortcuts">${shortcuts.map(([label, view]) => `<button class="admin-shortcut" data-view="${view}">${label}<span>→</span></button>`).join("")}</div>
      ${panel("Sesi yang akan datang", "Jadwal berikutnya berdasarkan tanggal dan waktu mulai.", `<div class="upcoming-list">${nextSession}</div>`)}`;
  }

  function renderExams(state) {
    const rows = state.exams.map((exam) => `<tr><td><strong>${esc(exam.id)}</strong></td><td>${esc(exam.name)}</td><td>${esc(exam.type)}</td><td>${statusTag(exam.status)}</td><td>${actions("exam", exam.id)}</td></tr>`);
    content.innerHTML = `${pageHead("Kelola Ujian", "Buat dan perbarui data dasar ujian.", `<button class="btn btn-primary btn-sm" data-action="add" data-entity="exam">+ Buat Ujian</button>`)}${panel("Daftar ujian", `${state.exams.length} ujian`, table(["ID ujian", "Nama ujian", "Jenis", "Status", ""], rows, "Belum ada data ujian."))}`;
  }

  function renderSessions(state) {
    const rows = state.examSessions.map((session) => `<tr><td><strong>${esc(session.id)}</strong></td><td>${esc(examName(state, session.examId))}</td><td>${esc(session.name)}</td><td>${esc(session.date)}<br><small>${esc(session.startTime)}–${esc(session.endTime)} WIB</small></td><td>${session.mode === "ONSITE" ? "Onsite" : "Remote"}${session.mode === "ONSITE" && session.location ? `<br><small>${esc(session.location)}</small>` : ""}</td><td>${statusTag(session.status)}</td><td>${actions("session", session.id)}</td></tr>`);
    content.innerHTML = `${pageHead("Kelola Sesi Ujian", "Waktu mulai dan selesai pada sesi ini menjadi acuan flow peserta.", `<button class="btn btn-primary btn-sm" data-action="add" data-entity="session">+ Tambah Sesi</button>`)}${panel("Daftar sesi", `${state.examSessions.length} sesi`, table(["ID sesi", "Ujian", "Nama sesi", "Jadwal", "Mode / lokasi", "Status", ""], rows, "Belum ada sesi ujian."))}`;
  }

  function renderParticipants(state) {
    const rows = state.participants.map((participant) => `<tr><td><strong>${esc(participant.id)}</strong></td><td>${esc(participant.name)}</td><td>${esc(examName(state, participant.examId))}</td><td>${esc(sessionName(state, participant.sessionId))}</td><td>${statusTag(participant.status)}</td><td>${actions("participant", participant.id)}</td></tr>`);
    content.innerHTML = `${pageHead("Kelola Peserta", "Perbarui data peserta dan penempatan ujian/sesi.", `<button class="btn btn-primary btn-sm" data-action="add" data-entity="participant">+ Tambah Peserta</button>`)}${panel("Daftar peserta", `${state.participants.length} peserta`, table(["ID peserta", "Nama", "Ujian", "Sesi", "Status pendaftaran", ""], rows, "Belum ada peserta."))}`;
  }

  function renderProctors(state) {
    const proctors = state.users.filter((item) => item.role === "proctor");
    const rows = proctors.map((proctor) => {
      const toggle = `<button class="admin-action ${proctor.status === "Aktif" ? "danger" : ""}" data-action="toggle-proctor" data-id="${esc(proctor.id)}">${proctor.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}</button>`;
      return `<tr><td><strong>${esc(proctor.id)}</strong></td><td>${esc(proctor.name)}</td><td>${esc(proctor.email)}</td><td>${statusTag(proctor.status)}</td><td>${actions("proctor", proctor.id, toggle)}</td></tr>`;
    });
    content.innerHTML = `${pageHead("Kelola Pengawas", "Kelola data akun dan status aktif pengawas.", `<button class="btn btn-primary btn-sm" data-action="add" data-entity="proctor">+ Tambah Pengawas</button>`)}${panel("Daftar pengawas", `${proctors.length} pengawas · kata sandi tidak ditampilkan`, table(["ID pengawas", "Nama", "Email", "Status akun", ""], rows, "Belum ada pengawas."))}`;
  }

  function renderAssignments(state) {
    const sessions = state.examSessions;
    const proctors = state.users.filter((item) => item.role === "proctor" && item.status === "Aktif");
    const form = `<form class="assignment-form" id="assignment-form"><div class="admin-field"><label for="assignment-session">Sesi ujian</label><select id="assignment-session" name="sessionId" required>${sessions.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(examName(state, item.examId))}</option>`).join("")}</select></div><div class="admin-field"><label for="assignment-proctor">Pengawas aktif</label><select id="assignment-proctor" name="proctorId" required>${proctors.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.id)}</option>`).join("")}</select></div><button class="btn btn-primary btn-sm" type="submit" ${!sessions.length || !proctors.length ? "disabled" : ""}>Tugaskan</button></form>`;
    const rows = state.proctorAssignments.map((assignment) => `<tr><td><strong>${esc(assignment.sessionId)}</strong></td><td>${esc(sessionName(state, assignment.sessionId))}</td><td>${esc(proctorName(state, assignment.proctorId))} · ${esc(assignment.proctorId)}</td><td><button class="admin-action danger" data-action="remove-assignment" data-session-id="${esc(assignment.sessionId)}" data-proctor-id="${esc(assignment.proctorId)}">Hapus</button></td></tr>`);
    content.innerHTML = `${pageHead("Penugasan Pengawas", "Satu sesi dapat memiliki satu atau beberapa pengawas.")}${panel("Tugaskan pengawas ke sesi", "Pilih sesi dan pengawas aktif.", form + table(["ID sesi", "Nama sesi", "Pengawas", ""], rows, "Belum ada penugasan."))}`;
    $("assignment-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const saved = UjiAdminStore.assignProctor(values.get("sessionId"), values.get("proctorId"));
      if (!saved) window.UjiStore.toast("Pilih sesi dan pengawas aktif yang valid.");
      render();
    });
  }

  function render() {
    const state = data();
    $("admin-page-title").textContent = titles[activeView];
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === activeView));
    if (activeView === "dashboard") renderDashboard(state);
    if (activeView === "exams") renderExams(state);
    if (activeView === "sessions") renderSessions(state);
    if (activeView === "participants") renderParticipants(state);
    if (activeView === "proctors") renderProctors(state);
    if (activeView === "assignments") renderAssignments(state);
  }

  function optionList(items, value, label, selected) {
    return items.map((item) => `<option value="${esc(item[value])}" ${item[value] === selected ? "selected" : ""}>${esc(label(item))}</option>`).join("");
  }
  function selectField(name, label, options, selected, extra = "") {
    return `<div class="admin-field ${extra}"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}" required>${options}</select></div>`;
  }
  function inputField(name, label, value = "", type = "text", extra = "", required = true, attributes = "") {
    return `<div class="admin-field ${extra}"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${attributes}></div>`;
  }
  function openEditor(entity, id = "") {
    const state = data();
    const map = { exam: "exams", session: "examSessions", participant: "participants", proctor: "users" };
    const collection = map[entity];
    const record = id ? state[collection].find((item) => item.id === id) : null;
    if (entity === "proctor" && record?.role !== "proctor") return;
    editing = { entity, id: record?.id || null };
    const isEdit = !!record;
    $("dialog-eyebrow").textContent = entity === "exam" ? "UJIAN" : entity === "session" ? "SESI UJIAN" : entity === "participant" ? "PESERTA" : "PENGAWAS";
    $("dialog-title").textContent = `${isEdit ? "Edit" : "Tambah"} ${entity === "exam" ? "ujian" : entity === "session" ? "sesi" : entity === "participant" ? "peserta" : "pengawas"}`;
    const fields = [];
    fields.push(inputField("id", entity === "exam" ? "ID ujian" : entity === "session" ? "ID sesi" : entity === "participant" ? "ID peserta" : "ID pengawas", record?.id || "", "text", "", true, isEdit ? "readonly" : ""));

    if (entity === "exam") {
      fields.push(inputField("name", "Nama ujian", record?.name || ""));
      fields.push(selectField("type", "Jenis ujian", ["Mandiri", "Terstruktur", "Tryout"].map((value) => `<option ${value === (record?.type || "Mandiri") ? "selected" : ""}>${value}</option>`).join(""), record?.type));
      fields.push(`<div class="admin-field full"><label for="field-description">Deskripsi singkat</label><textarea id="field-description" name="description">${esc(record?.description || "")}</textarea></div>`);
      fields.push(selectField("status", "Status", ["Draft", "Aktif", "Selesai"].map((value) => `<option ${value === (record?.status || "Draft") ? "selected" : ""}>${value}</option>`).join(""), record?.status));
    } else if (entity === "session") {
      fields.push(selectField("examId", "Ujian", optionList(state.exams, "id", (item) => `${item.name} · ${item.id}`, record?.examId || state.exams[0]?.id), record?.examId || state.exams[0]?.id));
      fields.push(inputField("name", "Nama sesi", record?.name || "Sesi baru"));
      fields.push(inputField("date", "Tanggal (WIB)", record?.date || "2026-10-15", "date"));
      fields.push(inputField("startTime", "Waktu mulai", record?.startTime || "09:00", "time"));
      fields.push(inputField("endTime", "Waktu selesai", record?.endTime || "10:00", "time"));
      fields.push(selectField("mode", "Mode", `<option value="REMOTE" ${(record?.mode || "REMOTE") === "REMOTE" ? "selected" : ""}>Remote</option><option value="ONSITE" ${record?.mode === "ONSITE" ? "selected" : ""}>Onsite</option>`, record?.mode));
      fields.push(inputField("location", "Lokasi (untuk onsite)", record?.location || "", "text", "conditional-field full", false));
      fields.push(selectField("status", "Status", ["Akan Datang", "Aktif", "Selesai"].map((value) => `<option ${value === (record?.status || "Akan Datang") ? "selected" : ""}>${value}</option>`).join(""), record?.status));
    } else if (entity === "participant") {
      fields.push(inputField("name", "Nama peserta", record?.name || ""));
      fields.push(selectField("examId", "Ujian", optionList(state.exams, "id", (item) => `${item.name} · ${item.id}`, record?.examId || state.exams[0]?.id), record?.examId || state.exams[0]?.id));
      const matchingSessions = state.examSessions.filter((item) => item.examId === (record?.examId || state.exams[0]?.id));
      fields.push(selectField("sessionId", "Sesi", optionList(matchingSessions, "id", (item) => `${item.name} · ${item.id}`, record?.sessionId || matchingSessions[0]?.id), record?.sessionId || matchingSessions[0]?.id));
      fields.push(selectField("status", "Status pendaftaran", ["Terdaftar", "Aktif", "Nonaktif"].map((value) => `<option ${value === (record?.status || "Terdaftar") ? "selected" : ""}>${value}</option>`).join(""), record?.status));
    } else {
      fields.push(inputField("name", "Nama pengawas", record?.name || ""));
      fields.push(inputField("email", "Email", record?.email || "", "email"));
      fields.push(inputField("password", isEdit ? "Kata sandi (isi hanya jika ingin mengganti)" : "Kata sandi demo", "", "password", "full", !isEdit));
      fields.push(selectField("status", "Status akun", ["Aktif", "Nonaktif"].map((value) => `<option ${value === (record?.status || "Aktif") ? "selected" : ""}>${value}</option>`).join(""), record?.status));
    }
    $("dialog-fields").innerHTML = `<div class="admin-form-grid">${fields.join("")}</div>`;
    $("record-form").reset();
    // reset() restores markup defaults, which were rendered from the current record.
    const mode = $("field-mode");
    if (mode) mode.dispatchEvent(new Event("change"));
    dialog.showModal();
  }
  function updateParticipantSessionOptions(examId, selectedId) {
    const state = data();
    const select = $("field-sessionId");
    if (!select) return;
    const sessions = state.examSessions.filter((item) => item.examId === examId);
    select.innerHTML = sessions.map((item) => `<option value="${esc(item.id)}" ${item.id === selectedId ? "selected" : ""}>${esc(item.name)} · ${esc(item.id)}</option>`).join("");
    select.disabled = sessions.length === 0;
    select.required = sessions.length > 0;
  }

  content.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, entity, id } = button.dataset;
    if (action === "add") openEditor(entity);
    if (action === "edit") openEditor(entity, id);
    if (action === "toggle-proctor") {
      const state = data(); const proctor = state.users.find((item) => item.id === id && item.role === "proctor");
      if (proctor) { UjiAdminStore.save("users", { ...proctor, status: proctor.status === "Aktif" ? "Nonaktif" : "Aktif" }); render(); }
    }
    if (action === "remove-assignment") { UjiAdminStore.removeAssignment(button.dataset.sessionId, button.dataset.proctorId); render(); }
  });
  content.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-view]");
    if (nav) { activeView = nav.dataset.view; render(); }
  });
  document.querySelectorAll(".admin-nav [data-view]").forEach((button) => button.addEventListener("click", () => { activeView = button.dataset.view; render(); }));
  $("record-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const { entity, id } = editing;
    const record = { ...values };
    if (entity === "participant") record.role = "participant";
    if (entity === "proctor") record.role = "proctor";
    if (entity === "session" && record.mode === "REMOTE") record.location = "";
    if (entity === "proctor" && id && !record.password) delete record.password;
    if (entity === "session") {
      const startAt = UjiAdminStore.sessionBounds({ date: record.date, startTime: record.startTime, endTime: record.startTime }).startAt;
      const endAt = UjiAdminStore.sessionBounds({ date: record.date, startTime: record.endTime, endTime: record.endTime }).startAt;
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
        window.UjiStore.toast("Waktu selesai harus sesudah waktu mulai pada tanggal sesi.");
        return;
      }
      if (record.mode === "ONSITE" && !record.location.trim()) {
        window.UjiStore.toast("Isi lokasi untuk sesi Onsite.");
        return;
      }
    }
    if (entity === "participant") {
      const state = data();
      const validSessions = state.examSessions.filter((item) => {
        if (item.examId !== record.examId || !item.id || !item.date || !item.startTime || !item.endTime) return false;
        const sessionBounds = UjiAdminStore.sessionBounds(item);
        return Number.isFinite(sessionBounds.startAt) && Number.isFinite(sessionBounds.endAt) && sessionBounds.endAt > sessionBounds.startAt;
      });
      if (!record.sessionId || !validSessions.some((item) => item.id === record.sessionId)) {
        window.UjiStore.toast("Buat atau pilih sesi ujian terlebih dahulu.");
        return;
      }
    }
    const collection = { exam: "exams", session: "examSessions", participant: "participants", proctor: "users" }[entity];
    const saved = UjiAdminStore.save(collection, record);
    if (!saved) { window.UjiStore.toast("Data belum dapat disimpan. Periksa kembali ID dan pilihan form."); return; }
    dialog.close(); editing = null; render();
  });
  const closeDialog = () => { dialog.close(); editing = null; };
  $("close-dialog").addEventListener("click", closeDialog);
  $("cancel-dialog").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  $("dialog-fields").addEventListener("change", (event) => {
    if (event.target.id === "field-mode") {
      const location = $("field-location");
      location?.closest(".conditional-field")?.classList.toggle("hide", event.target.value !== "ONSITE");
      if (location) location.required = event.target.value === "ONSITE";
    }
    if (event.target.id === "field-examId" && editing?.entity === "participant") updateParticipantSessionOptions(event.target.value, "");
  });
  $("admin-logout").addEventListener("click", () => { window.UjiAuth.signOut(); location.href = "../login/index.html"; });
  document.querySelectorAll("[data-admin-name]").forEach((node) => { node.textContent = user.name; });
  window.addEventListener("storage", (event) => { if (event.key === UjiAdminStore.KEY || event.key === UjiStore.KEY) render(); });
  window.addEventListener("ujiguard:admin-data-updated", render);
  render();
})();
