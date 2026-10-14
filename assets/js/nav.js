(function () {
  const u = window.UjiStore?.currentUser?.();
  document
    .querySelectorAll("[data-user-name]")
    .forEach((e) => (e.textContent = u?.name || "Demo User"));
  document
    .querySelectorAll("[data-user-email]")
    .forEach((e) => (e.textContent = u?.email || "demo@tervia.demo"));
  document 
    .querySelectorAll("[data-logout]")
    .forEach((e) =>
      e.addEventListener("click", () => window.UjiStore.logout()),
    );
  document
    .querySelectorAll("[data-demo-badge]")
    .forEach((e) => (e.textContent = "MODE DEMO"));
})();
