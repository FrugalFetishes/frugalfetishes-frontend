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

const startResultEl = $("startResult");
const authStatusEl = $("authStatus");
const feedStatusEl = $("feedStatus");
const feedListEl = $("feedList");
const errorBoxEl = $("errorBox");

let lastCodeId = null;

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
    renderFeed(r.items || []);
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

btnLogout.addEventListener("click", () => {
  storage.idToken = null;
  lastCodeId = null;
  setStatus(startResultEl, "");
  setStatus(feedStatusEl, "");
  renderFeed([]);
  clearError();
  setAuthedUI();
});

(function init() {
  if (!emailEl.value) emailEl.value = "test@example.com";
  setAuthedUI();
  if (storage.idToken) setStatus(feedStatusEl, "Signed in from previous session. Click 'Load Feed'.");
})();
