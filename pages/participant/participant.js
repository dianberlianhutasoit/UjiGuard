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
  let activeRecord = null;
  let stopRtc = null;
  let sessionStarted = false;
  let sessionEnded = false;
  let countdownTimer = null;
  const deviceFailureReported = new Set();

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
    $("enter-exam").disabled = !(isLive(cameraStream, "video") && isLive(microphoneStream, "audio") && canEnterSession());
  };
  const updateConnectionStatus = () => {
    const status = navigator.onLine ? "Jaringan Tersedia" : "Tidak Ada Jaringan";
    setStatus("connection", status);
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
        const station = UjiStore.get().sessions.find((item) => item.participantNo === demo.participantNo || item.name === demo.name);
        UjiStore.addEvent({
          participantId: demo.id,
          examSessionId: demo.sessionId,
          sessionId: station?.id || demo.id,
          student: demo.name,
          participantNo: demo.participantNo || station?.participantNo || "",
          desk: station?.desk || "A-01",
          type: "device",
          title: `${label} peserta tidak aktif`,
          detail: `Track ${label.toLowerCase()} peserta terputus saat monitoring aktif.`,
          source: `Perangkat / ${label}`,
          status: "new",
          priority: "high",
        });
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
  $("active-exam-name").textContent = demo.examName;
  $("active-name").textContent = demo.name;
  $("active-id").textContent = demo.id;
  $("active-session").textContent = demo.sessionId;
  $("active-time").textContent = demo.sessionTime;
  $("active-start-time").textContent = `${schedule.startTime} WIB`;
  $("active-end-time").textContent = `${schedule.endTime} WIB`;
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

  $("enter-exam").addEventListener("click", () => {
    if (abandonedSession || isScheduleCompleted() || !isLive(cameraStream, "video") || !isLive(microphoneStream, "audio") || !canEnterSession()) return;
    const joinedAt = new Date().toISOString();
    deviceFailureReported.clear();
    activeRecord = {
      participantId: demo.id, name: demo.name, examId: demo.examId, sessionId: demo.sessionId,
      cameraStatus: "Aktif", microphoneStatus: "Aktif", monitoringStatus: "Monitoring Aktif",
      scheduledStartAt: new Date(bounds.startAt).toISOString(), scheduledEndAt: new Date(bounds.endAt).toISOString(), joinedAt,
    };
    UjiStore.saveParticipantSession(activeRecord);
    sessionStarted = true;
    if (demo.id === "PST-001" && window.UjiRtc) {
      stopRtc = UjiRtc.startStation(() => cameraStream, () => activeRecord && ({
        participantId: activeRecord.participantId, name: activeRecord.name, examId: activeRecord.examId,
        sessionId: activeRecord.sessionId, cameraStatus: activeRecord.cameraStatus,
        microphoneStatus: activeRecord.microphoneStatus, monitoringStatus: activeRecord.monitoringStatus,
        joinedAt: activeRecord.joinedAt,
      }));
    }
    $("active-joined-at").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(joinedAt));
    $("active-camera-source").srcObject = cameraStream;
    $("active-camera-source").play().catch(() => {});
    $("camera-preview").srcObject = null;
    $("device-stage").classList.add("hide");
    $("exam-stage").classList.remove("hide");
    $("active-monitoring-status").textContent = "Monitoring Aktif";
    tickCountdown();
  });

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
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
