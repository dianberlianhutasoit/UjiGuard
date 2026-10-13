(function () {
  const form = document.getElementById("login-form"),
    email = document.getElementById("email"),
    password = document.getElementById("password"),
    error = document.getElementById("login-error");
  const accounts = {
    "pengawas@ujiguard.demo": {
      password: "UjiGuard2026!",
      role: "proctor",
      name: "Alya Prameswari",
      target: "../proctor/dashboard.html",
    },
    "station@ujiguard.demo": {
      password: "UjiGuard2026!",
      role: "proctor",
      name: "Panitia Demo",
      target: "../student/exam.html?station-demo=1",
    },
  };
  document.querySelectorAll("[data-fill]").forEach((b) =>
    b.addEventListener("click", () => {
      email.value =
        b.dataset.fill === "proctor"
          ? "pengawas@ujiguard.demo"
          : "station@ujiguard.demo";
      password.value = "UjiGuard2026!";
      error.classList.add("hide");
    }),
  );
  document.getElementById("toggle-password").addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const em = email.value.trim().toLowerCase(),
      acct = accounts[em];
    if (!acct || acct.password !== password.value) {
      error.textContent =
        "Email atau kata sandi demo tidak cocok. Gunakan salah satu akun demo yang tersedia.";
      error.classList.remove("hide");
      return;
    }
    window.UjiStore.setUser({
      email: em,
      role: acct.role,
      name: acct.name,
      loginAt: Date.now(),
    });
    location.href = acct.target;
  });
})();
