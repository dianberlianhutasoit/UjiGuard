(function () {
  "use strict";
  const user = window.UjiAuth.currentUser();
  if (!user || user.role !== "participant") { location.replace("../login/index.html"); return; }
  const $ = (id) => document.getElementById(id);
  const demo = window.UjiAuth.findById(user.id);
  if (!demo) { location.replace("../login/index.html"); return; }
  const adminData = UjiAdminStore.get();
  const schedule = adminData.examSessions.find((item) => item.id === demo.sessionId && item.examId === demo.examId);
  const bounds = UjiAdminStore.sessionBounds(schedule);
  if (!schedule || !Number.isFinite(bounds.startAt) || !Number.isFinite(bounds.endAt) || bounds.endAt <= bounds.startAt) { location.replace("identity.html"); return; }
  const previousSession = UjiStore.getParticipantSession(demo.id);
  const samePreviousSession = previousSession?.sessionId === demo.sessionId;
  const wasMonitoringInterrupted = samePreviousSession && ["Terhenti", "Monitoring Aktif"].includes(previousSession.monitoringStatus);
  const abandonedSession = samePreviousSession && previousSession.monitoringStatus === "Keluar Sebelum Selesai";
  if (samePreviousSession && previousSession?.monitoringStatus === "Monitoring Aktif") {
    UjiStore.updateParticipantSession(demo.id, { monitoringStatus: "Terhenti", leftAt: new Date().toISOString() });
  }
  let cameraStream = null;
  let microphoneStream = null;
  let displayStream = null;
  let activeRecord = null;
  let stopRtc = null;
  let sessionStarted = false;
  let sessionEnded = false;
  let countdownTimer = null;
  const deviceFailureReported = new Set();
  let screenStopReported = false;
  let screenState = "SCREEN_STOPPED";
  let selectedDisplaySurface = null;
  let lastConnectionOnline = navigator.onLine;

  const statusIds = { camera: "camera-status", microphone: "microphone-status", connection: "connection-status" };
  const setStatus = (kind, value) => {
    const node = $(statusIds[kind]);
    node.textContent = value;
    node.classList.toggle("is-active", value === "Aktif" || value === "Jaringan Tersedia");
    node.classList.toggle("is-error", value === "Bermasalah" || value === "Tidak Ada Jaringan");
  };
  const isLive = (stream, kind) => !!stream?.getTracks().some((track) => track.kind === kind && track.readyState === "live" && !track.muted);
  const isScheduleCompleted = () => UjiAdminStore.get().examSessions.some((item) => item.id === demo.sessionId && item.examId === demo.examId && item.status === "Selesai");
  const canEnterSession = () => !abandonedSession && !isScheduleCompleted() && Date.now() >= bounds.startAt && Date.now() < bounds.endAt;
  const updateEnterButton = () => {
    const ready = isLive(cameraStream, "video") && isLive(microphoneStream, "audio") && canEnterSession();
    $("prepare-monitoring").disabled = !ready;
    $("enter-exam").disabled = !(ready && screenState === "SCREEN_ACTIVE" && selectedDisplaySurface === "monitor" && isLive(displayStream, "video"));
  };
  const stationForParticipant = () => UjiStore.get().sessions.find((item) => item.participantNo === demo.participantNo || item.name === demo.name);
  const recordMonitoringEvent = (type, title, description, severity = "info") => {
    const station = stationForParticipant();
    const event = UjiStore.addEvent({ participantId: demo.id, examSessionId: demo.sessionId, sessionId: station?.id || demo.id, student: demo.name, participantNo: demo.participantNo || station?.participantNo || "", desk: station?.desk || "A-01", type, title, detail: description, description, source: "Browser / Monitoring", severity, status: severity === "warning" ? "new" : "info", priority: severity === "warning" ? "high" : "low", isSimulation: false, reviewStatus: "PENDING" });
    fetch("/monitoring-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originEventId: event.id, participantId: demo.id, sessionId: demo.sessionId, type, title, description, severity }) }).catch(() => {});
    return event;
  };
  const updateConnectionStatus = () => {
    const status = navigator.onLine ? "Jaringan Tersedia" : "Tidak Ada Jaringan";
    setStatus("connection", status);
    $("prep-connection-status").textContent = navigator.onLine ? "Terhubung" : "Terputus";
    if (sessionStarted && !sessionEnded && lastConnectionOnline !== navigator.onLine) {
      recordMonitoringEvent(navigator.onLine ? "CONNECTION_RESTORED" : "CONNECTION_LOST", navigator.onLine ? "Koneksi monitoring kembali" : "Koneksi monitoring terputus", navigator.onLine ? "Browser kembali terhubung ke jaringan." : "Browser melaporkan koneksi jaringan terputus.", navigator.onLine ? "info" : "warning");
    }
    lastConnectionOnline = navigator.onLine;
    if (sessionStarted && activeRecord && !sessionEnded) {
      const devicesOkay = isLive(cameraStream, "video") && isLive(microphoneStream, "audio");
      const monitoringStatus = !devicesOkay ? "Perangkat Bermasalah" : navigator.onLine ? "Monitoring Aktif" : "Jaringan Bermasalah";
      UjiStore.updateParticipantSession(user.id, { monitoringStatus });
      activeRecord.monitoringStatus = monitoringStatus;
      $("active-connection-status").textContent = status;
      $("active-connection-status").classList.toggle("is-error", status !== "Jaringan Tersedia");
      $("active-monitoring-status").textContent = monitoringStatus;
    }
  };
  const stopStreams = () => {
    if (stopRtc) { stopRtc(); stopRtc = null; }
    [cameraStream, microphoneStream].forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
    displayStream?.getTracks().forEach((track) => track.stop());
    displayStream = null;
    cameraStream = null;
    microphoneStream = null;
    $("camera-preview").srcObject = null;
    $("active-camera-source").srcObject = null;
    $("active-microphone-source").srcObject = null;
  };
  const finishSession = (early = false) => {
    if (!activeRecord || sessionEnded) return;
    sessionEnded = true;
    clearInterval(countdownTimer);
    const endedAt = new Date().toISOString();
    const status = early ? "Keluar Sebelum Selesai" : "SELESAI";
    UjiStore.updateParticipantSession(user.id, {
      monitoringStatus: status,
      leftAt: endedAt,
      endedAt: early ? null : endedAt,
    });
    activeRecord.monitoringStatus = status;
    stopStreams();
    location.replace(`exam-finished.html?status=${encodeURIComponent(status)}`);
  };
  const showTrackProblem = (kind) => {
    const key = kind === "video" ? "cameraStatus" : "microphoneStatus";
    const label = kind === "video" ? "Kamera" : "Mikrofon";
    if (!sessionStarted) {
      setStatus(kind === "video" ? "camera" : "microphone", "Bermasalah");
      $("device-error").textContent = `${label} terputus. Periksa perangkat dan ulangi pemeriksaan sebelum masuk ujian.`;
      $("device-error").classList.remove("hide");
      updateEnterButton();
      return;
    }
    if (activeRecord && !sessionEnded) {
      activeRecord[key] = "Bermasalah";
      activeRecord.monitoringStatus = "Perangkat Bermasalah";
      UjiStore.updateParticipantSession(user.id, { [key]: "Bermasalah", monitoringStatus: "Perangkat Bermasalah" });
      if (!deviceFailureReported.has(kind)) {
        deviceFailureReported.add(kind);
        recordMonitoringEvent(kind === "video" ? "CAMERA_OFF" : "MIC_OFF", `${label} peserta tidak aktif`, `Track ${label.toLowerCase()} peserta terputus saat monitoring aktif.`, "warning");
      }
      const target = kind === "video" ? "active-camera-status" : "active-microphone-status";
      $(target).textContent = "Bermasalah";
      $(target).classList.add("is-error");
      $("active-monitoring-status").textContent = "Perangkat Bermasalah";
    }
  };
  const restoreTrack = (kind) => {
    if (!sessionStarted || !activeRecord || sessionEnded || !deviceFailureReported.has(kind)) return;
    const stream = kind === "video" ? cameraStream : microphoneStream;
    const trackKind = kind === "video" ? "video" : "audio";
    if (!isLive(stream, trackKind)) return;
    deviceFailureReported.delete(kind);
    const key = kind === "video" ? "cameraStatus" : "microphoneStatus";
    const target = kind === "video" ? "active-camera-status" : "active-microphone-status";
    activeRecord[key] = "Aktif";
    $(target).textContent = "Aktif";
    $(target).classList.remove("is-error");
    const devicesOkay = isLive(cameraStream, "video") && isLive(microphoneStream, "audio");
    if (devicesOkay) {
      activeRecord.monitoringStatus = navigator.onLine ? "Monitoring Aktif" : "Jaringan Bermasalah";
      UjiStore.updateParticipantSession(user.id, { [key]: "Aktif", monitoringStatus: activeRecord.monitoringStatus });
      $("active-monitoring-status").textContent = activeRecord.monitoringStatus;
    } else UjiStore.updateParticipantSession(user.id, { [key]: "Aktif" });
    recordMonitoringEvent(kind === "video" ? "CAMERA_ON" : "MIC_ON", `${kind === "video" ? "Kamera" : "Mikrofon"} kembali aktif`, `Track ${kind === "video" ? "kamera" : "mikrofon"} kembali aktif.`);
  };
  const formatCountdown = (target) => {
    const seconds = Math.floor(Math.max(0, target - Date.now()) / 1000);
    const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${secs}`;
  };
  const tickCountdown = () => {
    const now = Date.now();
    const scheduleCompleted = isScheduleCompleted();
    const ended = scheduleCompleted || now >= bounds.endAt;
    const beforeStart = !scheduleCompleted && now < bounds.startAt;
    const target = beforeStart ? bounds.startAt : bounds.endAt;
    const remaining = Math.max(0, bounds.endAt - now);
    $("session-countdown").textContent = formatCountdown(bounds.endAt);
    $("session-gate-status").textContent = abandonedSession ? "Sesi telah ditinggalkan sebelum waktu selesai" : ended ? "Sesi telah selesai" : beforeStart ? "Sesi belum dimulai" : "Sesi sedang berlangsung";
    $("session-gate-label").textContent = ended || abandonedSession ? "" : beforeStart ? "Mulai dalam" : "Waktu tersisa";
    $("session-gate-countdown").textContent = ended || abandonedSession ? "" : formatCountdown(target);
    $("session-gate").classList.toggle("is-ended", ended);
    updateEnterButton();
    if ($("prep-session-status")) $("prep-session-status").textContent = ended || abandonedSession ? "Tidak tersedia" : beforeStart ? "Menunggu waktu sesi" : "Siap dimulai";
    if (sessionStarted && (scheduleCompleted || remaining <= 0)) finishSession(false);
  };

  $("header-name").textContent = demo.name;
  $("header-id").textContent = demo.id;
  $("summary-exam").textContent = demo.examName;
  $("summary-name").textContent = demo.name;
  $("summary-id").textContent = demo.id;
  $("summary-session").textContent = demo.sessionId;
  $("summary-time").textContent = demo.sessionTime;
  $("summary-mode").textContent = demo.mode;
  $("prep-camera-status").textContent = "Belum aktif";
  $("prep-microphone-status").textContent = "Belum aktif";
  $("prep-connection-status").textContent = navigator.onLine ? "Terhubung" : "Terputus";
  if (schedule.examUrl) {
    try { const url = new URL(schedule.examUrl); if (["https:", "http:"].includes(url.protocol)) { $("open-exam-link").href = url.href; $("external-exam-fallback").textContent = "Jika tab ujian tidak terbuka otomatis, gunakan tombol Buka Link Ujian."; } }
    catch (_) {}
  }
  $("active-exam-name").textContent = demo.examName;
  $("active-name").textContent = demo.name;
  $("active-id").textContent = demo.id;
  $("active-session").textContent = demo.sessionId;
  $("active-time").textContent = demo.sessionTime;
  $("active-start-time").textContent = `${UjiAdminStore.formatClock(schedule.startTime)} WIB`;
  $("active-end-time").textContent = `${UjiAdminStore.formatClock(schedule.endTime)} WIB`;
  $("active-mode").textContent = demo.mode;
  if (abandonedSession) {
    $("session-block-message").textContent = "Sesi ini telah ditinggalkan sebelum waktu selesai. Anda tidak dapat masuk kembali ke sesi yang sama.";
    $("session-block-message").classList.remove("hide");
    $("check-devices").disabled = true;
    $("enter-exam").disabled = true;
  }
  if (wasMonitoringInterrupted && !abandonedSession) $("session-interruption-note").classList.remove("hide");
  tickCountdown();
  countdownTimer = setInterval(tickCountdown, 1000);
  updateConnectionStatus();

  $("check-devices").addEventListener("click", async () => {
    if (abandonedSession) return;
    stopStreams();
    sessionStarted = false;
    activeRecord = null;
    setStatus("camera", "Belum Aktif");
    setStatus("microphone", "Belum Aktif");
    $("prep-camera-status").textContent = "Belum aktif";
    $("prep-microphone-status").textContent = "Belum aktif";
    updateConnectionStatus();
    $("device-error").classList.add("hide");
    $("preview-empty").classList.remove("hide");
    $("enter-exam").disabled = true;
    $("check-devices").disabled = true;
    if (isScheduleCompleted() || Date.now() >= bounds.endAt) {
      $("device-error").textContent = isScheduleCompleted() ? "Status sesi telah selesai dan ujian tidak dapat dimulai." : "Waktu sesi ujian ini sudah berakhir.";
      $("device-error").classList.remove("hide");
      $("check-devices").disabled = false;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("camera", "Bermasalah");
      setStatus("microphone", "Bermasalah");
      $("device-error").textContent = "Browser tidak menyediakan akses media. Buka halaman melalui localhost atau HTTPS dan gunakan browser yang mendukung kamera/mikrofon.";
      $("device-error").classList.remove("hide");
      $("check-devices").disabled = false;
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      $("camera-preview").srcObject = cameraStream;
      $("preview-empty").classList.add("hide");
      setStatus("camera", "Aktif");
      $("prep-camera-status").textContent = "Aktif";
      deviceFailureReported.delete("video");
      cameraStream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => showTrackProblem("video"), { once: true });
        track.addEventListener("mute", () => showTrackProblem("video"));
        track.addEventListener("unmute", () => restoreTrack("video"));
      });
    } catch (_) { setStatus("camera", "Bermasalah"); }
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      $("active-microphone-source").srcObject = microphoneStream;
      $("active-microphone-source").play().catch(() => {});
      setStatus("microphone", "Aktif");
      $("prep-microphone-status").textContent = "Aktif";
      deviceFailureReported.delete("audio");
      microphoneStream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => showTrackProblem("audio"), { once: true });
        track.addEventListener("mute", () => showTrackProblem("audio"));
        track.addEventListener("unmute", () => restoreTrack("audio"));
      });
    } catch (_) { setStatus("microphone", "Bermasalah"); }
    updateConnectionStatus();
    if (!isLive(cameraStream, "video") || !isLive(microphoneStream, "audio")) {
      $("device-error").textContent = "Kamera dan mikrofon harus berstatus Aktif. Periksa izin browser atau perangkat, lalu pilih Periksa Ulang.";
      $("device-error").classList.remove("hide");
    }
    updateEnterButton();
    $("check-devices").disabled = false;
    $("check-devices").textContent = "Periksa Ulang Kamera & Mikrofon";
  });

  $("prepare-monitoring").addEventListener("click", () => {
    if (abandonedSession || !canEnterSession() || !isLive(cameraStream, "video") || !isLive(microphoneStream, "audio")) return;
    $("device-stage").classList.add("hide");
    $("monitoring-stage").classList.remove("hide");
    updateEnterButton();
  });
  $("share-screen").addEventListener("click", async () => {
    $("screen-error").classList.add("hide");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      $("screen-error").textContent = "Browser ini belum mendukung berbagi layar.";
      $("screen-error").classList.remove("hide"); return;
    }
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = displayStream.getVideoTracks()[0];
      if (!track) throw new Error("Tidak ada track layar.");
      const displaySurface = track.getSettings?.().displaySurface;
      if (displaySurface !== "monitor") {
        displayStream.getTracks().forEach((item) => item.stop());
        displayStream = null;
        selectedDisplaySurface = null;
        screenState = "SCREEN_DENIED";
        $("monitoring-stage").dataset.screenState = screenState;
        $("prep-screen-status").textContent = "Belum aktif";
        $("share-screen").textContent = "Bagikan Layar";
        $("screen-share-info").textContent = "";
        $("screen-error").textContent = "Untuk melanjutkan sesi, pilih Entire Screen.";
        $("screen-error").classList.remove("hide");
        updateEnterButton();
        return;
      }
      screenStopReported = false;
      selectedDisplaySurface = displaySurface;
      screenState = "SCREEN_ACTIVE";
      $("monitoring-stage").dataset.screenState = screenState;
      $("prep-screen-status").textContent = "Layar penuh aktif";
      $("share-screen").textContent = "Berbagi Layar Aktif";
      $("screen-share-info").textContent = "Layar penuh aktif.";
      track.addEventListener("ended", () => {
        displayStream = null;
        selectedDisplaySurface = null;
        screenState = "SCREEN_STOPPED";
        $("monitoring-stage").dataset.screenState = screenState;
        if (activeRecord) { activeRecord.screenStatus = "Dihentikan"; UjiStore.updateParticipantSession(user.id, { screenStatus: "Dihentikan" }); }
        $("prep-screen-status").textContent = "Dihentikan";
        $("active-screen-status").textContent = "Dihentikan";
        $("share-screen").textContent = "Bagikan Layar";
        updateEnterButton();
        if (sessionStarted && !sessionEnded && !screenStopReported) {
          screenStopReported = true;
          recordMonitoringEvent("SCREEN_STOPPED", "Berbagi layar dihentikan", "Peserta menghentikan berbagi layar saat sesi monitoring aktif.", "warning");
        }
      }, { once: true });
      updateEnterButton();
    } catch (error) {
      displayStream = null;
      selectedDisplaySurface = null;
      screenState = "SCREEN_DENIED";
      $("monitoring-stage").dataset.screenState = screenState;
      $("prep-screen-status").textContent = error?.name === "NotAllowedError" ? "Izin ditolak" : "Belum aktif";
      $("screen-error").textContent = error?.name === "NotAllowedError" ? "Izin berbagi layar tidak diberikan." : "Berbagi layar belum dapat dimulai. Coba lagi.";
      $("screen-error").classList.remove("hide");
      updateEnterButton();
    }
  });
  $("enter-exam").addEventListener("click", () => {
    if (abandonedSession || isScheduleCompleted() || !isLive(cameraStream, "video") || !isLive(microphoneStream, "audio") || screenState !== "SCREEN_ACTIVE" || selectedDisplaySurface !== "monitor" || !isLive(displayStream, "video") || !canEnterSession()) return;
    const joinedAt = new Date().toISOString();
    deviceFailureReported.clear();
    activeRecord = {
      participantId: demo.id, name: demo.name, examId: demo.examId, sessionId: demo.sessionId,
      cameraStatus: "Aktif", microphoneStatus: "Aktif", screenStatus: "Layar penuh aktif", monitoringStatus: "Monitoring Aktif",
      scheduledStartAt: new Date(bounds.startAt).toISOString(), scheduledEndAt: new Date(bounds.endAt).toISOString(), joinedAt,
    };
    UjiStore.saveParticipantSession(activeRecord);
    sessionStarted = true;
    recordMonitoringEvent("MONITORING_STARTED", "Sesi monitoring dimulai", "Kamera, mikrofon, dan berbagi layar aktif.");
    recordMonitoringEvent("SCREEN_STARTED", "Berbagi layar aktif", "Screen sharing dimulai sebagai sinyal monitoring.");
    if (demo.id === "PST-001" && window.UjiRtc) {
      stopRtc = UjiRtc.startStation(() => cameraStream, () => activeRecord && ({
        participantId: activeRecord.participantId, name: activeRecord.name, examId: activeRecord.examId,
        sessionId: activeRecord.sessionId, cameraStatus: activeRecord.cameraStatus,
        microphoneStatus: activeRecord.microphoneStatus, screenStatus: activeRecord.screenStatus, monitoringStatus: activeRecord.monitoringStatus,
        joinedAt: activeRecord.joinedAt,
      }), () => displayStream);
    }
    $("active-joined-at").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(joinedAt));
    $("active-camera-source").srcObject = cameraStream;
    $("active-camera-source").play().catch(() => {});
    $("camera-preview").srcObject = null;
    $("device-stage").classList.add("hide");
    $("exam-stage").classList.remove("hide");
    $("external-exam-fallback").classList.toggle("hide", !$("open-exam-link").href || $("open-exam-link").href.endsWith("#"));
    $("open-exam-link").classList.toggle("hide", !$("open-exam-link").href || $("open-exam-link").href.endsWith("#"));
    $("active-monitoring-status").textContent = "Monitoring Aktif";
    tickCountdown();
    if ($("open-exam-link").href && !$("open-exam-link").href.endsWith("#")) {
      const opened = window.open($("open-exam-link").href, "_blank");
      if (opened) opened.opener = null;
      if (!opened) { $("external-exam-fallback").classList.remove("hide"); $("open-exam-link").classList.remove("hide"); }
    }
  });

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  document.addEventListener("visibilitychange", () => {
    if (sessionStarted && !sessionEnded) recordMonitoringEvent("PAGE_VISIBILITY_CHANGED", "Fokus halaman monitoring berubah", document.hidden ? "Halaman TERVIA menjadi tidak terlihat; aktivitas ini bersifat informasional." : "Halaman TERVIA kembali terlihat.");
  });
  $("leave-exam").addEventListener("click", () => {
    if (window.confirm("Keluar sebelum waktu sesi selesai? Kamera dan mikrofon akan dihentikan.")) finishSession(true);
  });
  $("logout-button").addEventListener("click", () => {
    if (sessionStarted && !sessionEnded) {
      if (!window.confirm("Keluar sebelum waktu sesi selesai? Kamera dan mikrofon akan dihentikan.")) return;
      finishSession(true);
      return;
    }
    stopStreams();
    window.UjiAuth.signOut();
    location.href = "../login/index.html";
  });
  window.addEventListener("pagehide", () => {
    clearInterval(countdownTimer);
    if (sessionStarted && !sessionEnded) UjiStore.updateParticipantSession(user.id, { monitoringStatus: "Terhenti", leftAt: new Date().toISOString() });
    stopStreams();
  });
})();
