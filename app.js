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
    swipeTitleEl.textContent = "No more profiles";
    if (swipeSubEl) swipeSubEl.textContent = "Try again later.";
    swipePhotoEl.style.backgroundImage = "";
    return;
  }

  const age = (p.age !== undefined && p.age !== null) ? p.age : "?";
  const city = p.city || "";
  const uid = p.uid || "(unknown)";
  swipeTitleEl.textContent = currentProfile && currentProfile.displayName ? String(currentProfile.displayName) : "";
  if (swipeSubEl) swipeSubEl.textContent = `${age} • ${city}`.trim();

  const photo = firstPhotoUrl(p);
  if (photo) swipePhotoEl.style.backgroundImage = `url("${photo}")`;
  else swipePhotoEl.style.backgroundImage = "";
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
      expandCurrent();
      touchStart = null;
      return;
    }

    // Horizontal swipe pass/like
    if (absX > absY && absX > 60) {
      if (dx < 0) passCurrent();
      else likeCurrent();
    }

    touchStart = null;
  }, { passive: true });

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
      storage.loginEmail = email;
  
      ffRenderAuthBadge();return email;
}

function isValidEmail(email) {
  // simple, practical validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}




document.addEventListener('DOMContentLoaded', () => { ffEnsureAuthBadge(); });
