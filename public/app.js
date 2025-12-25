
function setDevCreditsStatus(msg) {
  if (devCreditsStatusEl) devCreditsStatusEl.textContent = msg || "";
}

function setDevCreditsBalance(n) {
  if (!devCreditsBalanceEl) return;
  devCreditsBalanceEl.textContent = Number.isFinite(n) ? String(n) : String(n || "");
}

function normalizePhotoUrl(p) {
  if (!p) return "";
  if (typeof p === "string") return p;
  if (typeof p === "object") {
    // common shapes: {url}, {src}, {downloadURL}, {dataUrl}
    return String(p.url || p.src || p.downloadURL || p.dataUrl || "");
  }
  return String(p);
}


function setProfileHeroFromProfile(profile){
  try{
    if (!profile) return;
    const photos = Array.isArray(profile.photos) ? profile.photos.map(normalizePhotoUrl).filter(Boolean) : [];
    const primary = normalizePhotoUrl(profile.primaryPhoto) || (photos.length ? photos[0] : "");
    if (profileHeroImgEl){
      profileHeroImgEl.src = primary || "";
      profileHeroImgEl.style.display = primary ? "block" : "none";
    }
    const name = (profile.displayName || profile.name || "").trim();
    const ageNum = (typeof profile.age === "number") ? profile.age : (profile.age ? Number(profile.age) : null);
    const label = (name ? name : "Your Profile") + ((ageNum && !Number.isNaN(ageNum)) ? `, ${ageNum}` : "");
    if (profileHeroNameAgeEl) profileHeroNameAgeEl.textContent = label;
  }catch(e){}
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


function getProfileUid(p) {
  if (!p) return "";
  return String(
    p.uid ||
    (p.user && (p.user.uid || p.user.id)) ||
    p.userId ||
    p.profileUid ||
    (p.profile && (p.profile.uid || p.profile.userId)) ||
    ""
  ).trim();
}

function normalizeFeedItem(item) {
  if (!item || typeof item !== "object") return null;
  const uid = getProfileUid(item);
  const profile = item.profile && typeof item.profile === "object" ? item.profile : {};
  const user = item.user && typeof item.user === "object" ? item.user : {};
  const photos = Array.isArray(profile.photos) ? profile.photos : (Array.isArray(item.photos) ? item.photos : []);
  const primaryPhotoUrl = profile.primaryPhotoUrl || item.primaryPhotoUrl || profile.primaryPhoto || item.primaryPhoto || "";
  return {
    ...item,
    uid,
    user,
    profile: { ...profile, photos, primaryPhotoUrl },
  };
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
const profileCityEl = $("profileCity");
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
// Ensure Save Profile button exists (HTML might not include it)
let btnSaveProfileLiveEl = $("btnSaveProfile");
if (!btnSaveProfileLiveEl) {
  const row = btnSavePhotos ? btnSavePhotos.parentElement : null;
  const btn = document.createElement("button");
  btn.id = "btnSaveProfile";
  btn.type = "button";
  btn.className = "btn";
  btn.textContent = "Save Profile";
  if (row) row.insertBefore(btn, row.firstChild);
  btnSaveProfileLiveEl = btn;
}
try { if (btnSavePhotos) btnSavePhotos.style.display = "none"; } catch (e) {}

const btnClearPhotos = $("btnClearPhotos");
const photoStatusEl = $("photoStatus");
const photoPreviewEl = $("photoPreview");
const profileHeroImgEl = $("profileHeroImg");
const profileHeroNameAgeEl = $("profileHeroNameAge");

const btnDeleteSelectedPhotos = (function ensureDeleteSelectedPhotosBtn(){
  // Try to find existing button
  let b = $("btnDeleteSelectedPhotos");
  if (b) return b;

  // Place next to Clear Selected (btnClearPhotos) if possible
  const anchor = $("btnClearPhotos");
  if (!anchor || !anchor.parentNode) return null;

  b = document.createElement("button");
  b.id = "btnDeleteSelectedPhotos";
  b.className = anchor.className || "btn";
  b.type = "button";
  b.textContent = "Delete Selected Photos";
  b.style.marginLeft = "8px";
  anchor.parentNode.insertBefore(b, anchor.nextSibling);
  return b;
})();

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
  // Ensure visitors never see app UI before auth state is applied
  if (appView) appView.style.display = "none";
  if (landingView) landingView.style.display = "";
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

/* === FF: ensure Expand Sheet DOM exists before refs are captured (OTP-safe) === */
(function ffEnsureExpandSheetEarly(){
  try{
    const make = () => {
      if (document.getElementById("expandSheet")) return;
      const sheet = document.createElement("div");
      sheet.id = "expandSheet";
      sheet.hidden = true;
      sheet.style.position = "fixed";
      sheet.style.left = "0";
      sheet.style.right = "0";
      sheet.style.bottom = "0";
      sheet.style.top = "0";
      sheet.style.zIndex = "9998";
      sheet.style.background = "rgba(0,0,0,0.55)";
      sheet.style.display = "grid";
      sheet.style.placeItems = "end center";

      const panel = document.createElement("div");
      panel.style.width = "100%";
      panel.style.maxWidth = "520px";
      panel.style.maxHeight = "92vh";
      panel.style.overflow = "auto";
      panel.style.borderRadius = "22px 22px 0 0";
      panel.style.background = "rgba(20,20,24,0.98)";
      panel.style.border = "1px solid rgba(255,255,255,0.10)";
      panel.style.boxShadow = "0 -20px 60px rgba(0,0,0,0.55)";
      panel.style.padding = "14px 16px 18px";

      const title = document.createElement("div");
      title.id = "sheetTitle";
      title.style.fontSize = "22px";
      title.style.fontWeight = "800";
      title.style.marginBottom = "6px";

      const meta = document.createElement("div");
      meta.style.display = "flex";
      meta.style.gap = "10px";
      meta.style.flexWrap = "wrap";
      meta.style.opacity = "0.9";
      meta.style.marginBottom = "10px";

      const age = document.createElement("div"); age.id="sheetAge";
      const city = document.createElement("div"); city.id="sheetCity";
      const last = document.createElement("div"); last.id="sheetLastActive";
      meta.appendChild(age); meta.appendChild(city); meta.appendChild(last);

      const about = document.createElement("div");
      about.id = "sheetAbout";
      about.style.marginTop = "10px";
      about.style.whiteSpace = "pre-wrap";
      about.style.opacity = "0.95";

      const interests = document.createElement("div");
      interests.id = "sheetInterests";
      interests.style.marginTop = "10px";
      interests.style.display = "flex";
      interests.style.flexWrap = "wrap";
      interests.style.gap = "8px";

      const photos = document.createElement("div");
      photos.id = "sheetPhotos";
      photos.style.marginTop = "12px";
      photos.style.display = "grid";
      photos.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
      photos.style.gap = "10px";

      const plan = document.createElement("div");
      plan.id = "sheetPlan";
      plan.style.marginTop = "10px";
      plan.style.opacity = "0.85";
      plan.style.fontSize = "12px";

      panel.appendChild(title);
      panel.appendChild(meta);
      panel.appendChild(interests);
      panel.appendChild(about);
      panel.appendChild(photos);
      panel.appendChild(plan);

      sheet.appendChild(panel);
      document.body.appendChild(sheet);

      // Click backdrop to close
      sheet.addEventListener("click", (ev) => {
        if (ev.target === sheet) { sheet.hidden = true; }
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", make, { once: true });
    } else {
      make();
    }
  }catch(e){}
})();

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
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
  });
}

async function getFeed() {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/feed`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
  });
}


async function postLike(targetUid) {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/like`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
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
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: fields
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
    const photosRaw = (profile && Array.isArray(profile.photos) ? profile.photos :
                   (resp.user && Array.isArray(resp.user.photos) ? resp.user.photos : []));
    const photos = Array.isArray(photosRaw) ? photosRaw.map(normalizePhotoUrl).filter(Boolean) : [];
    if (Array.isArray(photos) && photoPreviewEl) {
      showingSavedPhotos = true;
      savedPhotosCache = photos.slice(0, 6);
      savedPhotoSelection = new Set();
      // Render previews
      photoPreviewEl.innerHTML = "";
      photos.slice(0, 6).forEach((url, idx) => {
        const wrap = document.createElement("div");
        wrap.className = "photoThumb";
        wrap.style.position = "relative";

        const img = document.createElement("img");
        img.src = url;
        img.alt = `Photo ${idx + 1}`;
        img.loading = "lazy";
        img.style.width = "100%";
        img.style.height = "120px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "12px";
        img.style.border = savedPhotoSelection.has(url) ? "2px solid #fff" : "1px solid var(--border)";
        img.style.cursor = "pointer";

        const badge = document.createElement("div");
        badge.textContent = savedPhotoSelection.has(url) ? "Selected" : "Tap to select";
        badge.style.position = "absolute";
        badge.style.left = "8px";
        badge.style.bottom = "8px";
        badge.style.padding = "4px 6px";
        badge.style.borderRadius = "8px";
        badge.style.fontSize = "12px";
        badge.style.background = "rgba(0,0,0,0.55)";
        badge.style.color = "#fff";

        wrap.addEventListener("click", () => {
          if (savedPhotoSelection.has(url)) savedPhotoSelection.delete(url);
          else savedPhotoSelection.add(url);
          img.style.border = savedPhotoSelection.has(url) ? "2px solid #fff" : "1px solid var(--border)";
          badge.textContent = savedPhotoSelection.has(url) ? "Selected" : "Tap to select";
          setPhotoStatus(savedPhotoSelection.size ? `${savedPhotoSelection.size} selected to delete.` : "");
        });

        wrap.appendChild(img);
        wrap.appendChild(badge);
        photoPreviewEl.appendChild(wrap);
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
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
  });
}

async function getMyProfile() {
  const idToken = await getValidIdToken();
  return jsonFetch(`${BACKEND_BASE_URL}/api/profile/me`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
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
let selectedPhotos = [];
let savedPhotosCache = [];
let savedPhotoSelection = new Set();
let showingSavedPhotos = false;
 // data URLs

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
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
  });
}


async function getThread(matchId, limit = 50) {
  const idToken = await getValidIdToken();
  if (!matchId) throw new Error("No match selected.");
  const qs = new URLSearchParams({ matchId, limit: String(limit) }).toString();
  return jsonFetch(`${BACKEND_BASE_URL}/api/messages/thread?${qs}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
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
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
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

setAuthedUI();
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
    attachSheetSwipeHandlers();
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
    attachSheetSwipeHandlers();
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
    allFeedItems = filterOutSelf(r.items || []);
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
    attachSheetSwipeHandlers();
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

  if (btnUseLocation) btnUseLocation.addEventListener("click", () => {
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
  if (btnSaveProfile) btnSaveProfile.addEventListener("click", async () => {
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
      setProfileStatus("Saved ✅ (lastActive/profileUpdated set server-side)");
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
    attachSheetSwipeHandlers();
  if (storage.idToken) {
    setStatus(feedStatusEl, "Signed in from previous session. Loading feed...");
    // UX: auto-load feed on startup (uses existing Load Feed handler)
    try { if (btnLoadFeed) setTimeout(() => { try { btnLoadFeed.click(); } catch {} }, 0); } catch {}
  }

  // Photo selection handlers (safe if Photos UI isn't present)
  if (btnClearPhotos) btnClearPhotos.addEventListener("click", async () => {
    clearError();
    try {
      if (showingSavedPhotos) {
        if (!savedPhotoSelection || savedPhotoSelection.size === 0) {
          setPhotoStatus("Select 1+ saved photos to delete.");
          return;
        }
        const ok = confirm(`Delete ${savedPhotoSelection.size} selected photo(s)?`);
        if (!ok) return;
        setPhotoStatus("Deleting...");
        const selectedKeys = new Set(Array.from(savedPhotoSelection || []).map(normalizePhotoUrl).filter(Boolean));
      const remaining = (savedPhotosCache || []).filter(p => !selectedKeys.has(p));
        await updateProfile({ photos: remaining });
        await hydrateProfileFromServer();
        setPhotoStatus("Deleted ✅");
      } else {
        // Clear staged selection (not saved photos)
        selectedPhotos = [];
        renderPhotoPreviews();
        setPhotoStatus("Selection cleared.");
      }
    } catch (e) {
      setPhotoStatus("");
      showError(`Delete failed: ${e.message}`);
    }
  });

  // Dedicated "Delete Selected Photos" button (keeps OTP/login untouched)
  if (btnDeleteSelectedPhotos) btnDeleteSelectedPhotos.addEventListener("click", async () => {
    clearError();
    try {
      if (!showingSavedPhotos) {
        setPhotoStatus("Select saved photos in the gallery first.");
        return;
      }
      if (!savedPhotoSelection || savedPhotoSelection.size === 0) {
        setPhotoStatus("Select 1+ saved photos to delete.");
        return;
      }

      const ok = confirm(`Delete ${savedPhotoSelection.size} selected photo(s)?`);
      if (!ok) return;

      setPhotoStatus("Deleting...");

      const remaining = (savedPhotosCache || [])
        .map(normalizePhotoUrl)
        .filter(Boolean)
        .filter(p => !savedPhotoSelection.has(String(p)));

      await updateProfile({ photos: remaining });

      // Immediately reflect in UI (then hydrate from server)
      if (photoPreviewEl) {
        photoPreviewEl.innerHTML = "";
        remaining.slice(0, 6).forEach((url, idx) => {
          const wrap = document.createElement("div");
          wrap.className = "photoTile";
          wrap.dataset.photoUrl = String(url);

          const img = document.createElement("img");
          img.src = String(url);
          img.alt = `Photo ${idx + 1}`;
          img.loading = "lazy";

          const badge = document.createElement("div");
          badge.className = "photoBadge";
          badge.textContent = "Tap to select";

          wrap.appendChild(img);
          wrap.appendChild(badge);

          wrap.addEventListener("click", () => {
            const key = String(url);
            if (savedPhotoSelection.has(key)) {
              savedPhotoSelection.delete(key);
              wrap.classList.remove("selected");
              badge.textContent = "Tap to select";
            } else {
              savedPhotoSelection.add(key);
              wrap.classList.add("selected");
              badge.textContent = "Selected";
            }
            setPhotoStatus(`${savedPhotoSelection.size} selected to delete.`);
          });

          photoPreviewEl.appendChild(wrap);
        });
      }

      savedPhotosCache = remaining.slice(0, 6);
      savedPhotoSelection = new Set();

      await hydrateProfileFromServer();
      setPhotoStatus("Deleted ✅");
    } catch (e) {
      setPhotoStatus("");
      showError(`Delete failed: ${e.message}`);
    }
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
      const idToken = await getValidIdToken();

      // Fetch existing photos so we append (not overwrite)
      let existing = [];
      try {
        const me = await jsonFetch(`${BACKEND_BASE_URL}/api/profile/me`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }
        });
        existing = (me && me.profile && Array.isArray(me.profile.photos)) ? me.profile.photos : [];
      } catch (e) {
        existing = [];
      }

      // Merge: existing + staged, de-dupe, max 6
      const merged = [];
      [...existing, ...selectedPhotos].forEach(p => {
        const u = String(p);
        if (!merged.includes(u)) merged.push(u);
      });
      await updateProfile({ photos: merged.slice(0, 6) });
      selectedPhotos = [];
      setPhotoStatus("Photos saved ✅");
      await hydrateProfileFromServer();
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
  const raw = Array.isArray(items) ? items : [];
  deckItems = raw.map(normalizeFeedItem).filter(Boolean).filter((it) => !!getProfileUid(it));
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
  const targetUid = getProfileUid(currentProfile);
  if (!targetUid) return;

  actionLocked = true;
  // FF: prevent liking yourself (backend rejects; treat as pass)
  try {
    const myUid = getUidFromIdToken(storage.idToken);
    if (currentProfile && myUid && targetUid === myUid) {
      advanceDeck();
      actionLocked = false;
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    await postLike(targetUid);
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
  try { swipeCardEl.setAttribute("tabindex","0"); } catch(e) {}
  try { swipeCardEl.style.outline = "none"; } catch(e) {}
  // Keep keyboard events working on desktop
  try { swipeCardEl.addEventListener("pointerdown", ()=>{ try{ swipeCardEl.focus(); }catch(e){} }); } catch(e) {}

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


function attachSheetSwipeHandlers() {
  if (!expandSheetEl) return;

  let startX = 0;
  let startY = 0;
  let active = false;

  const onStart = (clientX, clientY) => {
    startX = clientX;
    startY = clientY;
    active = true;
  };

  const onEnd = (clientX, clientY) => {
    if (!active) return;
    active = false;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // swipe DOWN to close expanded profile
    if (Math.abs(dy) > Math.abs(dx) && dy > 60) {
      collapseSheet();
    }
  };

  // Touch
  expandSheetEl.addEventListener("touchstart", (e) => {
    if (!e.touches || !e.touches[0]) return;
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  expandSheetEl.addEventListener("touchend", (e) => {
    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    if (!t) return;
    onEnd(t.clientX, t.clientY);
  }, { passive: true });

  // Mouse / pointer
  expandSheetEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    onStart(e.clientX, e.clientY);
    try { expandSheetEl.setPointerCapture(e.pointerId); } catch (_) {}
  });

  expandSheetEl.addEventListener("pointerup", (e) => {
    onEnd(e.clientX, e.clientY);
    try { expandSheetEl.releasePointerCapture(e.pointerId); } catch (_) {}
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




// BOOTSTRAP FIX
window.addEventListener('DOMContentLoaded', ()=>{ try{ if (typeof init==='function') init(); }catch(e){ console.error('init error', e);} });


// --- Save Profile Flow (single button) ---
async function saveProfileFlow() {
  clearError();
  try {
    const payload = {
      displayName: String(profileDisplayNameEl && profileDisplayNameEl.value || "").trim(),
      age: Number(profileAgeEl && profileAgeEl.value || 0) || null,
      city: String(profileCityEl && profileCityEl.value || "").trim(),
      interests: parseInterests(profileInterestsEl ? profileInterestsEl.value : ""),
      bio: profileBioEl ? String(profileBioEl.value || "") : ""
    };
    // keep existing location fields if present
    if (profileLatEl && profileLngEl) {
      const lat = Number(profileLatEl.value);
      const lng = Number(profileLngEl.value);
      if (Number.isFinite(lat) && Number.isFinite(lng)) payload.location = { lat, lng };
    }
    if (profileZipEl) payload.zip = String(profileZipEl.value || "").trim();

    setProfileStatus("Saving…");
    await updateProfile(payload);
    setProfileStatus("Saved ✅");

    // If staged photos exist, save them too (append mode)
    if (Array.isArray(selectedPhotos) && selectedPhotos.length > 0) {
      if (btnSavePhotos) {
        // call the same click handler by dispatching click
        btnSavePhotos.click();
      }
    } else {
      await hydrateProfileFromServer();
    }
    try { showToast("Profile saved ✅"); } catch (e) {}
  } catch (e) {
    setProfileStatus("");
    showError(`Save failed: ${e.message}`);
  }
}
if (btnSaveProfileLiveEl) {
  btnSaveProfileLiveEl.addEventListener("click", async () => {
    await saveProfileFlow();
  });
}



function renderSavedPhotos(photos, profile){
  try{
    const list = Array.isArray(photos) ? photos.map(normalizePhotoUrl).filter(Boolean) : [];
    if (!photoPreviewEl) return;
    photoPreviewEl.innerHTML = "";
    if (list.length === 0) return;

    const currentPrimary = profile ? normalizePhotoUrl(profile.primaryPhoto) : "";

    list.slice(0,6).forEach((url, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "photoThumb";
      wrap.style.position = "relative";
      wrap.style.borderRadius = "14px";
      wrap.style.overflow = "hidden";

      const img = document.createElement("img");
      img.src = String(url);
      img.alt = `Photo ${idx+1}`;
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "110px";
      img.style.objectFit = "cover";
      img.style.display = "block";

      // Selection for delete (click tile)
      wrap.addEventListener("click", () => {
        try{
          const key = String(url);
          if (savedPhotoSelection && savedPhotoSelection.has(key)) savedPhotoSelection.delete(key);
          else if (savedPhotoSelection) savedPhotoSelection.add(key);
          img.style.border = (savedPhotoSelection && savedPhotoSelection.has(key)) ? "2px solid #fff" : "1px solid var(--border)";
          setPhotoStatus(`${savedPhotoSelection ? savedPhotoSelection.size : 0} selected to delete.`);
        }catch(e){}
      });

      // ★ Set as profile photo
      const star = document.createElement("button");
      star.type = "button";
      star.className = "photoStarBtn";
      star.textContent = "★";
      star.setAttribute("aria-label", "Set as profile photo");
      star.setAttribute("aria-pressed", (currentPrimary && currentPrimary === normalizePhotoUrl(url)) ? "true" : "false");
      star.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try{
          const idToken = storage.idToken || localStorage.getItem("ff_idToken") || "";
          if (!idToken) return;
          const resp = await fetch(`${BACKEND_BASE_URL}/api/profile/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
            body: JSON.stringify({ primaryPhoto: String(url) })
          });
          const data = await resp.json().catch(()=>null);
          if (!resp.ok || !data || data.ok !== true) return;
          // Update local hero
          try{ setProfileHeroFromProfile((data.profile) || profile || {}); }catch(e){}
          // Re-hydrate to reflect persisted primary
          try{ await hydrateProfileFromServer(); }catch(e){}
        }catch(e){}
      });

      wrap.appendChild(img);
      wrap.appendChild(star);
      photoPreviewEl.appendChild(wrap);
    });
  }catch(e){}
}







// -------- Profile UI helpers (OTP-safe) --------
function ff_norm(p){
  try{
    if (!p) return "";
    if (typeof p === "string") return p.trim();
    if (typeof p === "object" && typeof p.url === "string") return p.url.trim();
    return String(p).trim();
  }catch(e){ return ""; }
}

function ff_findProfileHost(){
  // Prefer the container that already contains the photo tiles
  const tiles = document.getElementById("photoPreview");
  if (tiles && tiles.parentElement) return tiles.parentElement;
  // Fallbacks
  return document.querySelector('[data-panel="profile"]') ||
         document.getElementById("profileView") ||
         document.getElementById("viewProfile") ||
         document.getElementById("profile") ||
         document.body;
}

function ff_ensureHero(){
  const host = ff_findProfileHost();
  if (!host) return;
  let hero = document.getElementById("profileHero");
  if (hero) return;

  hero = document.createElement("div");
  hero.id = "profileHero";
  hero.style.position = "relative";
  hero.style.width = "100%";
  hero.style.aspectRatio = "4 / 5";
  hero.style.borderRadius = "18px";
  hero.style.overflow = "hidden";
  hero.style.margin = "12px 0 14px 0";
  hero.style.border = "1px solid rgba(255,255,255,0.12)";
  hero.style.background = "rgba(0,0,0,0.18)";

  const img = document.createElement("img");
  img.id = "profileHeroImg";
  img.alt = "Profile photo";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.display = "none";

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.padding = "14px 14px 12px 14px";
  overlay.style.background = "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))";

  const nameAge = document.createElement("div");
  nameAge.id = "profileHeroNameAge";
  nameAge.style.fontSize = "20px";
  nameAge.style.fontWeight = "800";
  nameAge.style.color = "#fff";
  nameAge.style.textShadow = "0 2px 10px rgba(0,0,0,0.6)";

  overlay.appendChild(nameAge);
  hero.appendChild(img);
  hero.appendChild(overlay);

  // Insert hero ABOVE the tiles grid if it exists
  const tiles = document.getElementById("photoPreview");
  if (tiles && tiles.parentElement){
    tiles.parentElement.insertBefore(hero, tiles);
  } else {
    host.insertBefore(hero, host.firstChild);
  }
}

function ff_setHero(profile){
  try{
    ff_ensureHero();
    const heroImg = document.getElementById("profileHeroImg");
    const heroNameAge = document.getElementById("profileHeroNameAge");

    const photos = Array.isArray(profile && profile.photos) ? profile.photos.map(ff_norm).filter(Boolean) : [];
    const primary = ff_norm(profile && profile.primaryPhoto) || (photos.length ? photos[0] : "");

    if (heroImg){
      heroImg.src = primary || "";
      heroImg.style.display = primary ? "block" : "none";
    }

    const name = ((profile && (profile.displayName || profile.name)) || "").trim();
    const ageNum = (profile && profile.age !== undefined && profile.age !== null) ? Number(profile.age) : null;
    const label = (name ? name : "Your Profile") + ((ageNum && !Number.isNaN(ageNum)) ? `, ${ageNum}` : "");
    if (heroNameAge) heroNameAge.textContent = label;
  }catch(e){}
}

async function ff_setPrimaryPhoto(url){
  const idToken = (typeof storage !== "undefined" && storage && storage.idToken) || localStorage.getItem("ff_idToken") || "";
  if (!idToken) return;
  const resp = await fetch(`${BACKEND_BASE_URL}/api/profile/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ primaryPhoto: String(url) })
  });
  const data = await resp.json().catch(()=>null);
  if (resp.ok && data && data.ok === true){
    if (data.profile) ff_setHero(data.profile);
  }
}

function ff_renderTiles(profile){
  const tiles = document.getElementById("photoPreview");
  if (!tiles) return;

  const photos = Array.isArray(profile && profile.photos) ? profile.photos.map(ff_norm).filter(Boolean) : [];
  tiles.innerHTML = "";
  
photos.slice(0,6).forEach((url, idx) => {
  const wrap = document.createElement("div");
  wrap.className = "photoThumb";
  wrap.style.position = "relative";
  wrap.style.width = "100%";
  wrap.style.borderRadius = "14px";
  wrap.style.overflow = "hidden";
  wrap.dataset.url = String(url);

  if (!window.__ff_selectedPhotos) window.__ff_selectedPhotos = new Set();

  const syncSelectedUI = () => {
    const isSel = window.__ff_selectedPhotos.has(String(url));
    if (isSel) wrap.classList.add("selected");
    else wrap.classList.remove("selected");
    const lbl = document.getElementById("selectedCount") || document.getElementById("selectedToDeleteLabel");
    if (lbl){
      const n = window.__ff_selectedPhotos.size;
      lbl.textContent = n ? `${n} selected to delete` : "";
    }
  };

  wrap.addEventListener("click", (ev) => {
    try{
      if (ev && ev.target && ev.target.closest && ev.target.closest("button")) return;
    }catch(e){}
    const key = String(url);
    const wasSelected = window.__ff_selectedPhotos.has(key);
    if (wasSelected) window.__ff_selectedPhotos.delete(key);
    else window.__ff_selectedPhotos.add(key);

    // keep legacy delete-selection set in sync (used by existing Delete button logic)
    try{
      if (typeof savedPhotoSelection !== "undefined" && savedPhotoSelection && typeof savedPhotoSelection.add === "function"){
        if (wasSelected) savedPhotoSelection.delete(key);
        else savedPhotoSelection.add(key);
      }
    }catch(e){}

    syncSelectedUI();
  });

  const img = document.createElement("img");
  img.src = String(url);
  img.alt = `Photo ${idx+1}`;
  img.loading = "lazy";
  img.style.width = "100%";
  img.style.height = "110px";
  img.style.objectFit = "cover";
  img.style.display = "block";

  const star = document.createElement("button");
  star.type = "button";
  star.textContent = "★";
  star.setAttribute("aria-label", "Set as profile photo");
  star.style.position = "absolute";
  star.style.top = "8px";
  star.style.right = "8px";
  star.style.zIndex = "9999";
  star.style.border = "1px solid rgba(255,255,255,0.35)";
  star.style.background = "rgba(0,0,0,0.45)";
  star.style.color = "#fff";
  star.style.borderRadius = "999px";
  star.style.padding = "6px 8px";
  star.style.fontSize = "14px";
  star.style.lineHeight = "14px";
  star.style.cursor = "pointer";

  star.addEventListener("click", async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    try{
      await ff_setPrimaryPhoto(url);
    }catch(e){}
  });

  wrap.appendChild(img);
  wrap.appendChild(star);
  tiles.appendChild(wrap);
  syncSelectedUI();
});

  // Default hero
  ff_setHero(profile || {});
}

// Hook: intercept /api/profile/me JSON regardless of your internal hydrate function name
(function ff_hookProfileMe(){
  if (window.__ff_profile_hooked) return;
  window.__ff_profile_hooked = true;

  const origFetch = window.fetch;
  window.fetch = async function(input, init){
    const res = await origFetch(input, init);
    try{
      const url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
      if (url && url.includes("/api/profile/me")){
        const clone = res.clone();
        clone.json().then((data) => {
          const profile = (data && (data.profile || (data.user && data.user.profile) || data.me || data.data && data.data.profile)) || (data && data.profile) || null;
          if (profile){
            // tiles element exists in your HTML already; render + hero
            ff_renderTiles(profile);
          }
        }).catch(()=>{});
      }
    }catch(e){}
    return res;
  };
})();

// -------- End Profile UI helpers --------



(function ff_selectedStylesOnce(){
  if (document.getElementById("ffSelectedStyles")) return;
  const st = document.createElement("style");
  st.id = "ffSelectedStyles";
  st.textContent = `
    #photoPreview .photoThumb.selected{ outline: 3px solid rgba(255,255,255,0.75); outline-offset: -3px; }
    #photoPreview .photoThumb.selected::after{
      content: "✓";
      position: absolute;
      left: 8px;
      top: 8px;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 12px;
      color: #111;
      background: rgba(255,255,255,0.9);
    }
  `;
  document.head.appendChild(st);
})();


/* === FF: Tinder-style swipe on Discover (UI-only; does NOT touch OTP) === */
(function ff_enableDiscoverSwipe(){
  if (window.__ffDiscoverSwipeInit) return;
  window.__ffDiscoverSwipeInit = true;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function findDiscoverCard(){
    const root =
      document.getElementById("discoverView") ||
      document.getElementById("discoverSection") ||
      document.querySelector("[data-view='discover']") ||
      document.querySelector(".discoverView") ||
      document.body;

    // Prefer an explicit card wrapper if present
    const card =
      root.querySelector("#ffDiscoverCard") ||
      root.querySelector(".ff-discover-card") ||
      root.querySelector(".discoverCard") ||
      root.querySelector(".card") ||
      null;

    // If no wrapper, try to infer from the first profile image in discover
    const img =
      root.querySelector("img[data-discover-photo]") ||
      root.querySelector("#discoverImg") ||
      root.querySelector("#discoverImage") ||
      root.querySelector(".discoverPhoto img") ||
      root.querySelector(".discoverCard img") ||
      root.querySelector(".card img") ||
      null;

    if (card) return card;
    if (img) return img.closest(".discoverCard") || img.closest(".card") || img.parentElement;
    return null;
  }

  function findLikePassButtons(){
    const root =
      document.getElementById("discoverView") ||
      document.getElementById("discoverSection") ||
      document.querySelector("[data-view='discover']") ||
      document.querySelector(".discoverView") ||
      document.body;

    const like =
      root.querySelector("#likeBtn") ||
      root.querySelector("button[data-action='like']") ||
      root.querySelector("button.ff-like") ||
      null;

    const pass =
      root.querySelector("#passBtn") ||
      root.querySelector("button[data-action='pass']") ||
      root.querySelector("button.ff-pass") ||
      null;

    return { like, pass };
  }


  function ff_getExpandSheet(){
    return document.getElementById("expandSheet") || document.getElementById("profileSheet") || null;
  }

  function triggerExpand(){
    try{
      const sheet = ff_getExpandSheet();
      if (sheet){
        sheet.style.display = "block";
        sheet.classList.add("open");
        return;
      }
      const root =
        document.getElementById("discoverView") ||
        document.getElementById("discoverSection") ||
        document.querySelector("[data-view='discover']") ||
        document.querySelector(".discoverView") ||
        document.body;

      const btn =
        root.querySelector("#expandBtn") ||
        root.querySelector("button[data-action='expand']") ||
        root.querySelector("button.ff-expand") ||
        null;
      if (btn) btn.click();
    }catch(e){}
  }

  function triggerCollapse(){
    try{
      const sheet = ff_getExpandSheet();
      if (sheet){
        sheet.classList.remove("open");
        sheet.style.display = "none";
        return;
      }
      const btn =
        document.getElementById("sheetClose") ||
        document.querySelector("#expandSheet .close") ||
        document.querySelector("button[data-action='collapse']") ||
        null;
      if (btn) btn.click();
    }catch(e){}
  }



  function applyCardChrome(card){
    try{
      card.id = card.id || "ffDiscoverCard";
      card.classList.add("ff-discover-card");
      card.style.touchAction = "pan-y";
      card.style.userSelect = "none";
      card.style.willChange = "transform";
      card.style.transform = "translate3d(0,0,0)";
    }catch(e){}
  }

  function bindSwipe(card){
    if (!card || card.__ffSwipeBound) return;
    card.__ffSwipeBound = true;

    applyCardChrome(card);

    let startX = 0, startY = 0, curX = 0, curY = 0, dragging = false, pointerId = null, vIntent = null;

    const reset = (animate=true) => {
      dragging = false;
      pointerId = null;
      vIntent = null;
      try{ card.style.touchAction = "pan-y"; }catch(e){}
      card.style.transition = animate ? "transform 180ms ease" : "none";
      card.style.transform = "translate3d(0,0,0) rotate(0deg)";
      setTimeout(()=>{ try{ card.style.transition = "none";
      vIntent = null;
      try{ card.style.touchAction = "none"; }catch(e){} }catch(e){} }, 200);
    };

    const flyOut = (dir) => {
      const w = Math.max(320, window.innerWidth || 320);
      const x = dir === "right" ? w : -w;
      const r = dir === "right" ? 12 : -12;
      card.style.transition = "transform 220ms ease";
      card.style.transform = `translate3d(${x}px, 0, 0) rotate(${r}deg)`;
      setTimeout(()=>{ reset(false); }, 260);
    };

    const trigger = (dir) => {
      const { like, pass } = findLikePassButtons();
      if (dir === "right"){
        if (like) like.click();
      } else {
        if (pass) pass.click();
      }
    };

    const onDown = (ev) => {
      // only left mouse / touch / pen
      if (ev.button !== undefined && ev.button !== 0) return;
      dragging = true;
      pointerId = ev.pointerId || null;
      startX = ev.clientX || 0;
      startY = ev.clientY || 0;
      curX = 0;
      curY = 0;
      try{ card.setPointerCapture && pointerId!=null && card.setPointerCapture(pointerId); }catch(e){}
      card.style.transition = "none";
    };

    const onMove = (ev) => {
      if (!dragging) return;
      if (pointerId!=null && ev.pointerId!=null && ev.pointerId !== pointerId) return;

      const dx = (ev.clientX || 0) - startX;
      const dy = (ev.clientY || 0) - startY;

      // If mostly vertical, treat as expand/collapse gesture on desktop drag
      // (mobile touch already handled in attachSwipeHandlers)
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 18){
        curX = dx;
        curY = dy;
        card.style.transform = `translate3d(${dx*0.15}px, ${dy}px, 0)`;
        return;
      }
curX = dx;
      curY = dy;
      // intent detection
      const upTh = Math.min(140, Math.max(70, (window.innerHeight||640)*0.18));
      if (dy < -upTh) vIntent = "up";
      else if (dy > upTh) vIntent = "down";
      else vIntent = null;
      const rot = clamp(dx / 22, -12, 12);
      card.style.transform = `translate3d(${dx}px, ${dy*0.15}px, 0) rotate(${rot}deg)`;
    };

    const onUp = () => {
      if (!dragging) return;
      const dx = curX || 0;
      const dy = curY || 0;

      const upTh = Math.min(140, Math.max(70, (window.innerHeight||640)*0.18));

      // Vertical swipe gestures
      if (vIntent === "up" && dy < -upTh){
        reset(false);
        triggerExpand();
        return;
      }
      if (vIntent === "down" && dy > upTh){
        reset(false);
        triggerCollapse();
        return;
      }

      // Horizontal like/pass
      const threshold = Math.min(120, Math.max(70, (window.innerWidth||360)*0.22));
      if (dx > threshold){
        flyOut("right");
        trigger("right");
      } else if (dx < -threshold){
        flyOut("left");
        trigger("left");
      } else {
        reset(true);
      }
    };

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);

    // Desktop helpers: click left/right halves to pass/like
    card.addEventListener("click", (ev) => {
      // ignore click if it was a drag
      if (Math.abs(curX) > 8) return;
      const rect = card.getBoundingClientRect();
      const x = (ev.clientX || 0) - rect.left;
      if (x < rect.width * 0.5) {
        const { pass } = findLikePassButtons();
        if (pass) pass.click();
      } else {
        const { like } = findLikePassButtons();
        if (like) like.click();
      }
    });

    // Keyboard: left/right
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft"){
        const { pass } = findLikePassButtons();
        if (pass) pass.click();
      } else if (ev.key === "ArrowRight"){
        const { like } = findLikePassButtons();
        if (like) like.click();
      }
    });
  }

  function tick(){
    try{
      const card = findDiscoverCard();
      if (card) bindSwipe(card);
    }catch(e){}
  }

  // keep trying: discover card is re-rendered after like/pass
  tick();
  setInterval(tick, 800);
})();



/* === FF: global keys for expand/collapse on PC (OTP-safe) === */
(function ffGlobalKeysDiscover(){
  if (window.__ffGlobalKeysDiscover) return;
  window.__ffGlobalKeysDiscover = true;
  window.addEventListener("keydown", (e) => {
    try{
      if (e.key === "ArrowUp"){ e.preventDefault(); if (typeof expandCurrent === "function") expandCurrent(); }
      if (e.key === "Escape"){ e.preventDefault(); if (typeof collapseSheet === "function") collapseSheet(); }
    }catch(_){}
  });
})();
