// FrugalFetishes frontend with Likes + Filters

const BACKEND_BASE_URL = "https://express-js-on-vercel-rosy-one.vercel.app";
const FIREBASE_WEB_API_KEY = "AIzaSyBcMM5dAFqbQXcN0ltT4Py6SeA5Fzg-nD8";

const $ = (id) => document.getElementById(id);

const emailEl = $("email");
const otpEl = $("otp");
const btnStart = $("btnStart");
const btnVerify = $("btnVerify");
const btnLoadFeed = $("btnLoadFeed");
const btnCredits = $("btnCredits");
const btnLogout = $("btnLogout");

const filterCityEl = $("filterCity");
const filterInterestEl = $("filterInterest");
const btnApplyFilters = $("btnApplyFilters");
const btnClearFilters = $("btnClearFilters");

const startResultEl = $("startResult");
const authStatusEl = $("authStatus");
const feedStatusEl = $("feedStatus");
const feedListEl = $("feedList");
const errorBoxEl = $("errorBox");

let lastCodeId = null;
let allFeedItems = [];

const storage = {
  get idToken() { return localStorage.getItem("ff_idToken"); },
  set idToken(v) {
    if (v) localStorage.setItem("ff_idToken", v);
    else localStorage.removeItem("ff_idToken");
  }
};

function showError(msg) {
  errorBoxEl.hidden = false;
  errorBoxEl.textContent = msg;
}

function clearError() {
  errorBoxEl.hidden = true;
  errorBoxEl.textContent = "";
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
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

async function exchangeToken(token) {
  return jsonFetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    { method: "POST", body: JSON.stringify({ token, returnSecureToken: true }) }
  );
}

async function getFeed() {
  return jsonFetch(`${BACKEND_BASE_URL}/api/feed`, {
    headers: { Authorization: `Bearer ${storage.idToken}` }
  });
}

async function postLike(uid) {
  return jsonFetch(`${BACKEND_BASE_URL}/api/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${storage.idToken}` },
    body: JSON.stringify({ targetUid: uid })
  });
}

function renderFeed(items) {
  feedListEl.innerHTML = "";
  items.forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.uid}</strong> — ${p.age}, ${p.city}`;

    const btn = document.createElement("button");
    btn.textContent = "Like";
    btn.onclick = async () => {
      try {
        await postLike(p.uid);
        btn.textContent = "Liked ✓";
        btn.disabled = true;
      } catch (e) {
        showError(e.message);
      }
    };

    li.appendChild(document.createElement("br"));
    li.appendChild(btn);
    feedListEl.appendChild(li);
  });
}

function populateFilters(items) {
  const cities = [...new Set(items.map(i => i.city).filter(Boolean))];
  const interests = [...new Set(items.flatMap(i => i.interests || []))];

  filterCityEl.innerHTML = '<option value="">All</option>' + cities.map(c => `<option>${c}</option>`).join("");
  filterInterestEl.innerHTML = '<option value="">All</option>' + interests.map(i => `<option>${i}</option>`).join("");
}

function applyFilters() {
  let items = [...allFeedItems];
  if (filterCityEl.value) items = items.filter(i => i.city === filterCityEl.value);
  if (filterInterestEl.value) items = items.filter(i => (i.interests || []).includes(filterInterestEl.value));
  renderFeed(items);
}

btnApplyFilters.onclick = applyFilters;
btnClearFilters.onclick = () => {
  filterCityEl.value = "";
  filterInterestEl.value = "";
  renderFeed(allFeedItems);
};

btnLoadFeed.onclick = async () => {
  try {
    const r = await getFeed();
    allFeedItems = r.items || [];
    populateFilters(allFeedItems);
    renderFeed(allFeedItems);
  } catch (e) {
    showError(e.message);
  }
};

btnStart.onclick = async () => {
  const r = await startAuth(emailEl.value);
  lastCodeId = r.codeId;
  startResultEl.textContent = r.devOtp ? `devOtp: ${r.devOtp}` : "OTP sent";
};

btnVerify.onclick = async () => {
  try {
    const v = await verifyAuth(emailEl.value, lastCodeId, otpEl.value);
    const ex = await exchangeToken(v.token);
    storage.idToken = ex.idToken;
    authStatusEl.textContent = "Signed in ✓";
  } catch (e) {
    showError(e.message);
  }
};

btnLogout.onclick = () => {
  storage.idToken = null;
  authStatusEl.textContent = "Signed out";
  feedListEl.innerHTML = "";
};
