(function () {
  "use strict";
  const idForm = document.getElementById("id-form");
  const staffForm = document.getElementById("staff-form");
  const idInput = document.getElementById("user-id");
  const staffIdLabel = document.getElementById("staff-id-label");
  const idError = document.getElementById("id-error");
  const staffError = document.getElementById("staff-error");
  const password = document.getElementById("staff-password");
  let selectedUser = null;
  const destinations = {
    participant: "../participant/identity.html",
    proctor: "../proctor/index.html",
    admin: "../admin/index.html",
  };

  idForm.addEventListener("submit", (event) => {
    event.preventDefault();
    idError.classList.add("hide");
    selectedUser = window.UjiAuth.findById(idInput.value);
    if (!selectedUser) {
      idError.textContent = "ID tidak ditemukan. Periksa kembali ID demo.";
      idError.classList.remove("hide");
      return;
    }
    if (selectedUser.role === "participant") {
      window.UjiAuth.setPendingId(selectedUser.id);
      location.href = destinations.participant;
      return;
    }
    staffIdLabel.textContent = selectedUser.id;
    idForm.classList.add("hide");
    staffForm.classList.remove("hide");
    staffError.classList.add("hide");
    document.getElementById("staff-email").focus();
  });

  document.getElementById("back-to-id").addEventListener("click", () => {
    selectedUser = null;
    staffForm.reset();
    staffForm.classList.add("hide");
    idForm.classList.remove("hide");
    idInput.focus();
  });

  document.getElementById("toggle-password").addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
  });

  staffForm.addEventListener("submit", (event) => {
    event.preventDefault();
    staffError.classList.add("hide");
    const email = document.getElementById("staff-email").value.trim().toLowerCase();
    if (!selectedUser || !["proctor", "admin"].includes(selectedUser.role) || email !== selectedUser.email || password.value !== selectedUser.password) {
      staffError.textContent = "Email atau kata sandi tidak sesuai dengan ID tersebut.";
      staffError.classList.remove("hide");
      return;
    }
    const user = window.UjiAuth.signIn(selectedUser.id);
    if (user) location.href = destinations[user.role];
  });
})();
