/* FrugalFetishes Admin Dashboard (no frameworks) */

const ADMIN_EMAIL = "frugalfetishes@outlook.com";

const $ = (id) => document.getElementById(id);

const storage = {
  idToken: null,
  loginEmail: "",
  lastCodeId: null
};

// Elements
const authBadge = $("authBadge");
const authText = $("authText");
const authDot = $("authDot");
const btnLogout = $("btnLogout");
const authStatus = $("authStatus");
const emailInput = $("emailInput");
const otpInput = $("otpInput");
const btnSendOtp = $("btnSendOtp");
const btnVerify = $("btnVerify");

const envPill = $("envPill");
const buildPill = $("buildPill");
const sysHealth = $("sysHealth");
const sysFirebase = $("sysFirebase");
const sysBuildId = $("sysBuildId");
const sysStatus = $("sysStatus");

const pageTitle = $("pageTitle");
const pageSub = $("pageSub");

const btnRefreshUsers = $("btnRefreshUsers");
const btnGoCredits = $("btnGoCredits");
const quickStatus = $("quickStatus");

const usersTbody = $("usersTbody");
const usersStatus = $("usersStatus");
const userSearch = $("userSearch");
const btnReloadUsers = $("btnReloadUsers");

const creditUserSelect = $("creditUserSelect");
const creditAmountSelect = $("creditAmountSelect");
const btnGrantCredits = $("btnGrantCredits");
const creditsStatus = $("creditsStatus");
const btnCreditsReload = $("btnCreditsReload");

const diagStatus = $("diagStatus");

// Views
const views = ["dashboard","users","credits","system"];
function showView(view){
  for (const v of views){
    const el = $(`view-${v}`);
    if (!el) continue;
    el.hidden = v !== view;
  }
  for (const btn of document.querySelectorAll(".navItem")){
    btn.classList.toggle("active", btn.dataset.view === view);
  }
  pageTitle.textContent = view.charAt(0).toUpperCase() + view.slice(1);
  pageSub.textContent = view === "dashboard"
    ? "Admin-only tools for FrugalFetishes"
    : view === "users"
      ? "Browse users and balances"
      : view === "credits"
        ? "Grant credits to users"
        : "Endpoints & diagnostics";
}

function setAuthUi(){
  const signedIn = !!storage.idToken;
  const email = storage.loginEmail || "";
  if (String(email||'').trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    setAuthStatus('Admin login is only for ' + ADMIN_EMAIL);
    return;
  }

  authText.textContent = signedIn ? (email ? `Signed in: ${email}` : "Signed in") : "Not signed in";
  authDot.style.background = signedIn ? "rgba(34,197,94,.85)" : "rgba(255,0,90,.35)";
  authDot.style.boxShadow = signedIn ? "0 0 0 4px rgba(34,197,94,.16)" : "0 0 0 4px rgba(255,0,90,.10)";
  btnLogout.disabled = false;
  btnLogout.textContent = signedIn ? "Logout" : "Login";

  const isAdmin = signedIn && (email.toLowerCase().trim() === ADMIN_EMAIL);
  btnRefreshUsers.disabled = !isAdmin;
  btnReloadUsers.disabled = !isAdmin;
  btnCreditsReload.disabled = !isAdmin;
  btnGrantCredits.disabled = !isAdmin;

  if (signedIn && !isAdmin){
    // Immediate lockout (admin-only panel)
    authStatus.textContent = "Access denied. This dashboard is admin-only.";
  }
}

function requireAdmin(){
  const email = (storage.loginEmail || "").toLowerCase().trim();
  return !!storage.idToken && email === ADMIN_EMAIL;
}

async function jsonFetch(path, opts = {}){
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok){
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function getAuthHeader(){
  if (!storage.idToken) return {};
  return { "Authorization": `Bearer ${storage.idToken}` };
}

async function checkHealth(){
  try{
    envPill.textContent = "Backend: checking…";
    const data = await jsonFetch("/api/health");
    envPill.textContent = "Backend: OK";
    buildPill.textContent = `buildId: ${data.buildId || "—"}`;
    sysHealth.textContent = data.status || "ok";
    sysFirebase.textContent = data.firebase || "—";
    sysBuildId.textContent = data.buildId || "—";
    sysStatus.textContent = "Health check OK.";
  } catch(e){
    envPill.textContent = "Backend: ERROR";
    sysStatus.textContent = `Health failed: ${String(e.message || e)}`;
  }
}

async function startOtp(){
  const email = String(emailInput.value || "").trim();
  if (!email){
    authStatus.textContent = "Enter an email.";
    return;
  }
  storage.loginEmail = email;
  setAuthUi();

  authStatus.textContent = "Starting OTP…";
  try{
    const data = await jsonFetch("/api/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email }
    });
    storage.lastCodeId = data.codeId || data.codeID || data.codeid || null;
    let msg = "OTP started ✅";
    if (storage.lastCodeId) msg += `  codeId: ${storage.lastCodeId}`;
    if (data.devOtp) msg += `  devOtp: ${data.devOtp} (test-only)`;
    authStatus.textContent = msg;
  } catch(e){
    authStatus.textContent = `OTP start failed: ${String(e.message || e)}`;
  }
}

async function verifyOtp(){
  const email = String(emailInput.value || "").trim();
  const otp = String(otpInput.value || "").trim();
  if (!email || !otp){
    authStatus.textContent = "Enter email and OTP.";
    return;
  }
  storage.loginEmail = email;
  setAuthUi();

  authStatus.textContent = "Verifying…";
  try{
    const data = await jsonFetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { email, codeId: storage.lastCodeId, otp }
    });
    storage.idToken = data.idToken || null;

    if (!storage.idToken){
      authStatus.textContent = "Verify succeeded but no idToken returned.";
      setAuthUi();
      return;
    }

    // Admin lock
    if (!requireAdmin()){
      storage.idToken = null;
      authStatus.textContent = "Access denied. This dashboard is admin-only.";
      setAuthUi();
      return;
    }

    authStatus.textContent = "Signed in ✅";
    setAuthUi();
    await refreshUsers();
  } catch(e){
    authStatus.textContent = `Verify failed: ${String(e.message || e)}`;
  }
}

function logout(){
  storage.idToken = null;
  storage.loginEmail = "";
  storage.lastCodeId = null;
  authStatus.textContent = "Logged out.";
  setAuthUi();
  // Clear admin data
  usersTbody.innerHTML = '<tr><td colspan="4" class="muted">Sign in to load users.</td></tr>';
  creditUserSelect.innerHTML = "";
  $("kpiUsers").textContent = "—";
  $("kpiCredits").textContent = "—";
  $("kpiAdminMode").textContent = "—";
}

let cachedUsers = [];
function renderUsersTable(users){
  const q = String(userSearch.value || "").toLowerCase().trim();
  const filtered = q
    ? users.filter(u => String(u.uid || "").toLowerCase().includes(q) || String(u.displayName || "").toLowerCase().includes(q))
    : users;

  if (!filtered.length){
    usersTbody.innerHTML = '<tr><td colspan="4" class="muted">No users found.</td></tr>';
    return;
  }

  usersTbody.innerHTML = "";
  for (const u of filtered){
    const tr = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = (u.displayName || "").trim() || "—";

    const uid = document.createElement("td");
    uid.className = "mono";
    uid.textContent = u.uid || "—";

    const credits = document.createElement("td");
    credits.textContent = String(u.credits ?? 0);

    const action = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "btn ghost";
    btn.style.padding = "7px 10px";
    btn.textContent = "Grant";
    btn.disabled = !requireAdmin();
    btn.addEventListener("click", () => {
      showView("credits");
      // select user
      const opt = Array.from(creditUserSelect.options).find(o => o.value === u.uid);
      if (opt) creditUserSelect.value = u.uid;
      creditsStatus.textContent = `Ready to grant credits to ${u.displayName || u.uid}.`;
    });
    action.appendChild(btn);

    tr.appendChild(name);
    tr.appendChild(uid);
    tr.appendChild(credits);
    tr.appendChild(action);
    usersTbody.appendChild(tr);
  }
}

function renderUsersSelect(users){
  creditUserSelect.innerHTML = "";
  if (!users.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No users loaded";
    creditUserSelect.appendChild(opt);
    return;
  }
  for (const u of users){
    const opt = document.createElement("option");
    opt.value = u.uid;
    const name = (u.displayName || "").trim() || u.uid;
    opt.textContent = `${name} (${u.credits ?? 0})`;
    creditUserSelect.appendChild(opt);
  }
}

function renderKpis(users){
  $("kpiUsers").textContent = String(users.length);
  const sum = users.reduce((acc,u) => acc + Number(u.credits ?? 0), 0);
  $("kpiCredits").textContent = String(sum);
  $("kpiAdminMode").textContent = requireAdmin() ? "ON" : "OFF";
}

async function refreshUsers(){
  if (!requireAdmin()){
    quickStatus.textContent = "Admin only. Sign in as frugalfetishes@outlook.com.";
    return;
  }
  usersStatus.textContent = "Loading users…";
  quickStatus.textContent = "Loading users…";
  creditsStatus.textContent = "—";
  try{
    const headers = await getAuthHeader();
    const data = await jsonFetch("/api/admin/users", { method:"GET", headers });
    cachedUsers = Array.isArray(data.users) ? data.users : [];
    renderUsersTable(cachedUsers);
    renderUsersSelect(cachedUsers);
    renderKpis(cachedUsers);
    usersStatus.textContent = `Loaded ${cachedUsers.length} users.`;
    quickStatus.textContent = `Loaded ${cachedUsers.length} users.`;
    diagStatus.textContent = "Admin endpoints OK.";
  } catch(e){
    const msg = `Users load failed: ${String(e.message || e)}`;
    usersStatus.textContent = msg;
    quickStatus.textContent = msg;
    diagStatus.textContent = msg;
  }
}

async function grantCredits(){
  if (!requireAdmin()){
    creditsStatus.textContent = "Admin only.";
    return;
  }
  const targetUid = String(creditUserSelect.value || "").trim();
  const amount = Number(creditAmountSelect.value || 0);
  if (!targetUid || !amount){
    creditsStatus.textContent = "Pick a user and amount.";
    return;
  }
  creditsStatus.textContent = "Granting…";
  try{
    const headers = await getAuthHeader();
    const data = await jsonFetch("/api/admin/credits/grant", {
      method: "POST",
      headers: { ...headers, "Content-Type":"application/json" },
      body: { targetUid, amount }
    });
    creditsStatus.textContent = data.ok ? `Granted +${amount}.` : "Grant failed.";
    await refreshUsers();
  } catch(e){
    creditsStatus.textContent = `Grant failed: ${String(e.message || e)}`;
  }
}

// Navigation click handlers
for (const btn of document.querySelectorAll(".navItem")){
  btn.addEventListener("click", () => showView(btn.dataset.view));
}
btnGoCredits.addEventListener("click", () => showView("credits"));

// Auth
btnSendOtp.addEventListener("click", startOtp);
btnVerify.addEventListener("click", verifyOtp);
btnLogout.addEventListener("click", () => {
  if (storage.idToken) logout();
  else showView("dashboard");
});

// Users
btnRefreshUsers.addEventListener("click", refreshUsers);
btnReloadUsers.addEventListener("click", refreshUsers);
btnCreditsReload.addEventListener("click", refreshUsers);
userSearch.addEventListener("input", () => renderUsersTable(cachedUsers));

// Credits
btnGrantCredits.addEventListener("click", grantCredits);

// Init
showView("dashboard");
setAuthUi();
checkHealth();
