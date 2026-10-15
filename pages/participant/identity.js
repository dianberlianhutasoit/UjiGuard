(function () {
  "use strict";
  const user = window.UjiAuth.getPendingUser();
  if (!user || user.role !== "participant") { location.replace("../login/index.html"); return; }
  document.getElementById("participant-name").textContent = user.name;
  document.getElementById("participant-id").textContent = user.id;
  document.getElementById("exam-name").textContent = user.examName;
  document.getElementById("exam-id").textContent = user.examId;
  document.getElementById("session-id").textContent = user.sessionId;
  document.getElementById("session-time").textContent = user.sessionTime;
  document.getElementById("session-start").textContent = `${user.startTime || "-"} WIB`;
  document.getElementById("session-end").textContent = `${user.endTime ? UjiAdminStore.formatClock(user.endTime) : "-"} WIB`;
  document.getElementById("exam-mode").textContent = user.mode;
  document.getElementById("confirm-identity").addEventListener("click", () => {
    const signedIn = window.UjiAuth.signIn(user.id);
    if (signedIn) location.href = "index.html";
  });
})();
