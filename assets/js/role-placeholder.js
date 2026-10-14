(function () {
  "use strict";
  const loginUrl = "../../pages/login/index.html";
  const user = window.UjiAuth?.currentUser();
  const requiredRole = document.body.dataset.requiredRole;
  if (!user || user.role !== requiredRole) { location.replace(loginUrl); return; }
  document.querySelectorAll("[data-user-name]").forEach((node) => { node.textContent = user.name; });
  document.querySelectorAll("[data-user-id]").forEach((node) => { node.textContent = user.id; });
  document.querySelectorAll("[data-user-email]").forEach((node) => { node.textContent = user.email || "Peserta"; });
  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", () => {
    window.UjiAuth.signOut();
    location.href = loginUrl;
  }));
})();
