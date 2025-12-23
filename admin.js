/* FrugalFetishes Admin Dashboard (plain JS) */
(() => {
  // ---- HARD BASELINE (do not auto-guess domains) ----
  // If this backend URL changes, update it here.
  const BACKEND_BASE_URL = "https://express-js-on-vercel-rosy-one.vercel.app";
  const ADMIN_EMAIL = "frugalfetishes@outlook.com";

  const $ = (id) => document.getElementById(id);

  // UI elements
  const emailInput = $("emailInput");
  const otpInput = $("otpInput");
  const sendOtpBtn = $("sendOtpBtn");
  const verifyBtn = $("verifyBtn");
  const loginNotice = $("loginNotice");

  const authBadge = $("authBadge");
  const authDot = $("authDot");
  const authText = $("authText");
  const logoutBtn = $("logoutBtn");
  const openAppBtn = $("openAppBtn");

  const backendDot = $("backendDot");
  const backendLabel = $("backendLabel");
  const buildDot = $("buildDot");
  const buildLabel = $("buildLabel");

  const pageTitle = $("pageTitle");
  const pageSub = $("pageSub");

  const tabDashboard = $("tabDashboard");
  const tabUsers = $("tabUsers");
  const tabCredits = $("tabCredits");
  const tabSystem = $("tabSystem");

  const viewDashboard = $("viewDashboard");
  const viewUsers = $("viewUsers");
  const viewCredits = $("viewCredits");
  const viewSystem = $("viewSystem");

  const loginCard = $("loginCard");

  // dashboard metrics
  const metricUsers = $("metricUsers");
  const metricCredits = $("metricCredits");
  const metricAdminMode = $("metricAdminMode");
  const sysHealth = $("sysHealth");
  const sysFirebase = $("sysFirebase");
  const sysBuild = $("sysBuild");
  const dashNotice = $("dashNotice");
  const refreshUsersBtn = $("refreshUsersBtn");
  const gotoCreditsBtn = $("gotoCreditsBtn");

  // users view
  const searchInput = $("searchInput");
  const reloadUsersBtn = $("reloadUsersBtn");
  const usersTbody = $("usersTbody");
  const usersNotice = $("usersNotice");

  // credits view
  const creditUserSelect = $("creditUserSelect");
  const creditAmount = $("creditAmount");
  const grantBtn = $("grantBtn");
  const creditsNotice = $("creditsNotice");

  // system view
  const diagBackend = $("diagBackend");

  // storage
  const LS_KEY = "ff_admin_session_v1";
  const state = {
    idToken: null,
    email: ADMIN_EMAIL,
    lastCodeId: null,
    usersCache: []
  };

  function saveSession() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ idToken: state.idToken, email: state.email }));
    } catch {}
  }
  function loadSession() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.idToken) {
        state.idToken = parsed.idToken;
        state.email = parsed.email || ADMIN_EMAIL;
      }
    } catch {}
  }

  function setNotice(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("hidden", "ok", "bad");
    if (!msg) {
      el.classList.add("hidden");
      return;
    }
    if (kind === "ok") el.classList.add("ok");
    if (kind === "bad") el.classList.add("bad");
  }

  function setSignedInUI(isSignedIn) {
    if (isSignedIn) {
      authDot.classList.remove("bad");
      authDot.classList.add("ok");
      authText.textContent = `Signed in: ${state.email}`;
      logoutBtn.classList.remove("hidden");
      // keep login visible until we re-add "hide after login" safely later
      // (you requested hide; we'll implement AFTER stability is confirmed)
    } else {
      authDot.classList.remove("ok");
      authDot.classList.add("bad");
      authText.textContent = "Not signed in";
      logoutBtn.classList.remove("hidden"); // keep visible
      state.idToken = null;
      saveSession();
    }
  }

  function authHeaders() {
    if (!state.idToken) return {};
    return { Authorization: `Bearer ${state.idToken}` };
  }

  async function api(path, opts = {}) {
    const url = `${BACKEND_BASE_URL}${path}`;
    const init = {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
    const res = await fetch(url, init);
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }


  // Try multiple endpoints (for deployments that differ in route prefix)
  async function apiFirst(paths, opts = {}) {
    let last = null;
    for (const p of paths) {
      const r = await api(p, opts);
      last = r;
      if (r.ok) return r;
      // if it's 404, keep trying; otherwise stop early
      if (r.status && r.status !== 404) break;
    }
    return last || { ok: false, status: 0, data: null };
  }

  // --- Health poll ---
  async function pollHealth() {
    diagBackend.textContent = BACKEND_BASE_URL;
    backendLabel.textContent = `Backend: ${BACKEND_BASE_URL}`;
    try {
      const r = await apiFirst(['/api/health','/health'], { method: 'GET' });
      const json = r.data || {};
      const ok = r.ok && json && json.status === "ok";
      backendDot.classList.toggle("ok", !!ok);
      backendDot.classList.toggle("bad", !ok);
      sysHealth.textContent = ok ? "ok" : `HTTP ${r.status}`;
      sysFirebase.textContent = json.firebase || "—";
      sysBuild.textContent = json.buildId || "—";
      buildLabel.textContent = `buildId: ${json.buildId || "—"}`;
      buildDot.classList.toggle("ok", !!json.buildId);
      buildDot.classList.toggle("bad", !json.buildId);
    } catch (e) {
      backendDot.classList.remove("ok");
      backendDot.classList.add("bad");
      sysHealth.textContent = "offline";
      sysFirebase.textContent = "—";
      sysBuild.textContent = "—";
      buildLabel.textContent = "buildId: —";
      buildDot.classList.remove("ok");
      buildDot.classList.add("bad");
    }
  }

  // --- Auth ---
  async function sendOtp() {
    const email = (emailInput.value || "").trim().toLowerCase();
    if (!email) return setNotice(loginNotice, "Enter your admin email.", "bad");
    if (email !== ADMIN_EMAIL) return setNotice(loginNotice, `Admin email must be ${ADMIN_EMAIL}`, "bad");

    setNotice(loginNotice, "Sending OTP…", "");
    const r = await api("/api/auth/start", { method: "POST", body: { email } });
    if (!r.ok) {
      const msg = (r.data && (r.data.error || r.data.message)) ? (r.data.error || r.data.message) : `OTP start failed: HTTP ${r.status}`;
      return setNotice(loginNotice, msg, "bad");
    }
    state.lastCodeId = r.data && (r.data.codeId || r.data.code_id || r.data.id) ? (r.data.codeId || r.data.code_id || r.data.id) : null;

    // dev OTP (when enabled in backend for admin) -> autofill
    const devOtp = r.data && (r.data.devOtp || r.data.otp || r.data.code) ? (r.data.devOtp || r.data.otp || r.data.code) : null;
    if (devOtp) {
      otpInput.value = String(devOtp);
      otpInput.focus();
      setNotice(loginNotice, `OTP started ✅ (autofilled dev OTP)`, "ok");
    } else {
      setNotice(loginNotice, "OTP started ✅ Check your email for the code.", "ok");
      otpInput.focus();
    }
  }

  async function verifyOtp() {
    const email = (emailInput.value || "").trim().toLowerCase();
    const otp = (otpInput.value || "").trim();
    if (!email || !otp) return setNotice(loginNotice, "Enter email and OTP.", "bad");
    if (email !== ADMIN_EMAIL) return setNotice(loginNotice, `Admin email must be ${ADMIN_EMAIL}`, "bad");

    setNotice(loginNotice, "Verifying…", "");
    const body = { email, otp };
    if (state.lastCodeId) body.codeId = state.lastCodeId;

    const r = await api("/api/auth/verify", { method: "POST", body });
    if (!r.ok) {
      const msg = (r.data && (r.data.error || r.data.message)) ? (r.data.error || r.data.message) : `Verify failed: HTTP ${r.status}`;
      return setNotice(loginNotice, msg, "bad");
    }

    const token = r.data && (r.data.idToken || r.data.token);
    if (!token) return setNotice(loginNotice, "Verify succeeded but no token returned.", "bad");

    state.idToken = token;
    state.email = email;
    saveSession();
    setSignedInUI(true);
    setNotice(loginNotice, "Signed in ✅", "ok");

    // Load dashboard immediately
    await refreshAllMetrics();
    await loadUsers();
  }

  function logout() {
    state.idToken = null;
    state.lastCodeId = null;
    saveSession();
    setSignedInUI(false);
    setNotice(loginNotice, "Logged out.", "");
    metricUsers.textContent = "—";
    metricCredits.textContent = "—";
    metricAdminMode.textContent = "—";
    usersTbody.innerHTML = '<tr><td colspan="4" class="muted">Sign in to load users.</td></tr>';
    creditUserSelect.innerHTML = '<option value="">(load users first)</option>';
  }

  // --- Admin endpoints ---
  async function loadUsers() {
    if (!state.idToken) return;

    setNotice(usersNotice, "Loading users…", "");
    const r = await api("/api/admin/users", { headers: authHeaders() });
    if (!r.ok) {
      setNotice(usersNotice, `Users load failed: HTTP ${r.status}`, "bad");
      return;
    }
    const users = (r.data && r.data.users) ? r.data.users : (Array.isArray(r.data) ? r.data : []);
    state.usersCache = Array.isArray(users) ? users : [];
    setNotice(usersNotice, `Loaded ${state.usersCache.length} users.`, "ok");
    renderUsersTable();
    fillCreditsSelect();
    // update dashboard metrics
    metricUsers.textContent = String(state.usersCache.length);
    const sumCredits = state.usersCache.reduce((acc, u) => acc + Number(u.credits || 0), 0);
    metricCredits.textContent = String(sumCredits);
    metricAdminMode.textContent = "ON";
  }

  function renderUsersTable() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const filtered = !q ? state.usersCache : state.usersCache.filter((u) => {
      const name = String(u.name || u.displayName || "").toLowerCase();
      const uid = String(u.uid || u.id || "").toLowerCase();
      return name.includes(q) || uid.includes(q);
    });

    if (!filtered.length) {
      usersTbody.innerHTML = '<tr><td colspan="4" class="muted">No users.</td></tr>';
      return;
    }

    usersTbody.innerHTML = filtered.map((u) => {
      const name = escapeHtml(String(u.name || u.displayName || "—"));
      const uid = escapeHtml(String(u.uid || u.id || "—"));
      const credits = Number(u.credits || 0);
      return `
        <tr>
          <td>${name}</td>
          <td class="mono tiny">${uid}</td>
          <td class="right">${credits}</td>
          <td class="right"><button class="btn ghost tiny" data-uid="${uid}" data-name="${name}" type="button">Grant</button></td>
        </tr>
      `;
    }).join("");

    // attach Grant buttons
    Array.from(usersTbody.querySelectorAll("button[data-uid]")).forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.getAttribute("data-uid") || "";
        creditUserSelect.value = uid;
        setActiveTab("credits");
      });
    });
  }

  function fillCreditsSelect() {
    const opts = state.usersCache.map((u) => {
      const uid = String(u.uid || u.id || "");
      const label = `${String(u.name || u.displayName || "—")} (${uid.slice(0, 10)}…)`;
      return `<option value="${escapeAttr(uid)}">${escapeHtml(label)}</option>`;
    });
    creditUserSelect.innerHTML = `<option value="">Select a user</option>${opts.join("")}`;
  }

  async function grantCredits() {
    if (!state.idToken) return setNotice(creditsNotice, "Sign in first.", "bad");

    const uid = (creditUserSelect.value || "").trim();
    const amount = Number(creditAmount.value || 0);
    if (!uid) return setNotice(creditsNotice, "Select a user.", "bad");
    if (!Number.isFinite(amount) || amount === 0) return setNotice(creditsNotice, "Enter an amount.", "bad");

    setNotice(creditsNotice, "Granting…", "");
    const r = await api("/api/admin/credits/grant", {
      method: "POST",
      headers: authHeaders(),
      body: { uid, amount }
    });
    if (!r.ok) return setNotice(creditsNotice, `Grant failed: HTTP ${r.status}`, "bad");

    setNotice(creditsNotice, "Granted ✅", "ok");
    // refresh users to update credits
    await loadUsers();
  }

  async function refreshAllMetrics() {
    // health is separate, but ensure it's fresh
    await pollHealth();
    if (state.idToken) await loadUsers();
  }

  // --- Tabs ---
  function setActiveTab(which) {
    tabDashboard.classList.toggle("active", which === "dashboard");
    tabUsers.classList.toggle("active", which === "users");
    tabCredits.classList.toggle("active", which === "credits");
    tabSystem.classList.toggle("active", which === "system");

    viewDashboard.classList.toggle("hidden", which !== "dashboard");
    viewUsers.classList.toggle("hidden", which !== "users");
    viewCredits.classList.toggle("hidden", which !== "credits");
    viewSystem.classList.toggle("hidden", which !== "system");

    if (which === "dashboard") {
      pageTitle.textContent = "Dashboard";
      pageSub.textContent = "Admin-only tools for FrugalFetishes";
    } else if (which === "users") {
      pageTitle.textContent = "Users";
      pageSub.textContent = "Browse users and balances";
    } else if (which === "credits") {
      pageTitle.textContent = "Credits";
      pageSub.textContent = "Grant credits to users";
    } else {
      pageTitle.textContent = "System";
      pageSub.textContent = "Endpoints and diagnostics";
    }
  }

  // --- helpers ---
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  // ---- Wire up ----
  function init() {
    emailInput.value = ADMIN_EMAIL;
    diagBackend.textContent = BACKEND_BASE_URL;

    loadSession();
    setSignedInUI(!!state.idToken);

    sendOtpBtn.addEventListener("click", sendOtp);
    verifyBtn.addEventListener("click", verifyOtp);

    logoutBtn.addEventListener("click", logout);
    openAppBtn.addEventListener("click", () => {
      const url = `${location.origin}/`;
      window.open(url, "_blank", "noopener,noreferrer");
    });

    tabDashboard.addEventListener("click", () => setActiveTab("dashboard"));
    tabUsers.addEventListener("click", () => setActiveTab("users"));
    tabCredits.addEventListener("click", () => setActiveTab("credits"));
    tabSystem.addEventListener("click", () => setActiveTab("system"));

    reloadUsersBtn.addEventListener("click", loadUsers);
    refreshUsersBtn.addEventListener("click", async () => {
      setNotice(dashNotice, "Refreshing…", "");
      await refreshAllMetrics();
      setNotice(dashNotice, "Refreshed ✅", "ok");
    });
    gotoCreditsBtn.addEventListener("click", () => setActiveTab("credits"));
    grantBtn.addEventListener("click", grantCredits);

    searchInput.addEventListener("input", renderUsersTable);

    // health poll loop
    pollHealth();
    setInterval(pollHealth, 6000);

    // if already signed in, load data
    if (state.idToken) {
      refreshAllMetrics();
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
