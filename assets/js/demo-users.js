(function () {
  "use strict";
  const data = window.UjiAdminStore?.get();
  const participants = (data?.participants || []).filter((participant) => !participant.demoData).map((participant) => {
    const exam = data.exams.find((item) => item.id === participant.examId);
    const session = data.examSessions.find((item) => item.id === participant.sessionId && item.examId === participant.examId);
    return {
      ...participant,
      examName: exam?.name || "Ujian belum ditentukan",
      sessionTime: window.UjiAdminStore.formatSessionTime(session),
      date: session?.date || "",
      startTime: session?.startTime || "",
      endTime: session?.endTime || "",
      sessionMode: session?.mode || "REMOTE",
      mode: session?.mode === "ONSITE" ? "Onsite" : "Remote",
    };
  });
  const staff = (data?.users || []).filter((user) => user.status !== "Nonaktif");
  window.UjiDemoUsers = [...participants, ...staff];
})();
