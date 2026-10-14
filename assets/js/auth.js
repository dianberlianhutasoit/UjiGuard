(function () {
  "use strict";
  const AUTH_KEY = "ujiguard_auth_v1";
  const PENDING_KEY = "ujiguard_pending_id_v1";
  const users = () => window.UjiDemoUsers || [];
  const findById = (id) =>
    users().find(
      (user) =>
        user.id ===
        String(id || "")
          .trim()
          .toUpperCase(),
    );
  function setPendingId(id) {
    sessionStorage.setItem(PENDING_KEY, id);
  }
  function getPendingUser() {
    return findById(sessionStorage.getItem(PENDING_KEY));
  }
  function signIn(id) {
    const user = findById(id);
    if (!user) return null;
    const { password, ...safeUser } = user;
    sessionStorage.removeItem(PENDING_KEY);
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(safeUser));
    return safeUser;
  }
  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
    } catch (_) {
      return null;
    }
  }
  function signOut() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  }
  window.UjiAuth = {
    findById,
    setPendingId,
    getPendingUser,
    signIn,
    currentUser,
    signOut,
  };
})();
