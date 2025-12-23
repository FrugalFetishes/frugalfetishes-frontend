
function setDevCreditsStatus(msg) {
  if (devCreditsStatusEl) devCreditsStatusEl.textContent = msg || "";
}

function setDevCreditsBalance(n) {
  if (!devCreditsBalanceEl) return;
  devCreditsBalanceEl.textContent = Number.isFinite(n) ? String(n) : String(n || "");
}

async function refreshDevCreditsBalance() {
  try {
    if (!storage || !storage.idToken) { setDevCreditsBalance(""); return; }
    const resp = await getCreditsBalance();
    if (resp && resp.ok !== false) {
      const bal = (typeof resp.credits === "number") ? resp.credits :
                  (typeof resp.balance === "number") ? resp.balance :
                  (typeof resp.amount === "number") ? resp.amount : null;
      if (bal !== null) setDevCreditsBalance(bal);
    }
  } catch (e) {
    setDevCreditsStatus(`Balance failed: ${e.message}`);
  }
}


function filterOutSelf(items) {
  const myUid = getUidFromIdToken(storage.idToken);
  if (!myUid) return items;
  return Array.isArray(items) ? items.filter(p => p && p.uid && p.uid !== myUid) : items;
}

/* Minimal web client for FrugalFetishes backend
 * - No frameworks
 * - Stores idToken in localStorage
 * - Implements: auth/start, auth/verify, token exchange, feed, credits/balance
 */

// ====== CONFIG ======
const BACKEND_BASE_URL = "https://express-js-on-vercel-rosy-one.vercel.app";

// DEV ONLY: matches backend env DEV_OTP_KEY (used to receive devOtp for any email)
const DEV_OTP_KEY = "ff-dev";
const FIREBASE_WEB_API_KEY = "AIzaSyBcMM5dAFqbQXcN0ltT4Py6SeA5Fzg-nD8";

// ====== DOM ======
const $ = (id) => document.getElementById(id);

// --- SAFETY: never allow blank screen; surface JS errors visibly ---
window.addEventListener("error", (e) => {
  try {
    const msg = e && (e.message || (e.error && e.error.message)) ? (e.message || e.error.message) : "Unknown JS error";
    const box = document.getElementById("appErrorBanner") || document.getElementById("authStatus");
    if (box) box.textContent = `Error: ${msg}`;
    const landing = document.getElementById("landingView");
    if (landing) landing.style.display = "";
  } catch (_) {}
});
window.addEventListener("unhandledrejection", (e) => {
  try {
    const msg = e && e.reason && (e.reason.message || String(e.reason)) ? (e.reason.message || String(e.reason)) : "Unhandled rejection";
    const box = document.getElementById("appErrorBanner") || document.getElementById("authStatus");
    if (box) box.textContent = `Error: ${msg}`;
    const landing = document.getElementById("landingView");
    if (landing) landing.style.display = "";
  } catch (_) {}
});

const emailEl = $("email");
const otpEl = $("otp");
const btnStart = $("btnStart");
const btnVerify = $("btnVerify");
const btnLoadFeed = $("btnLoadFeed");
// UX: hide the manual Load Feed button (feed auto-loads after login; reload still available elsewhere)
try { if (btnLoadFeed) btnLoadFeed.style.display = "none"; } catch {}
const btnCredits = $("btnCredits");
const btnLogout = $("btnLogout");

const btnCheckBackend = $("btnCheckBackend");
const backendDebugEl = $("backendDebug");

const profileDisplayNameEl = $("profileDisplayName");
const profileAgeEl = $("profileAge");
const profileInterestsEl = $("profileInterests");
const profileLatEl = $("profileLat");
  const profileZipEl = $("profileZip");
const profileLngEl = $("profileLng");
const btnSaveProfile = $("btnSaveProfile");
  const btnUseLocation = $("btnUseLocation");
  const btnClearLocation = $("btnClearLocation");
  const locationStatusEl = $("locationStatus");
const btnSetMiami = $("btnSetMiami");
const btnSetOrlando = $("btnSetOrlando");
const profileStatusEl = $("profileStatus");

const profileBioEl = $("profileBio");
const bioCountEl = $("bioCount");
const interestChipsEl = $("interestChips");
const profileInterestCustomEl = $("profileInterestCustom");
const btnAddInterest = $("btnAddInterest");
let selectedInterests = new Set();


const photoFilesEl = $("photoFiles");
const btnSavePhotos = $("btnSavePhotos");
const btnClearPhotos = $("btnClearPhotos");
const photoStatusEl = $("photoStatus");
const photoPreviewEl = $("photoPreview");

const filterCityEl = $("filterCity");
const filterInterestEl = $("filterInterest");
const btnApplyFilters = $("btnApplyFilters");
const btnClearFilters = $("btnClearFilters");
const filterStatusEl = $("filterStatus");

const startResultEl = $("startResult");
const authStatusEl = $("authStatus");
const profileSaveStatusEl = document.getElementById("profileSaveStatus");
const toastEl = document.getElementById("toast");
  const landingView = document.getElementById("landingView");
  const appView = document.getElementById("appView");

function forceShowLanding() {
  const lv = document.getElementById("landingView");
  const av = document.getElementById("appView");
  if (lv) { lv.classList.remove("hidden"); lv.style.display = ""; }
  if (av) { av.classList.add("hidden"); av.style.display = "none"; }
}
function forceShowApp() {
  const lv = document.getElementById("landingView");
  const av = document.getElementById("appView");
  if (lv) { lv.classList.add("hidden"); lv.style.display = "none"; }
  if (av) { av.classList.remove("hidden"); av.style.display = ""; }
}

  // Ensure visitors never see app UI before auth state is applied
  forceShowLanding();
const feedStatusEl = $("feedStatus");
const feedListEl = $("feedList");
const btnLoadMatches = $("btnLoadMatches");
const matchesStatusEl = $("matchesStatus");
const matchesListEl = $("matchesList");
const btnLoadThread = $("btnLoadThread");
const btnSendMessage = $("btnSendMessage");
const messageTextEl = $("messageText");
const threadMetaEl = $("threadMeta");
const threadStatusEl = $("threadStatus");
const threadListEl = $("threadList");
const errorBoxEl = $("errorBox");

// Discover UI elements (safe if missing)
const swipeCardEl = $("swipeCard");
const swipePhotoEl = $("swipePhoto");
const swipeTitleEl = $("swipeTitle");
const swipeSubEl = $("swipeSub");
const btnPassEl = $("btnPass");
const btnLikeEl = $("btnLike");
const btnExpandEl = $("btnExpand");
const expandSheetEl = $("expandSheet");
const btnCollapseEl = $("btnCollapse");
const sheetTitleEl = $("sheetTitle");
const sheetPhotosEl = $("sheetPhotos");
const sheetAgeEl = $("sheetAge");
const sheetCityEl = $("sheetCity");
const sheetLastActiveEl = $("sheetLastActive");
const sheetPlanEl = $("sheetPlan");
const sheetInterestsEl = $("sheetInterests");
const sheetAboutEl = $("sheetAbout");
const btnPass2El = $("btnPass2");
const btnLike2El = $("btnLike2");

// Tabs
const tabButtons = Array.from(document.querySelectorAll(".tabBtn"));
const tabPanels = Array.from(document.querySelectorAll(".tabPanel"));
const btnToggleDevFeed = $("btnToggleDevFeed");

let lastCodeId = null;
let allFeedItems = [];
let selectedMatchId = null;
let selectedOtherUid = null;
let isSendingMessage = false;
let uiWired = false;
const publicProfileCache = new Map(); // uid -> { displayName, photoUrl }
// ====== Discover Deck UI (new; additive) ======
let deckIndex = 0;
let deckItems = [];
let currentProfile = null;
let isExpanded = false;
let actionLocked = false;
let touchStart = null;
let lastSwipeAt = 0; // prevents tap-to-expand firing right after a swipe


function getUidFromIdToken(idToken) {
  try {
    if (!idToken) return "";
    const parts = String(idToken).split(".");
    if (parts.length < 2) return "";
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.user_id || payload.sub || payload.uid || "");
  } catch {
    return "";
  }
}

// ====== Storage ======
const storage = {
  get idToken() { return localStorage.getItem("ff_idToken"); },
  set idToken(v) {
    if (v) localStorage.setItem("ff_idToken", v);
    else localStorage.removeItem("ff_idToken");
  },

  get refreshToken() { return localStorage.getItem("ff_refreshToken"); },
  set refreshToken(v) {
    if (v) localStorage.setItem("ff_refreshToken", v);
    else localStorage.removeItem("ff_refreshToken");
  },

  // Unix ms timestamp when idToken is expected to expire (client-estimated)
  get idTokenExpiresAt() {
    const v = localStorage.getItem("ff_idTokenExpiresAt");
    return v ? Number(v) : 0;
  },
  set idTokenExpiresAt(v) {
    if (v) localStorage.setItem("ff_idTokenExpiresAt", String(v));
    else localStorage.removeItem("ff_idTokenExpiresAt");
  }
};

function showError(message) {
  errorBoxEl.hidden = false;
  errorBoxEl.textContent = message || "Unknown error";
}

function clearError() {
  errorBoxEl.hidden = true;
  errorBoxEl.textContent = "";
}

  function roundLoc(n, decimals){
    const p = Math.pow(10, decimals);
    return Math.round(Number(n) * p) / p;
  }

function showToast(msg){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add("hidden"), 2600);
}

function setStatus(el, message) {
  el.textContent = message || "";
}

// ===== Feed loading UX helpers (surgical; no OTP/auth changes) =====
let feedSpinnerEl = null;
function ensureFeedSpinner() {
  if (feedSpinnerEl) return feedSpinnerEl;
  if (!feedStatusEl || !feedStatusEl.parentNode) return null;

  // Reuse existing element if present
  feedSpinnerEl = document.getElementById("feedSpinner");
  if (!feedSpinnerEl) {
    feedSpinnerEl = document.createElement("span");
    feedSpinnerEl.id = "feedSpinner";
    feedSpinnerEl.textContent = "⏳";
    feedSpinnerEl.style.marginLeft = "8px";
    feedSpinnerEl.style.display = "none";
    feedSpinnerEl.style.verticalAlign = "middle";
    feedStatusEl.parentNode.insertBefore(feedSpinnerEl, feedStatusEl.nextSibling);
  }
  return feedSpinnerEl;
}

function setFeedLoading(isLoading, message) {
  try { if (feedStatusEl) setStatus(feedStatusEl, message || ""); } catch {}
  const sp = ensureFeedSpinner();
  if (sp) sp.style.display = isLoading ? "inline-block" : "none";
}



function setBackendDebug(msg) {
  if (backendDebugEl) setStatus(backendDebugEl, msg);
}

async function checkBackend() {
  clearError();
  setBackendDebug(`BACKEND_BASE_URL = ${BACKEND_BASE_URL}`);
  try {
    const r = await fetch(`${BACKEND_BASE_URL}/api/health`, { method: "GET" });
    const txt = await r.text();
    const body = (txt || "").replace(/\s+/g, " ").trim();
    setBackendDebug(`BACKEND_BASE_URL = ${BACKEND_BASE_URL}\n/health status = ${r.status}\nbody = ${body.substring(0, 500)}`);
  } catch (e) {
    setBackendDebug(`BACKEND_BASE_URL = ${BACKEND_BASE_URL}\n/health error: ${e.message}`);
  }
}


function setAuthedUI() {
  const signedIn = !!storage.idToken;
  // Keep existing class toggle, but also force display to avoid "stacked views" if CSS differs.
  if (landingView) {
    landingView.classList.toggle("hidden", signedIn);
    landingView.style.display = signedIn ? "none" : "";
  }
  if (appView) {
    appView.classList.toggle("hidden", !signedIn);
    appView.style.display = signedIn ? "" : "none";
  }

  if (authStatusEl) {
    if (signedIn) {
      const em = storage.loginEmail ? ` ${storage.loginEmail}` : "";
      setStatus(authStatusEl, `Signed in ✅ ${storage.loginEmail || ""}`.trim());
    } else {
      setStatus(authStatusEl, "Signed out");
    }
  }
}

async function jsonFetch(url, options = {}) {
  if (typeof url === "string" && url.startsWith("/api/")) url = `${BACKEND_BASE_URL}${url}`;

  const opts = Object.assign({ headers: {} }, options || {});
  opts.headers = Object.assign({}, opts.headers || {});

  // If body is a plain object, send JSON and keep existing headers (like Authorization)
  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData) && !(opts.body instanceof Blob)) {
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers);
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    const snippet = text ? text.slice(0, 180) : "";
    const errMsg = (data && (data.error || data.message)) ? (data.error || data.message) : snippet;
    throw new Error(`HTTP ${res.status} @ ${url} :: ${errMsg}`);
  }
  return data !== null ? data : (text ? { ok: true, text } : { ok: true });
}
async function startAuth(email) {
  return jsonFetch(`${BACKEND_BASE_URL}/api/auth/start`, {
    method: "POST",
    headers: DEV_OTP_KEY ? { "x-dev-otp-key": DEV_OTP_KEY } : {},
    body: { email: sanitizeEmail(email) }
  });
}

async function verifyAuth(email, codeId, otp) {
  return jsonFetch(`${BACKEND_BASE_URL}/api/auth/verify`, {
    method: "POST",
    body: { email: sanitizeEmail(email), codeId, otp }
  });
}

async function exchangeCustomTokenForIdToken(customToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;
  return jsonFetch(url, {
    method: "POST",
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
}


async function refreshIdToken() {
  const rt = storage.refreshToken;
  if (!rt) throw new Error("Missing refreshToken. Please sign in again.");

  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;

  // Secure Token API expects x-www-form-urlencoded
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: rt
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }

  if (!res.ok) {
    const msg = (data && (data.error && (data.error.message || data.error))) ? (data.error.message || data.error) : text;
    throw new Error(msg || `Token refresh failed (${res.status})`);
  }

  // Response keys: id_token, refresh_token, expires_in (seconds)
  const idToken = data && data.id_token;
  const refreshToken = data && data.refresh_token;
  const expiresIn = data && data.expires_in;

  if (!idToken) throw new Error("Token refresh missing id_token.");

  storage.idToken = idToken;
  if (refreshToken) storage.refreshToken = refreshToken;
  if (expiresIn) {
    const ms = Number(expiresIn) * 1000;
    // Refresh one minute before expiry
    storage.idTokenExpiresAt = Date.now() + ms - 60_000;
  }
  return idToken;
}


async function getAuthHeader() {
  // Prefer the active session token; otherwise refresh via getValidIdToken()
  const token = (storage && storage.idToken) ? storage.idToken : await getValidIdToken();
  return { "Authorization": `Bearer ${token}` };
}


async function getValidIdToken() {
  const idToken = storage.idToken;
  if (!idToken) return null;

  const expAt = storage.idTokenExpiresAt || 0;

  // If we don't know expiry, just use what we have.
  if (!expAt) return idToken;

  // If within ~10 seconds of expAt, refresh now
  if (Date.now() >= (expAt - 10_000)) {
    return refreshIdToken();
  }

  return idToken;
}

function looksLikeExpiredTokenError(message) {
  const m = (message || "").toLowerCase();
  return m.includes("auth/id-token-expired")
    || m.includes("id token has expired")
    || m.includes("token-expired")
    || m.includes("token has expired");
}

async function getCredits() {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/credits/balance`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}

async function getFeed() {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/feed`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}


async function postLike(targetUid) {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/like`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ targetUid })
  });
}



function validateProfileRequired(d) {
  const errors = [];
  const displayName = String((d && d.displayName) || "").trim();
  const age = Number((d && d.age) || NaN);
  const city = String((d && d.city) || "").trim();
  const interests = Array.isArray(d && d.interests)
    ? d.interests
    : String((d && d.interests) || "").split(",").map(s => s.trim()).filter(Boolean);
  const photos = Array.isArray(d && d.photos) ? d.photos : [];
  const lat = d && d.location && typeof d.location.lat === "number" ? d.location.lat : Number(d && d.locationLat);
  const lng = d && d.location && typeof d.location.lng === "number" ? d.location.lng : Number(d && d.locationLng);

  if (!displayName) errors.push("Display name is required.");
  if (!Number.isFinite(age) || age < 18) errors.push("Age is required (18+).");
  if (!city) errors.push("City is required.");
  if (!interests || interests.length < 1) errors.push("At least 1 interest is required.");
  if (!photos || photos.length < 1) errors.push("At least 1 photo is required.");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) errors.push("Location (lat/lng) is required.");

  return { ok: errors.length === 0, errors };
}

async function updateProfile(fields) {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/profile/update`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(fields)
  });
}


async function hydrateProfileFromServer() {
  try {
    if (!profileDisplayNameEl) return;
    const resp = await getMyProfile();
    if (!resp || resp.ok === false) return;
    const profile = resp.profile || resp.user || null;
    if (!profile) return;

    if (profile.displayName && profileDisplayNameEl) profileDisplayNameEl.value = String(profile.displayName);
    if (typeof profile.age === "number" && profileAgeEl) profileAgeEl.value = String(profile.age);
    if (profile.city && profileCityEl) profileCityEl.value = String(profile.city);
    if (Array.isArray(profile.interests) && profileInterestsEl) profileInterestsEl.value = profile.interests.join(", ");
    if (profileBioEl && typeof profile.bio === "string") profileBioEl.value = profile.bio;
    if (bioCountEl && profileBioEl) bioCountEl.textContent = String((profileBioEl.value || "").length);
    initInterestChipsFromValue(profileInterestsEl ? profileInterestsEl.value : "");
    if (profile.location && typeof profile.location.lat === "number" && profileLatEl) profileLatEl.value = String(profile.location.lat);
    if (profile.location && typeof profile.location.lng === "number" && profileLngEl) profileLngEl.value = String(profile.location.lng);
    // Photos: prefer profile.photos, fallback to user.photos
    const photos = (profile && Array.isArray(profile.photos) ? profile.photos :
                   (resp.user && Array.isArray(resp.user.photos) ? resp.user.photos : []));
    if (Array.isArray(photos) && photoPreviewEl) {
      // Render previews
      photoPreviewEl.innerHTML = "";
      photos.slice(0, 6).forEach((src, idx) => {
        const img = document.createElement("img");
        img.src = String(src);
        img.alt = `Photo ${idx + 1}`;
        img.loading = "lazy";
        img.style.width = "100%";
        img.style.height = "auto";
        img.style.borderRadius = "12px";
        img.style.border = "1px solid var(--border)";
        photoPreviewEl.appendChild(img);
      });
    }


    // Save as draft for this uid
    captureDraft();
  } catch {}
}


async function getPublicProfile(uid) {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/profile/public/${encodeURIComponent(uid)}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}

async function getMyProfile() {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/profile/me`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}

function parseInterests(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function setProfileStatus(msg) {
  if (profileStatusEl) setStatus(profileStatusEl, msg);
}

// Persist draft inputs locally so refresh doesn't wipe them.
function draftKeyForUid(uid) {
  return `ff_profileDraft_v1_${uid || "anon"}`;
}

function loadDraft(uid) {
  const key = draftKeyForUid(uid);
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function saveDraft(uid, d) {
  const key = draftKeyForUid(uid);
  try { localStorage.setItem(key, JSON.stringify(d || {})); } catch {}
}
function captureDraft() {
  const uid = getUidFromIdToken(storage.idToken);

  const d = {
    displayName: profileDisplayNameEl ? profileDisplayNameEl.value : "",
    age: profileAgeEl ? profileAgeEl.value : "",
    city: profileCityEl ? profileCityEl.value : "",
    interests: profileInterestsEl ? profileInterestsEl.value : "",
    lat: profileLatEl ? profileLatEl.value : "",
    lng: profileLngEl ? profileLngEl.value : "",
  };
  saveDraft(d);
}


function syncInterestsHiddenInput() {
  if (!profileInterestsEl) return;
  profileInterestsEl.value = Array.from(selectedInterests).join(", ");
}

function setChipSelected(btn, on) {
  if (!btn) return;
  btn.classList.toggle("isSelected", !!on);
}

function initInterestChipsFromValue(value) {
  selectedInterests = new Set();
  const raw = String(value || "");
  raw.split(",").map(s => s.trim()).filter(Boolean).forEach(v => selectedInterests.add(v));
  if (interestChipsEl) {
    interestChipsEl.querySelectorAll(".chip").forEach((btn) => {
      const v = btn.getAttribute("data-value") || "";
      setChipSelected(btn, selectedInterests.has(v));
    });
  }
  syncInterestsHiddenInput();
}

function initInterestChips() {
  if (!interestChipsEl) return;

  // bootstrap from hidden input if present
  if (profileInterestsEl && profileInterestsEl.value) initInterestChipsFromValue(profileInterestsEl.value);

  interestChipsEl.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = (btn.getAttribute("data-value") || "").trim();
      if (!v) return;
      if (selectedInterests.has(v)) selectedInterests.delete(v);
      else selectedInterests.add(v);
      setChipSelected(btn, selectedInterests.has(v));
      syncInterestsHiddenInput();
      captureDraft();
    });
  });

  if (btnAddInterest && profileInterestCustomEl) {
    btnAddInterest.addEventListener("click", () => {
      const v = profileInterestCustomEl.value.trim().toLowerCase();
      if (!v) return;
      selectedInterests.add(v);
      profileInterestCustomEl.value = "";
      syncInterestsHiddenInput();
      captureDraft();
      // show as selected chip only if it exists in the predefined set
      if (interestChipsEl) {
        const match = interestChipsEl.querySelector(`.chip[data-value="${CSS.escape(v)}"]`);
        if (match) setChipSelected(match, true);
      }
      setProfileStatus(`Added interest: ${v}`);
    });
  }
}

function initBioCounter() {
  if (!profileBioEl || !bioCountEl) return;
  const update = () => {
    const n = (profileBioEl.value || "").length;
    bioCountEl.textContent = String(n);
  };
  profileBioEl.addEventListener("input", () => {
    if (profileBioEl.value.length > 240) profileBioEl.value = profileBioEl.value.slice(0, 240);
    update();
    captureDraft();
  });
  update();
}


// Photo upload (MVP): store small data URLs in users/{uid}.photos[]
let selectedPhotos = []; // data URLs

function setPhotoStatus(msg) {
  if (photoStatusEl) setStatus(photoStatusEl, msg);
}

function renderPhotoPreviews() {
  if (!photoPreviewEl) return;
  photoPreviewEl.innerHTML = "";
  if (!selectedPhotos.length) return;

  selectedPhotos.forEach((src, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "photoItem";

    const img = document.createElement("img");
    img.src = src;
    img.alt = `Selected photo ${idx + 1}`;
    img.loading = "lazy";

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "secondary";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      selectedPhotos.splice(idx, 1);
      renderPhotoPreviews();
      setPhotoStatus(`${selectedPhotos.length} selected.`);
    });

    wrap.appendChild(img);
    wrap.appendChild(rm);
    photoPreviewEl.appendChild(wrap);
  });
}

async function fileToDataUrlResized(file, maxSide = 800, quality = 0.82) {
  // Returns a JPEG data URL resized so the longest side is maxSide.
  // Uses FileReader + <img> to maximize browser compatibility.
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("File read failed."));
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Image load failed."));
    i.src = dataUrl;
  });

  const width = img.width || 1;
  const height = img.height || 1;
  let newW = width;
  let newH = height;

  const longest = Math.max(width, height);
  if (longest > maxSide) {
    const scale = maxSide / longest;
    newW = Math.round(width * scale);
    newH = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, newW, newH);

  return canvas.toDataURL("image/jpeg", quality);
}




async function getMatches() {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/matches`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}


async function getThread(matchId, limit = 50) {
  const idToken = await getValidIdToken();
  if (!matchId) throw new Error("No match selected.");
  const qs = new URLSearchParams({ matchId, limit: String(limit) }).toString();
  return jsonFetch(`${BACKEND_BASE_URL}/api/messages/thread?${qs}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}


async function getCreditsBalance() {
  const headers = await getAuthHeader();
  return jsonFetch(`${BACKEND_BASE_URL}/api/credits/balance`, { method: "GET", headers });
}

async function devAddCredits(amount) {
  const token = (storage && storage.idToken) ? storage.idToken : "";
  if (!token) throw new Error("Not logged in (missing token)");

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "authorization": `Bearer ${token}`,
  };
  if (typeof DEV_OTP_KEY === "string" && DEV_OTP_KEY) headers["x-dev-otp-key"] = DEV_OTP_KEY;

  // Use absolute backend URL to avoid any routing ambiguity
  return jsonFetch(`${BACKEND_BASE_URL}/api/dev/credits/add`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amount, idToken: token })
  });
}


async function sendMessage(matchId, text, clientMessageId) {
  const idToken = await getValidIdToken();
  if (!matchId) throw new Error("No match selected.");
  if (!text || !String(text).trim()) throw new Error("Message text is empty.");

  const body = { matchId, text: String(text).trim() };
  if (clientMessageId) body.clientMessageId = String(clientMessageId);

  return jsonFetch(`${BACKEND_BASE_URL}/api/messages/send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(body)
  });
}



function parseMessageTime(ts) {
  if (!ts) return null;

  // If it's already a number or string date
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const t = Date.parse(ts);
    return isNaN(t) ? null : t;
  }

  // Firestore Timestamp shapes
  // { seconds: 123, nanoseconds: 0 } or { _seconds: 123, _nanoseconds: 0 }
  const seconds = (typeof ts.seconds === "number") ? ts.seconds :
                  (typeof ts._seconds === "number") ? ts._seconds : null;
  const nanos = (typeof ts.nanoseconds === "number") ? ts.nanoseconds :
                (typeof ts._nanoseconds === "number") ? ts._nanoseconds : 0;

  if (seconds !== null) {
    return (seconds * 1000) + Math.floor((nanos || 0) / 1e6);
  }

  // Some backends send { at: { ...timestamp } }
  if (typeof ts === "object") {
    // try common fields
    for (const key of ["createdAt", "sentAt", "at", "time", "timestamp"]) {
      if (ts[key]) {
        const v = parseMessageTime(ts[key]);
        if (v) return v;
      }
    }
  }

  return null;
}

function normalizeThreadResponse(r) {
  if (!r) return [];
  const raw =
    (Array.isArray(r.items) && r.items) ||
    (Array.isArray(r.messages) && r.messages) ||
    (Array.isArray(r.data) && r.data) ||
    (Array.isArray(r) && r) ||
    [];

  return raw.map((m) => {
    const msg = m || {};
    let ms = null;
    const t = msg.createdAt ?? msg.timestamp ?? msg.sentAt ?? msg.time;
    if (typeof t === "number") ms = t;
    else if (typeof t === "string") {
      const d = Date.parse(t);
      if (!Number.isNaN(d)) ms = d;
    } else if (t && typeof t === "object") {
      // Firestore Timestamp JSON from admin SDK often serializes as {_seconds,_nanoseconds}
      if (typeof t._seconds === "number") ms = t._seconds * 1000 + Math.floor((t._nanoseconds || 0) / 1e6);
      else if (typeof t.seconds === "number") ms = t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
    }
    msg._ms = ms;
    return msg;
  });
}



function renderThread(messages) {
  if (!threadListEl) return;
  threadListEl.innerHTML = "";

  const list = Array.isArray(messages) ? messages : [];
  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No messages yet.";
    threadListEl.appendChild(li);
    return;
  }

  const myUid = getUidFromIdToken(storage.idToken);

  for (const msg of list) {
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.style.margin = "10px 0";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "flex-start";

    const fromUid = String(msg.fromUid || msg.from || msg.senderUid || "");
    const isMine = myUid && fromUid && (fromUid === myUid);

    const avatar = document.createElement("div");
    avatar.style.width = "36px";
    avatar.style.height = "36px";
    avatar.style.borderRadius = "10px";
    avatar.style.overflow = "hidden";
    avatar.style.flex = "0 0 36px";
    avatar.style.background = "#eee";

    const img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.alt = "avatar";

    if (!isMine && selectedOtherUid) {
      const cached = publicProfileCache.get(selectedOtherUid);
      if (cached && cached.photoUrl) img.src = cached.photoUrl;
    }
    if (img.src) avatar.appendChild(img);

    const bubbleWrap = document.createElement("div");
    bubbleWrap.style.flex = "1";

    const header = document.createElement("div");
    header.className = "kv";

    const ms = msg._ms || null;
    const when = ms ? new Date(ms).toLocaleString() : "";

    header.textContent = isMine ? (when ? `You • ${when}` : "You") : (when ? `${fromUid} • ${when}` : fromUid);
    bubbleWrap.appendChild(header);

    const bubble = document.createElement("div");
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "12px";
    bubble.style.maxWidth = "600px";
    bubble.style.display = "inline-block";
    bubble.style.background = isMine ? "#111" : "#f2f2f2";
    bubble.style.color = isMine ? "#fff" : "#111";
    bubble.textContent = String(msg.text || msg.message || "");
    bubbleWrap.appendChild(bubble);

    if (isMine) {
      row.style.flexDirection = "row-reverse";
      bubbleWrap.style.textAlign = "right";
      header.style.textAlign = "right";
    }

    row.appendChild(avatar);
    row.appendChild(bubbleWrap);
    li.appendChild(row);
    threadListEl.appendChild(li);
  }
}




function normalizeMatchesResponse(r) {
  if (!r) return [];
  if (Array.isArray(r.items)) return r.items;
  if (Array.isArray(r.matches)) return r.matches;
  if (Array.isArray(r.data)) return r.data;
  if (Array.isArray(r)) return r;
  return [];
}




async function resolvePublicProfile(uid) {
  if (!uid) return { displayName: "", photoUrl: "" };
  if (publicProfileCache.has(uid)) return publicProfileCache.get(uid);

  try {
    const resp = await getPublicProfile(uid);
    const p = resp && resp.profile ? resp.profile : null;
    const displayName = p && p.displayName ? String(p.displayName) : "";
    const photos = p && Array.isArray(p.photos) ? p.photos : [];
    const photoUrl = photos.length ? String(photos[0]) : "";
    const out = { displayName: displayName || uid, photoUrl };
    publicProfileCache.set(uid, out);
    return out;
  } catch {
    const out = { displayName: uid, photoUrl: "" };
    publicProfileCache.set(uid, out);
    return out;
  }
}

async function resolveDisplayName(uid) {
  const p = await resolvePublicProfile(uid);
  return p.displayName || uid;
}

async function renderMatches(matches) {
  if (!matchesListEl) return;
  matchesListEl.innerHTML = "";

  const list = Array.isArray(matches) ? matches : [];
  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No matches yet.";
    matchesListEl.appendChild(li);
    return;
  }

  for (const m of list) {
    const li = document.createElement("li");
    li.className = "matchRow";

    const otherUid = String(m.otherUid || m.other || m.partnerUid || "");
    const matchId = String(m.matchId || m.id || "");

    const pub = await resolvePublicProfile(otherUid);
    const name = pub.displayName || otherUid || "(match)";
    const thumb = pub.photoUrl || "";

    const rowTop = document.createElement("div");
    rowTop.style.display = "flex";
    rowTop.style.gap = "10px";
    rowTop.style.alignItems = "center";

    if (thumb) {
      const img = document.createElement("img");
      img.src = thumb;
      img.alt = name;
      img.style.width = "44px";
      img.style.height = "44px";
      img.style.borderRadius = "10px";
      img.style.objectFit = "cover";
      rowTop.appendChild(img);
    }

    const titleWrap = document.createElement("div");
    titleWrap.style.flex = "1";

    const title = document.createElement("div");
    title.className = "profileTitle";
    title.textContent = name;
    titleWrap.appendChild(title);
    // (hide match id in UI)
rowTop.appendChild(titleWrap);
    li.appendChild(rowTop);

    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = "Open Chat";
    btn.addEventListener("click", () => {
      selectedMatchId = matchId || "";
      selectedOtherUid = otherUid || "";
      if (threadMetaEl) setStatus(threadMetaEl, selectedOtherUid ? `Chat with ${name}` : `Chat`);
      // Switch to chat tab using existing tab system
      if (typeof setActiveTab === "function") setActiveTab("chat");
      else {
        // fallback: click the chat tab button
        const chatBtn = document.querySelector('.tabBtn[data-tab="chat"]');
        if (chatBtn) chatBtn.click();
      }
    });
    li.appendChild(btn);

    matchesListEl.appendChild(li);
  }
}


function renderFeed(items) {
  feedListEl.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No profiles returned.";
    feedListEl.appendChild(li);
    return;
  }

  for (const p of items) {
    const li = document.createElement("li");

    const title = document.createElement("div");
    title.className = "profileTitle";
    title.textContent = `${p.displayName} — ${p.age ?? "?"} — ${p.city ?? ""}`;
    li.appendChild(title);

    // Photo (optional): if profile has photos array of URLs, show first one. Otherwise show placeholder.
    const photoWrap = document.createElement("div");
    photoWrap.style.margin = "8px 0";

    const firstPhoto = Array.isArray(p.photos) && p.photos.length > 0 ? p.photos[0] : null;
    if (firstPhoto && typeof firstPhoto === "string") {
      const img = document.createElement("img");
      img.src = firstPhoto;
      img.alt = `${p.uid} photo`;
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.maxWidth = "420px";
      img.style.borderRadius = "12px";
      img.style.border = "1px solid #dddddd";
      photoWrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.textContent = "No photo yet";
      ph.style.padding = "12px";
      ph.style.borderRadius = "12px";
      ph.style.border = "1px dashed #dddddd";
      ph.style.background = "#ffffff";
      ph.style.color = "#444444";
      ph.style.maxWidth = "420px";
      photoWrap.appendChild(ph);
    }

    li.appendChild(photoWrap);

    const actions = document.createElement("div");
    actions.className = "row";

    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.textContent = "Like";

    const likeStatus = document.createElement("div");
    likeStatus.className = "muted";
    likeStatus.style.marginTop = "6px";

    likeBtn.addEventListener("click", async () => {
      clearError();
      likeBtn.disabled = true;
      likeStatus.textContent = "Liking...";
      try {
        const r = await postLike(p.uid);
        if (r && r.ok) {
          if (r.isMutual) {
            likeStatus.textContent = `Matched ✅ (matchId: ${r.matchId})`;
          } else if (r.alreadyLiked) {
            likeStatus.textContent = "Already liked ✅";
          } else {
            likeStatus.textContent = "Liked ✅";
          }
        } else {
          likeStatus.textContent = "Like failed (unknown response).";
        }
      } catch (e) {
        likeStatus.textContent = "";
        showError(`Like failed: ${e.message}`);
      } finally {
        likeBtn.disabled = false;
      }
    });

    actions.appendChild(likeBtn);
    li.appendChild(actions);
    li.appendChild(likeStatus);

    const kv = document.createElement("div");
    kv.className = "kv";

    const add = (k, v) => {
      const kdiv = document.createElement("div");
      kdiv.className = "key";
      kdiv.textContent = k;
      const vdiv = document.createElement("div");
      vdiv.textContent = v;
      kv.appendChild(kdiv);
      kv.appendChild(vdiv);
    };

    add("Interests", Array.isArray(p.interests) ? p.interests.join(", ") : "");
    if (p.location && typeof p.location.lat === "number" && typeof p.location.lng === "number") {
      add("Location", `${p.location.lat}, ${p.location.lng}`);
    } else {
      add("Location", "(none)");
    }
    add("Plan", p.plan ?? "");
    add("Last Active", p.lastActiveAt ? JSON.stringify(p.lastActiveAt) : "");

    li.appendChild(kv);
    feedListEl.appendChild(li);
  }
}


function uniqueSorted(arr) {
  const s = new Set(arr.filter(Boolean));
  return Array.from(s).sort((a, b) => String(a).localeCompare(String(b)));
}

function setSelectOptions(selectEl, values) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">All</option>' + values.map(v => `<option value="${String(v).replace(/"/g, "&quot;")}">${v}</option>`).join("");
  // Try to preserve existing selection if still present
  if (current && values.includes(current)) selectEl.value = current;
}

function populateFiltersFromItems(items) {
  if (!filterCityEl || !filterInterestEl) return;
  const cities = uniqueSorted(items.map(i => i.city));
  const interests = uniqueSorted(items.flatMap(i => Array.isArray(i.interests) ? i.interests : []));
  setSelectOptions(filterCityEl, cities);
  setSelectOptions(filterInterestEl, interests);
  if (filterStatusEl) setStatus(filterStatusEl, `Filters updated (${cities.length} cities, ${interests.length} interests).`);
}

function getFilteredItems(items) {
  let out = Array.isArray(items) ? [...items] : [];
  const city = filterCityEl ? filterCityEl.value : "";
  const interest = filterInterestEl ? filterInterestEl.value : "";
  if (city) out = out.filter(i => i && i.city === city);
  if (interest) out = out.filter(i => i && Array.isArray(i.interests) && i.interests.includes(interest));
  return out;
}

function applyFiltersAndRender() {
  const filtered = getFilteredItems(allFeedItems);
  renderFeed(filtered);
  // In Discover, the deck respects current filters
  setDeckFromFeed(filtered);
  if (filterStatusEl) setStatus(filterStatusEl, `Showing ${filtered.length} of ${allFeedItems.length} profiles.`);
}

function clearFilters() {
  if (filterCityEl) filterCityEl.value = "";
  if (filterInterestEl) filterInterestEl.value = "";
  renderFeed(allFeedItems);
  if (filterStatusEl) setStatus(filterStatusEl, `Showing ${allFeedItems.length} profiles.`);
}

btnStart.addEventListener("click", async () => {
  clearError();
  setStatus(startResultEl, "");
  const emailRaw = emailEl ? emailEl.value : "";
  const email = sanitizeEmail(emailRaw);
  if (!isValidEmail(email)) { setStatus(authStatusEl, `Invalid email: ${email}`); return; }
  if (!email) return showError("Enter an email first.");

  btnStart.disabled = true;
  try {
    const r = await startAuth(email);
    lastCodeId = r.codeId || null;

    const lines = [];
    if (r.ok) lines.push("OTP started ✅");
    if (r.codeId) lines.push(`codeId: ${r.codeId}`);
    if (r.devOtp) lines.push(`devOtp: ${r.devOtp} (test-only)`);
    setStatus(startResultEl, lines.join("\n"));

    otpEl.focus();
  } catch (e) {
    showError(`Auth start failed: ${e.message}`);
  } finally {
    btnStart.disabled = false;
  }
});

btnVerify.addEventListener("click", async () => {
  clearError();
  const email = (emailEl.value || "").trim();
  const otp = (otpEl.value || "").trim();

  if (!email) return showError("Enter your email.");
  if (!otp) return showError("Enter the OTP code.");
  if (!lastCodeId) return showError("Missing codeId. Click 'Send OTP' first.");

  btnVerify.disabled = true;
  try {
    setStatus(authStatusEl, "Verifying...");
    const v = await verifyAuth(email, lastCodeId, otp);

    // Backend may return either:
    // - { idToken } (already exchanged), OR
    // - { customToken } (preferred), OR legacy { token }
    const idTokenFromVerify = v && v.idToken;
    const customToken = v && (v.customToken || v.token);

    if (!idTokenFromVerify && !customToken) {
      throw new Error("Verify response missing token.");
    }

    if (idTokenFromVerify) {
      storage.idToken = idTokenFromVerify;
      // If backend did not provide refresh token/expires, auto-refresh may not be available until next login.
      storage.refreshToken = storage.refreshToken || null;
      storage.idTokenExpiresAt = storage.idTokenExpiresAt || 0;
    } else {
      setStatus(authStatusEl, "Exchanging token...");
      const ex = await exchangeCustomTokenForIdToken(customToken);
      if (!ex || !ex.idToken) throw new Error("Token exchange missing idToken.");
      storage.idToken = ex.idToken;
      if (ex.refreshToken) storage.refreshToken = ex.refreshToken;
      if (ex.expiresIn) { const ms = Number(ex.expiresIn) * 1000; storage.idTokenExpiresAt = Date.now() + ms - 60_000; }
    }

    forceShowApp();
    setAuthedUI();
if (!storage.idToken) forceShowLanding();
initInterestChips();
initBioCounter();
  hydrateProfileFromServer();
  // Tabs
  if (tabButtons && tabButtons.length) {
    tabButtons.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab"))));
    setActiveTab("discover");
  }

  // Discover actions
  if (btnPassEl) btnPassEl.addEventListener("click", passCurrent);
  if (btnLikeEl) btnLikeEl.addEventListener("click", () => likeCurrent());
  if (btnExpandEl) btnExpandEl.addEventListener("click", expandCurrent);
  if (btnCollapseEl) btnCollapseEl.addEventListener("click", collapseSheet);
  if (btnPass2El) btnPass2El.addEventListener("click", passCurrent);
  if (btnLike2El) btnLike2El.addEventListener("click", () => likeCurrent());

  // Dev feed toggle
  if (btnToggleDevFeed && feedListEl) {
    btnToggleDevFeed.addEventListener("click", () => {
      feedListEl.hidden = !feedListEl.hidden;
    });
  }


  // ====== Matches + Chat wiring ======
  async function loadMatchesUI() {
    if (!matchesStatusEl) return;
    setStatus(matchesStatusEl, "Loading matches...");
    try {
      const resp = await getMatches();
      const items = resp && (resp.items || resp.matches || resp.data || resp.rows) ? (resp.items || resp.matches || resp.data || resp.rows) : [];
      await renderMatches(items);
      setStatus(matchesStatusEl, `Matches loaded: ${Array.isArray(items) ? items.length : 0}`);
    } catch (e) {
      setStatus(matchesStatusEl, `Matches failed: ${e.message}`);
    }
  }

  async function loadThreadUI() {
    if (!threadStatusEl) return;
    if (!selectedMatchId) {
      setStatus(threadStatusEl, "Select a match first.");
      return;
    }
    setStatus(threadStatusEl, "Loading thread...");
    try {
      const resp = await getThread(selectedMatchId, 50);
      const msgs = normalizeThreadResponse(resp);
      renderThread(msgs);
      setStatus(threadStatusEl, `Messages: ${msgs.length}`);
      if (threadMetaEl) {
      const nm = selectedOtherUid ? await resolveDisplayName(selectedOtherUid) : "";
      await resolvePublicProfile(selectedOtherUid);
      setStatus(threadMetaEl, nm ? `Chat with ${nm}` : `Chat`);
    }
    } catch (e) {
      setStatus(threadStatusEl, `Thread failed: ${e.message}`);
    }
  }

  async function sendMessageUI() {
  if (isSendingMessage) return;
  if (!threadStatusEl) return;

  if (!selectedMatchId) {
    setStatus(threadStatusEl, "Select a match first.");
    return;
  }

  const text = messageTextEl ? String(messageTextEl.value || "").trim() : "";
  if (!text) {
    setStatus(threadStatusEl, "Type a message first.");
    return;
  }

  // clientMessageId makes the backend send endpoint idempotent.
  const clientMessageId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  isSendingMessage = true;
  if (btnSendMessage) btnSendMessage.disabled = true;

  try {
    setStatus(threadStatusEl, "Sending...");
    await sendMessage(selectedMatchId, text, clientMessageId);

    if (messageTextEl) messageTextEl.value = "";
    setStatus(threadStatusEl, "Sent ✅ (credits decremented server-side)");
    // Refresh thread after send
    await loadThread(selectedMatchId);
  } catch (err) {
    console.error("sendMessageUI error:", err);
    setStatus(threadStatusEl, `Send failed: ${err?.message || err}`);
  } finally {
    isSendingMessage = false;
    if (btnSendMessage) btnSendMessage.disabled = false;
  }
}

if (!uiWired) {
  uiWired = true;
  btnSendMessage.addEventListener("click", sendMessageUI);

  if (messageTextEl) {
    messageTextEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessageUI();
      }
    });
  }

    attachSwipeHandlers();
}

    setStatus(feedStatusEl, "Signed in. Loading feed...");

    // UX: auto-load feed after sign-in (uses existing Load Feed handler; does not change OTP/auth)
    try {
      if (btnLoadFeed) setTimeout(() => { try { btnLoadFeed.click(); } catch {} }, 0);
    } catch {}

  } catch (e) {
    storage.idToken = null;
  storage.refreshToken = null;
  storage.idTokenExpiresAt = 0;
    setAuthedUI();
if (!storage.idToken) forceShowLanding();
initInterestChips();
initBioCounter();
  // Tabs
  if (tabButtons && tabButtons.length) {
    tabButtons.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab"))));
    setActiveTab("discover");
  }

  // Discover actions
  if (btnPassEl) btnPassEl.addEventListener("click", passCurrent);
  if (btnLikeEl) btnLikeEl.addEventListener("click", () => likeCurrent());
  if (btnExpandEl) btnExpandEl.addEventListener("click", expandCurrent);
  if (btnCollapseEl) btnCollapseEl.addEventListener("click", collapseSheet);
  if (btnPass2El) btnPass2El.addEventListener("click", passCurrent);
  if (btnLike2El) btnLike2El.addEventListener("click", () => likeCurrent());

  // Dev feed toggle
  if (btnToggleDevFeed && feedListEl) {
    btnToggleDevFeed.addEventListener("click", () => {
      feedListEl.hidden = !feedListEl.hidden;
    });
  }

  attachSwipeHandlers();
    showError(`Verify/sign-in failed: ${e.message}`);
  } finally {
    btnVerify.disabled = false;
  }
});

btnLoadFeed.addEventListener("click", async () => {
  clearError();
  setFeedLoading(false, "");
  btnLoadFeed.disabled = true;
  try {
    setFeedLoading(true, "Loading feed...");
    const r = await getFeed();
    allFeedItems = r.items || [];
    setDeckFromFeed(allFeedItems);
    // Keep old list renderer available (dev tab)
    renderFeed(getFilteredItems(allFeedItems));
    populateFiltersFromItems(allFeedItems);
    applyFiltersAndRender();
    setFeedLoading(false, `Loaded ${Array.isArray(r.items) ? r.items.length : 0} profiles ✅`);
  } catch (e) {
    showError(`Feed failed: ${e.message}`);
    setFeedLoading(false, "");
  } finally {
    btnLoadFeed.disabled = false;
  }
});

btnCredits.addEventListener("click", async () => {
  clearError();
  btnCredits.disabled = true;
  try {
    const r = await getCredits();
    setStatus(feedStatusEl, `Credits: ${r.credits ?? "(unknown)"} ✅`);
  } catch (e) {
    showError(`Credits check failed: ${e.message}`);
  } finally {
    btnCredits.disabled = false;
  }
});

if (btnLoadMatches) {
  btnLoadMatches.addEventListener("click", async () => {
    clearError();
    if (matchesStatusEl) setStatus(matchesStatusEl, "");
    if (matchesListEl) matchesListEl.innerHTML = "";
    btnLoadMatches.disabled = true;
    try {
      if (matchesStatusEl) setStatus(matchesStatusEl, "Loading matches...");
      const r = await getMatches();
      const items = normalizeMatchesResponse(r);
      await renderMatches(items);
      if (matchesStatusEl) setStatus(matchesStatusEl, `Loaded ${items.length} matches ✅`);
    } catch (e) {
      if (matchesStatusEl) setStatus(matchesStatusEl, "");
      showError(`Matches failed: ${e.message}`);
    } finally {
      btnLoadMatches.disabled = false;
    }
  });
}


if (btnLoadThread) {
  btnLoadThread.addEventListener("click", async () => {
    clearError();
    if (threadStatusEl) setStatus(threadStatusEl, "");
    if (threadListEl) threadListEl.innerHTML = "";
    btnLoadThread.disabled = true;
    try {
      if (!selectedMatchId) throw new Error("No match selected. Click 'Open Chat' on a match first.");
      if (threadStatusEl) setStatus(threadStatusEl, "Loading thread...");
      const r = await getThread(selectedMatchId, 50);
      const msgs = normalizeThreadResponse(r);
      renderThread(msgs);
      if (threadStatusEl) setStatus(threadStatusEl, `Loaded ${msgs.length} messages ✅`);
    } catch (e) {
      if (threadStatusEl) setStatus(threadStatusEl, "");
      showError(`Thread failed: ${e.message}`);
    } finally {
      btnLoadThread.disabled = false;
    }
  });
}

if (btnSendMessage) {
  btnSendMessage.addEventListener("click", async () => {
    clearError();
    btnSendMessage.disabled = true;
    try {
      if (!selectedMatchId) throw new Error("No match selected. Click 'Open Chat' on a match first.");
      const text = messageTextEl ? messageTextEl.value : "";
      if (threadStatusEl) setStatus(threadStatusEl, "Sending...");
      const r = await sendMessage(selectedMatchId, text);
      if (messageTextEl) messageTextEl.value = "";
      // After send, reload thread so user sees it immediately
      const t = await getThread(selectedMatchId, 50);
      const msgs = normalizeThreadResponse(t);
      renderThread(msgs);
      if (threadStatusEl) setStatus(threadStatusEl, "Sent ✅ (credits decremented server-side)");
    } catch (e) {
      if (threadStatusEl) setStatus(threadStatusEl, "");
      showError(`Send failed: ${e.message}`);
    } finally {
      btnSendMessage.disabled = false;
    }
  });
}




btnLogout.addEventListener("click", () => {
  storage.idToken = null;
  storage.refreshToken = null;
  storage.idTokenExpiresAt = 0;
  lastCodeId = null;
  setStatus(startResultEl, "");
  setStatus(feedStatusEl, "");
  allFeedItems = [];
  renderFeed([]);
  if (matchesListEl) matchesListEl.innerHTML = "";
  if (matchesStatusEl) setStatus(matchesStatusEl, "");
  selectedMatchId = null;
  selectedOtherUid = null;
  if (threadListEl) threadListEl.innerHTML = "";
  if (threadStatusEl) setStatus(threadStatusEl, "");
  if (threadMetaEl) setStatus(threadMetaEl, "");
  if (filterStatusEl) setStatus(filterStatusEl, "");
  clearError();
  setAuthedUI();
if (!storage.idToken) forceShowLanding();
initInterestChips();
initBioCounter();
  // Tabs
  if (tabButtons && tabButtons.length) {
    tabButtons.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab"))));
    setActiveTab("discover");
  }

  // Discover actions
  if (btnPassEl) btnPassEl.addEventListener("click", passCurrent);
  if (btnLikeEl) btnLikeEl.addEventListener("click", () => likeCurrent());
  if (btnExpandEl) btnExpandEl.addEventListener("click", expandCurrent);
  if (btnCollapseEl) btnCollapseEl.addEventListener("click", collapseSheet);
  if (btnPass2El) btnPass2El.addEventListener("click", passCurrent);
  if (btnLike2El) btnLike2El.addEventListener("click", () => likeCurrent());

  // Dev feed toggle
  if (btnToggleDevFeed && feedListEl) {
    btnToggleDevFeed.addEventListener("click", () => {
      feedListEl.hidden = !feedListEl.hidden;
    });
  }

  attachSwipeHandlers();
});

(function init() {
  if (!emailEl.value) emailEl.value = "test@example.com";

  // Profile editor: restore draft inputs (safe if section isn't present)
  const uid = getUidFromIdToken(storage.idToken);
  const d = loadDraft(uid);
  if (profileDisplayNameEl && d.displayName) profileDisplayNameEl.value = d.displayName;
  if (profileAgeEl && d.age) profileAgeEl.value = d.age;
  if (profileCityEl && d.city) profileCityEl.value = d.city;
  if (profileInterestsEl && d.interests) profileInterestsEl.value = d.interests;
  if (profileLatEl && d.lat) profileLatEl.value = d.lat;
  if (profileLngEl && d.lng) profileLngEl.value = d.lng;

  const draftInputs = [profileDisplayNameEl, profileAgeEl, profileCityEl, profileInterestsEl, profileLatEl, profileLngEl].filter(Boolean);
  draftInputs.forEach(el => el.addEventListener("input", captureDraft));

  if (btnSetMiami) btnSetMiami.addEventListener("click", () => {
    if (profileCityEl) profileCityEl.value = "Miami";
    if (profileLatEl) profileLatEl.value = "25.7617";
    if (profileLngEl) profileLngEl.value = "-80.1918";
    captureDraft();
    setProfileStatus("Miami preset applied.");
  });

  if (btnSetOrlando) btnSetOrlando.addEventListener("click", () => {
    if (profileCityEl) profileCityEl.value = "Orlando";
    if (profileLatEl) profileLatEl.value = "28.5383";
    if (profileLngEl) profileLngEl.value = "-81.3792";
    captureDraft();
    setProfileStatus("Orlando preset applied.");
  });

  if (btnSaveProfile) if (btnUseLocation) btnUseLocation.addEventListener("click", () => {
    try {
      if (!navigator.geolocation) {
        if (locationStatusEl) locationStatusEl.textContent = "Geolocation not supported on this device/browser. Please type your city instead.";
        return;
      }
      if (locationStatusEl) locationStatusEl.textContent = "Requesting location…";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = roundLoc(pos.coords.latitude, 3);
          const lng = roundLoc(pos.coords.longitude, 3);
          if (profileLatEl) profileLatEl.value = String(lat);
          if (profileLngEl) profileLngEl.value = String(lng);
          if (profileCityEl && !String(profileCityEl.value || "").trim()) {
            if (profileZipEl && !profileZipEl.value) profileZipEl.value = "";
          }
          if (locationStatusEl) locationStatusEl.textContent = `Location set ✅ (lat ${lat}, lng ${lng})`;
        },
        (err) => {
          const msg = err && err.message ? err.message : "Permission denied or unavailable.";
          if (locationStatusEl) locationStatusEl.textContent = `Location failed: ${msg}. You can type your city instead.`;
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    } catch (e) {
      if (locationStatusEl) locationStatusEl.textContent = "Location failed. Please type your city instead.";
    }
  });

  if (btnClearLocation) btnClearLocation.addEventListener("click", () => {
    if (profileLatEl) profileLatEl.value = "";
    if (profileLngEl) profileLngEl.value = "";
    if (locationStatusEl) locationStatusEl.textContent = "Location cleared.";
  });

  btnSaveProfile.addEventListener("click", async () => {
  const photos = document.querySelectorAll(".photoThumb img");
  if (!photos || photos.length === 0) {
    alert("Please add at least one photo to continue.");
    return;
  }

    clearError();
    btnSaveProfile.disabled = true;
    try {
      const payload = {};
      const dn = profileDisplayNameEl ? profileDisplayNameEl.value.trim() : "";
      const city = profileCityEl ? profileCityEl.value.trim() : "";
      const ageRaw = profileAgeEl ? profileAgeEl.value : "";
      syncInterestsHiddenInput();
      const interestsRaw = profileInterestsEl ? profileInterestsEl.value : "";
      const latRaw = profileLatEl ? profileLatEl.value : "";
      const lngRaw = profileLngEl ? profileLngEl.value : "";

      if (dn) payload.displayName = dn;
      if (city) payload.city = city;

      const bio = profileBioEl ? profileBioEl.value.trim() : "";
      if (bio) payload.bio = bio;

      if (ageRaw !== "") {
        const ageNum = Number(ageRaw);
        if (!Number.isFinite(ageNum)) throw new Error("Age must be a number.");
        payload.age = ageNum;
      }

      const interests = parseInterests(interestsRaw);
      if (interests.length) payload.interests = interests;

      if (latRaw !== "" || lngRaw !== "") {
        const latNum = Number(latRaw);
        const lngNum = Number(lngRaw);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) throw new Error("Location lat/lng must be numbers.");
        payload.location = { lat: latNum, lng: lngNum };
      }

      if (Object.keys(payload).length === 0) throw new Error("Nothing to save. Fill at least one field.");

      setProfileStatus("Saving profile...");
      await updateProfile(payload);
      setProfileStatus("Profile Saved Successfully ✅");
    } catch (e) {
      setProfileStatus("");
      showError(`Profile update failed: ${e.message}`);
    } finally {
      btnSaveProfile.disabled = false;
    }
  });


  // Filter buttons (safe if filters section isn't present)
  if (btnApplyFilters) btnApplyFilters.addEventListener("click", applyFiltersAndRender);
  if (btnClearFilters) btnClearFilters.addEventListener("click", clearFilters);
  setAuthedUI();
if (!storage.idToken) forceShowLanding();
initInterestChips();
initBioCounter();
  // Tabs
  if (tabButtons && tabButtons.length) {
    tabButtons.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab"))));
    setActiveTab("discover");
  }

  // Discover actions
  if (btnPassEl) btnPassEl.addEventListener("click", passCurrent);
  if (btnLikeEl) btnLikeEl.addEventListener("click", () => likeCurrent());
  if (btnExpandEl) btnExpandEl.addEventListener("click", expandCurrent);
  if (btnCollapseEl) btnCollapseEl.addEventListener("click", collapseSheet);
  if (btnPass2El) btnPass2El.addEventListener("click", passCurrent);
  if (btnLike2El) btnLike2El.addEventListener("click", () => likeCurrent());

  // Dev feed toggle
  if (btnToggleDevFeed && feedListEl) {
    btnToggleDevFeed.addEventListener("click", () => {
      feedListEl.hidden = !feedListEl.hidden;
    });
  }

  attachSwipeHandlers();
  if (storage.idToken) {
    setStatus(feedStatusEl, "Signed in from previous session. Loading feed...");
    // UX: auto-load feed on startup (uses existing Load Feed handler)
    try { if (btnLoadFeed) setTimeout(() => { try { btnLoadFeed.click(); } catch {} }, 0); } catch {}
  }

  // Photo selection handlers (safe if Photos UI isn't present)
  if (btnClearPhotos) btnClearPhotos.addEventListener("click", () => {
    selectedPhotos = [];
    if (photoFilesEl) photoFilesEl.value = "";
    renderPhotoPreviews();
    setPhotoStatus("Cleared.");
  });

  if (photoFilesEl) photoFilesEl.addEventListener("change", async () => {
    clearError();
    setPhotoStatus("Processing photos...");
    try {
      const files = Array.from(photoFilesEl.files || []);
      if (!files.length) {
        setPhotoStatus("");
        return;
      }
      const remaining = Math.max(0, 6 - selectedPhotos.length);
      const toAdd = files.slice(0, remaining);
      for (const f of toAdd) {
        const resized = await fileToDataUrlResized(f, 800, 0.82);
        selectedPhotos.push(resized);
      }
      if (selectedPhotos.length > 6) selectedPhotos = selectedPhotos.slice(0, 6);
      renderPhotoPreviews();
      setPhotoStatus(`${selectedPhotos.length} selected.`);
    } catch (e) {
      setPhotoStatus("");
      showError(`Photo processing failed: ${e.message}`);
    }
  });

  if (btnSavePhotos) btnSavePhotos.addEventListener("click", async () => {
    clearError();
    btnSavePhotos.disabled = true;
    try {
      if (!selectedPhotos.length) throw new Error("No photos selected.");
      setPhotoStatus("Saving photos...");
      await updateProfile({ photos: selectedPhotos });
      setPhotoStatus("Photos saved ✅");
    } catch (e) {
      setPhotoStatus("");
      showError(`Photo save failed: ${e.message}`);
    } finally {
      btnSavePhotos.disabled = false;
    }
  });


  if (btnCheckBackend) btnCheckBackend.addEventListener("click", checkBackend);

// Dev Tools: Add Credits (testing)
(function setupDevAddCredits() {
  try {
    // Avoid duplicating the UI if hot-reload runs again
    if (document.getElementById("btnDevAddCredits")) return;

    const devPanel =
      document.querySelector('[data-panel="dev"]') ||
      document.getElementById("panelDev") ||
      document.body;

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "10px";
    card.innerHTML = `
      <h3>Dev Credits</h3>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button id="btnDevAddCredits" type="button">Add +100 Credits</button>
        <button id="btnDevAddCredits1000" type="button">Add +1000 Credits</button>
      </div>
      <div id="devCreditsStatus" class="muted" style="margin-top:6px;"></div>
    `;

    // Place it under Backend Debug if possible
    if (backendDebugEl && backendDebugEl.parentElement) {
      backendDebugEl.parentElement.appendChild(card);
    } else {
      devPanel.appendChild(card);
    }

    const btn100 = document.getElementById("btnDevAddCredits");
    const btn1000 = document.getElementById("btnDevAddCredits1000");
    const statusEl = document.getElementById("devCreditsStatus");

    const setStatus = (msg) => {
      if (statusEl) statusEl.textContent = msg;
    };

    const doAdd = async (amount) => {
      if (!storage.idToken) {
        setStatus("Login first (need token).");
        return;
      }

      const devKey = localStorage.getItem("ffDevKey") || "ff-dev";

      btn100.disabled = true;
      btn1000.disabled = true;
      setStatus("Adding credits...");

      try {
        const data = await jsonFetch(`/api/dev/credits/add`, {
          method: "POST",
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json",
            "x-dev-otp-key": devKey
          },
          body: { amount }
        });

        if (!data?.ok) {
          setStatus(`Failed: ${data?.error || "unknown"}`);
        } else {
          setStatus(`✅ Added ${amount}. New balance: ${data.credits}`);
        }
        await refreshDevCreditsBalance();

        // Refresh the "Check Credits" display if you're on that flow
        if (btnCredits) {
          // don't await; just refresh in background
          try { btnCredits.click(); } catch (e) {}
        }
      } catch (err) {
        setStatus(`Failed: ${err?.message || String(err)}`);
      } finally {
        btn100.disabled = false;
        btn1000.disabled = false;
      }
    };

    btn100.addEventListener("click", () => doAdd(100));
    btn1000.addEventListener("click", () => doAdd(1000));
  } catch (e) {
    // ignore
  }
})();

})();



// ====== Tabs ======
function setActiveTab(tabName) {
  tabButtons.forEach(btn => {
    const isActive = btn.getAttribute("data-tab") === tabName;
    btn.classList.toggle("active", isActive);
  });
  tabPanels.forEach(p => {
    const show = p.getAttribute("data-panel") === tabName;
    if (show) p.hidden = false;
    else p.hidden = true;
  });

  // Hide dev feed list by default unless dev tab
  if (feedListEl) {
    feedListEl.hidden = tabName !== "dev";
  }
}

// ====== Discover Deck ======
function firstPhotoUrl(p) {
  if (!p) return null;
  const photos = p.photos;
  if (Array.isArray(photos) && photos.length && typeof photos[0] === "string") return photos[0];
  return null;
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function renderCollapsedCard(p) {
  currentProfile = p || null;
  if (!swipeCardEl || !swipeTitleEl || !swipePhotoEl) return;

  if (!p) {
    const loaded = Array.isArray(allFeedItems) && allFeedItems.length > 0;
    swipeTitleEl.textContent = loaded ? "No profiles match right now" : "No profiles yet";
    if (swipeSubEl) swipeSubEl.textContent = loaded ? "Try widening filters or check back later." : "Your feed will appear here after it’s available.";
    swipePhotoEl.style.backgroundImage = "";
    return;
  }

  const age = (p.age !== undefined && p.age !== null) ? p.age : "?";
  const city = p.city || "";
  const uid = p.uid || "(unknown)";
  swipeTitleEl.textContent = currentProfile && currentProfile.displayName ? String(currentProfile.displayName) : "";
  if (swipeSubEl) swipeSubEl.textContent = `${age} • ${city}`.trim();

  const photo = firstPhotoUrl(p);
  // Ensure swipe photo shows as a single scaled image (no tiling)
  swipePhotoEl.style.backgroundRepeat = "no-repeat";
  swipePhotoEl.style.backgroundPosition = "center";
  swipePhotoEl.style.backgroundSize = "contain";
    if (photo) swipePhotoEl.style.backgroundImage = `url("${photo}")`;
  else swipePhotoEl.style.backgroundImage = "";

  // UX: Preload the next profile photo for smoother swipes (best-effort)
  try {
    const next = (Array.isArray(deckItems) && typeof deckIndex === "number") ? deckItems[deckIndex + 1] : null;
    const nextPhoto = next ? firstPhotoUrl(next) : "";
    if (nextPhoto) { const img = new Image(); img.src = nextPhoto; }
  } catch {}
}

function clearChildren(el) { if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }

function renderExpandedSheet(p) {
  if (!expandSheetEl) return;
  if (!p) {
    expandSheetEl.hidden = true;
    isExpanded = false;
    return;
  }

  // Show sheet
  expandSheetEl.hidden = false;
  isExpanded = true;

  const age = (p.age !== undefined && p.age !== null) ? p.age : "?";
  const city = p.city || "";
  const uid = p.uid || "Profile";

  if (sheetTitleEl) sheetTitleEl.textContent = (currentProfile && currentProfile.displayName) ? String(currentProfile.displayName) : "";
  if (sheetAgeEl) sheetAgeEl.textContent = safeText(age);
  if (sheetCityEl) sheetCityEl.textContent = safeText(city);
  if (sheetPlanEl) sheetPlanEl.textContent = safeText(p.plan || "");
  if (sheetLastActiveEl) sheetLastActiveEl.textContent = p.lastActiveAt ? JSON.stringify(p.lastActiveAt) : "";

  // Photos grid
  clearChildren(sheetPhotosEl);
  const photos = Array.isArray(p.photos) ? p.photos.filter(x => typeof x === "string") : [];
  if (sheetPhotosEl) {
    if (photos.length) {
      photos.slice(0, 6).forEach((src, idx) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = `${uid} photo ${idx + 1}`;
        img.loading = "lazy";
        sheetPhotosEl.appendChild(img);
      });
    } else {
      const ph = document.createElement("div");
      ph.className = "muted";
      ph.textContent = "No photos yet.";
      sheetPhotosEl.appendChild(ph);
    }
  }

  // Kinks/interests (ONLY in expanded)
  clearChildren(sheetInterestsEl);
  const interests = Array.isArray(p.interests) ? p.interests : [];
  if (sheetInterestsEl) {
    if (interests.length) {
      interests.slice(0, 24).forEach(tag => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = safeText(tag);
        sheetInterestsEl.appendChild(chip);
      });
    } else {
      const m = document.createElement("div");
      m.className = "muted";
      m.textContent = "(none)";
      sheetInterestsEl.appendChild(m);
    }
  }

  // About (optional)
  if (sheetAboutEl) sheetAboutEl.textContent = safeText(p.bio || p.about || "");
}

function showNextProfile() {
  if (!deckItems || deckItems.length === 0) {
    renderCollapsedCard(null);
    renderExpandedSheet(null);
    return;
  }
  if (deckIndex < 0) deckIndex = 0;
  if (deckIndex >= deckItems.length) {
    renderCollapsedCard(null);
    renderExpandedSheet(null);
    return;
  }
  const p = deckItems[deckIndex];
  renderCollapsedCard(p);
  if (isExpanded) renderExpandedSheet(p);
}

function setDeckFromFeed(items) {
  deckItems = Array.isArray(items) ? items.slice() : [];
  deckIndex = 0;
  isExpanded = false;
  if (expandSheetEl) expandSheetEl.hidden = true;
  showNextProfile();
}

function advanceDeck() {
  deckIndex += 1;
  isExpanded = false;
  if (expandSheetEl) expandSheetEl.hidden = true;
  showNextProfile();
}

async function likeCurrent() {
  if (actionLocked) return;
  if (!currentProfile || !currentProfile.uid) return;

  actionLocked = true;
  try {
    await postLike(currentProfile.uid);
    advanceDeck();
  } catch (e) {
    showError(`Like failed: ${e.message}`);
  } finally {
    actionLocked = false;
  }
}


function passCurrent() {
  if (actionLocked) return;

  actionLocked = true;
  try {
    advanceDeck();
  } finally {
    actionLocked = false;
  }
}


function expandCurrent() {
  if (!currentProfile) return;
  renderExpandedSheet(currentProfile);
}

function collapseSheet() {
  if (expandSheetEl) expandSheetEl.hidden = true;
  isExpanded = false;
}

// Touch gestures on swipe card
function attachSwipeHandlers() {
  if (!swipeCardEl) return;

  swipeCardEl.addEventListener("touchstart", (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });

  swipeCardEl.addEventListener("touchend", (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || !touchStart) return;

    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Swipe-up to expand
    if (absY > absX && dy < -50) {
      lastSwipeAt = Date.now();
      expandCurrent();
      touchStart = null;
      return;
    }

    // Horizontal swipe pass/like
    if (absX > absY && absX > 60) {
      lastSwipeAt = Date.now();
      if (dx < 0) passCurrent();
      else likeCurrent();
    }

    touchStart = null;
  }, { passive: true });

  // Tap/click to open details (does NOT affect OTP/auth)
  const onTapExpand = () => {
    // ignore taps that immediately follow a swipe gesture
    if (Date.now() - lastSwipeAt < 350) return;
    expandCurrent();
  };

  try {
    if (swipePhotoEl) {
      swipePhotoEl.style.cursor = "pointer";
      swipePhotoEl.addEventListener("click", onTapExpand);
    }
    if (swipeTitleEl) {
      swipeTitleEl.style.cursor = "pointer";
      swipeTitleEl.addEventListener("click", onTapExpand);
    }
  } catch {}

  // Keyboard shortcuts: Left=pass, Right=like, Up=expand, Esc=close
  swipeCardEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); passCurrent(); }
    if (e.key === "ArrowRight") { e.preventDefault(); likeCurrent(); }
    if (e.key === "ArrowUp") { e.preventDefault(); expandCurrent(); }
    if (e.key === "Escape") { e.preventDefault(); collapseSheet(); }
  });
}
function sanitizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  return email;
}

function isValidEmail(email) {
  // simple, practical validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}


