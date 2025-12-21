/* Minimal web client for FrugalFetishes backend
 * - No frameworks
 * - Stores idToken in localStorage
 * - Implements: auth/start, auth/verify, token exchange, feed, credits/balance
 */

// ====== CONFIG ======
const BACKEND_BASE_URL = "https://express-js-on-vercel-rosy-one.vercel.app";
const FIREBASE_WEB_API_KEY = "AIzaSyBcMM5dAFqbQXcN0ltT4Py6SeA5Fzg-nD8";

// ====== DOM ======
const $ = (id) => document.getElementById(id);

const emailEl = $("email");
const otpEl = $("otp");
const btnStart = $("btnStart");
const btnVerify = $("btnVerify");
const btnLoadFeed = $("btnLoadFeed");
const btnCredits = $("btnCredits");
const btnLogout = $("btnLogout");

const profileDisplayNameEl = $("profileDisplayName");
const profileAgeEl = $("profileAge");
const profileCityEl = $("profileCity");
const profileInterestsEl = $("profileInterests");
const profileLatEl = $("profileLat");
const profileLngEl = $("profileLng");
const btnSaveProfile = $("btnSaveProfile");
const btnSetMiami = $("btnSetMiami");
const btnSetOrlando = $("btnSetOrlando");
const profileStatusEl = $("profileStatus");

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

let lastCodeId = null;
let allFeedItems = [];
let selectedMatchId = null;
let selectedOtherUid = null;

// ====== Storage ======
const storage = {
  get idToken() { return localStorage.getItem("ff_idToken"); },
  set idToken(v) {
    if (v) localStorage.setItem("ff_idToken", v);
    else localStorage.removeItem("ff_idToken");
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

function setStatus(el, message) {
  el.textContent = message || "";
}

function setAuthedUI() {
  if (storage.idToken) {
    setStatus(authStatusEl, "Signed in ✅");
  } else {
    setStatus(authStatusEl, "Signed out");
  }
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : text;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

async function startAuth(email) {
  return jsonFetch(`${BACKEND_BASE_URL}/api/auth/start`, {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

async function verifyAuth(email, codeId, otp) {
  return jsonFetch(`${BACKEND_BASE_URL}/api/auth/verify`, {
    method: "POST",
    body: JSON.stringify({ email, codeId, otp })
  });
}

async function exchangeCustomTokenForIdToken(customToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;
  return jsonFetch(url, {
    method: "POST",
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
}

async function getCredits() {
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  return jsonFetch(`${BACKEND_BASE_URL}/api/credits/balance`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}

async function getFeed() {
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  return jsonFetch(`${BACKEND_BASE_URL}/api/feed`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}


async function postLike(targetUid) {
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  return jsonFetch(`${BACKEND_BASE_URL}/api/like`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ targetUid })
  });
}


async function updateProfile(fields) {
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  return jsonFetch(`${BACKEND_BASE_URL}/api/profile/update`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify(fields)
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
const draftKey = "ff_profileDraft_v1";
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(draftKey) || "{}"); } catch { return {}; }
}
function saveDraft(d) {
  try { localStorage.setItem(draftKey, JSON.stringify(d || {})); } catch {}
}
function captureDraft() {
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
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  return jsonFetch(`${BACKEND_BASE_URL}/api/matches`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}


async function getThread(matchId, limit = 50) {
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  if (!matchId) throw new Error("No match selected.");
  const qs = new URLSearchParams({ matchId, limit: String(limit) }).toString();
  return jsonFetch(`${BACKEND_BASE_URL}/api/messages/thread?${qs}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${idToken}` }
  });
}

async function sendMessage(matchId, text) {
  const idToken = storage.idToken;
  if (!idToken) throw new Error("Not signed in (missing idToken).");
  if (!matchId) throw new Error("No match selected.");
  if (!text || !text.trim()) throw new Error("Message text is empty.");
  return jsonFetch(`${BACKEND_BASE_URL}/api/messages/send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ matchId, text: text.trim() })
  });
}

function normalizeThreadResponse(r) {
  if (!r) return [];
  if (Array.isArray(r.items)) return r.items;
  if (Array.isArray(r.messages)) return r.messages;
  if (Array.isArray(r.data)) return r.data;
  if (Array.isArray(r)) return r;
  return [];
}

function renderThread(messages) {
  if (!threadListEl) return;
  threadListEl.innerHTML = "";
  if (!messages || messages.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No messages yet.";
    threadListEl.appendChild(li);
    return;
  }

  for (const msg of messages) {
    const li = document.createElement("li");

    const title = document.createElement("div");
    title.className = "profileTitle";
    const from = msg.fromUid || msg.from || msg.senderUid || "(unknown)";
    title.textContent = `From: ${from}`;
    li.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "row";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open Chat";
    openBtn.addEventListener("click", () => {
      selectedMatchId = String(matchId);
      selectedOtherUid = otherUid ? String(otherUid) : null;
      if (threadMetaEl) setStatus(threadMetaEl, selectedOtherUid ? `Selected: ${selectedOtherUid} (matchId: ${selectedMatchId})` : `Selected matchId: ${selectedMatchId}`);
      if (threadStatusEl) setStatus(threadStatusEl, "Click 'Load Thread' to view messages.");
      if (threadListEl) threadListEl.innerHTML = "";
      if (messageTextEl) messageTextEl.focus();
    });

    actions.appendChild(openBtn);
    li.appendChild(actions);

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

    add("Text", msg.text || "");
    if (msg.createdAt) add("createdAt", JSON.stringify(msg.createdAt));

    li.appendChild(kv);
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

function renderMatches(items) {
  if (!matchesListEl) return;
  matchesListEl.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No matches yet.";
    matchesListEl.appendChild(li);
    return;
  }

  for (const m of items) {
    const li = document.createElement("li");

    const title = document.createElement("div");
    title.className = "profileTitle";
    const matchId = m.matchId || m.id || m._id || "(no matchId)";
    const otherUid = m.otherUid || m.otherUserUid || m.other || m.withUid || "";
    title.textContent = otherUid ? `Match with ${otherUid}` : `Match ${matchId}`;
    li.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "row";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open Chat";
    openBtn.addEventListener("click", () => {
      selectedMatchId = String(matchId);
      selectedOtherUid = otherUid ? String(otherUid) : null;
      if (threadMetaEl) setStatus(threadMetaEl, selectedOtherUid ? `Selected: ${selectedOtherUid} (matchId: ${selectedMatchId})` : `Selected matchId: ${selectedMatchId}`);
      if (threadStatusEl) setStatus(threadStatusEl, "Click 'Load Thread' to view messages.");
      if (threadListEl) threadListEl.innerHTML = "";
      if (messageTextEl) messageTextEl.focus();
    });

    actions.appendChild(openBtn);
    li.appendChild(actions);

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

    add("matchId", String(matchId));
    if (otherUid) add("otherUid", String(otherUid));

    // Try to show participants if present
    const participants = m.participants || m.uids || m.users;
    if (participants) add("participants", JSON.stringify(participants));

    // Created time if present
    if (m.createdAt) add("createdAt", JSON.stringify(m.createdAt));

    li.appendChild(kv);
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
    title.textContent = `${p.uid} — ${p.age ?? "?"} — ${p.city ?? ""}`;
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
  const email = (emailEl.value || "").trim();
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
    if (!v || !v.token) throw new Error("Verify response missing token.");

    setStatus(authStatusEl, "Exchanging token...");
    const ex = await exchangeCustomTokenForIdToken(v.token);
    if (!ex || !ex.idToken) throw new Error("Token exchange missing idToken.");

    storage.idToken = ex.idToken;
    setAuthedUI();
    setStatus(feedStatusEl, "Signed in. You can load the feed now.");
  } catch (e) {
    storage.idToken = null;
    setAuthedUI();
    showError(`Verify/sign-in failed: ${e.message}`);
  } finally {
    btnVerify.disabled = false;
  }
});

btnLoadFeed.addEventListener("click", async () => {
  clearError();
  setStatus(feedStatusEl, "");
  btnLoadFeed.disabled = true;
  try {
    setStatus(feedStatusEl, "Loading feed...");
    const r = await getFeed();
    allFeedItems = r.items || [];
    populateFiltersFromItems(allFeedItems);
    applyFiltersAndRender();
    setStatus(feedStatusEl, `Loaded ${Array.isArray(r.items) ? r.items.length : 0} profiles ✅`);
  } catch (e) {
    showError(`Feed failed: ${e.message}`);
    setStatus(feedStatusEl, "");
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
      renderMatches(items);
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
});

(function init() {
  if (!emailEl.value) emailEl.value = "test@example.com";

  // Profile editor: restore draft inputs (safe if section isn't present)
  const d = loadDraft();
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

  if (btnSaveProfile) btnSaveProfile.addEventListener("click", async () => {
    clearError();
    btnSaveProfile.disabled = true;
    try {
      const payload = {};
      const dn = profileDisplayNameEl ? profileDisplayNameEl.value.trim() : "";
      const city = profileCityEl ? profileCityEl.value.trim() : "";
      const ageRaw = profileAgeEl ? profileAgeEl.value : "";
      const interestsRaw = profileInterestsEl ? profileInterestsEl.value : "";
      const latRaw = profileLatEl ? profileLatEl.value : "";
      const lngRaw = profileLngEl ? profileLngEl.value : "";

      if (dn) payload.displayName = dn;
      if (city) payload.city = city;

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
  if (storage.idToken) setStatus(feedStatusEl, "Signed in from previous session. Click 'Load Feed'.");
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


})();
