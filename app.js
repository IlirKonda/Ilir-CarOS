import { spotifyLogin, getAccessToken } from "./spotify-auth.js";
import { getPlayer, play, pause, nextTrack, prevTrack } from "./spotify.js";

// ===== Theme (deine Winter/Sommer Regeln) =====
const THEME_LS_KEY = "theme_mode"; // "auto" | "day" | "night"

function isWinterSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  return (m === 11 || m === 12 || m === 1 || m === 2);
}
function computeAutoTheme(now = new Date()) {
  const h = now.getHours();
  const winter = isWinterSeason(now);
  if (winter) return (h >= 16 || h < 8) ? "night" : "day";
  return (h >= 20 || h < 7) ? "night" : "day";
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
function refreshTheme() {
  const mode = localStorage.getItem(THEME_LS_KEY) || "auto";
  const theme = mode === "auto" ? computeAutoTheme() : mode;
  applyTheme(theme);
}
refreshTheme();
setInterval(refreshTheme, 5 * 60 * 1000);

// Theme toggle button (optional)
const themeBtn = document.getElementById("themeToggle");
function labelMode(mode){ return mode === "auto" ? "Auto" : (mode === "day" ? "Day" : "Night"); }
function updateThemeButton(){
  if(!themeBtn) return;
  const mode = localStorage.getItem(THEME_LS_KEY) || "auto";
  themeBtn.textContent = `Theme: ${labelMode(mode)}`;
}
function setThemeMode(mode){
  localStorage.setItem(THEME_LS_KEY, mode);
  refreshTheme();
  updateThemeButton();
}
updateThemeButton();
themeBtn?.addEventListener("click", () => {
  const mode = localStorage.getItem(THEME_LS_KEY) || "auto";
  const next = mode === "auto" ? "day" : mode === "day" ? "night" : "auto";
  setThemeMode(next);
});

// ===== View switching (Sidebar) =====
const tabs = [
  document.getElementById("tabNav"),
  document.getElementById("tabSpotify"),
  document.getElementById("tabSetup"),
].filter(Boolean);

const views = {
  nav: document.getElementById("viewNav"),
  spotify: document.getElementById("viewSpotify"),
  setup: document.getElementById("viewSetup"),
};

function showView(name){
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.style.display = (k === name) ? "flex" : "none";
  });
  tabs.forEach(t => t.classList.toggle("active", t.dataset.view === name));
  localStorage.setItem("active_view", name);
}

tabs.forEach(t => t.addEventListener("click", () => showView(t.dataset.view)));
showView(localStorage.getItem("active_view") || "nav");

// ===== Destination (shared) =====
const navSub = document.getElementById("navSub");
const destInput = document.getElementById("dest");
const mapFrame = document.getElementById("mapFrame");

function getDest(){
  return (localStorage.getItem("dest") || "").trim();
}

function setDest(value){
  localStorage.setItem("dest", (value || "").trim());
  renderDest();
}

function renderDest(){
  const dest = getDest();
  if (navSub) navSub.textContent = dest ? `Ziel: ${dest}` : "Ziel: (nicht gesetzt)";
  if (destInput) destInput.value = dest;

  // Map preview (web). Das ist nur Vorschau – Start öffnet echte Navigation.
  if (mapFrame) {
    if (!dest) {
      mapFrame.src = "about:blank";
    } else {
      // Simple embed: query location
      const q = encodeURIComponent(dest);
      mapFrame.src = `https://www.google.com/maps?q=${q}&output=embed`;
    }
  }
}
renderDest();

// Setup view buttons
document.getElementById("saveDest")?.addEventListener("click", () => {
  setDest(destInput?.value || "");
  showView("nav");
});

document.getElementById("testMaps")?.addEventListener("click", () => {
  openGoogleMapsNav();
});

// Start navigation button in nav view
document.getElementById("btnNavStart")?.addEventListener("click", () => {
  openGoogleMapsNav();
});

function openGoogleMapsNav() {
  const dest = getDest();

  // No destination: open maps
  if (!dest) {
    window.location.href = "comgooglemaps://";
    setTimeout(() => window.location.href = "https://maps.google.com", 250);
    return;
  }

  const scheme = `comgooglemaps://?daddr=${encodeURIComponent(dest)}&directionsmode=driving`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;

  window.location.href = scheme;
  setTimeout(() => window.location.href = web, 250);
}

// ===== Spotify wiring =====
const spStatus = document.getElementById("spStatus");
const spNow = document.getElementById("spNow");
const spDevice = document.getElementById("spDevice");

const btnSpotifyConnect = document.getElementById("btnSpotifyConnect");
const spOpenBtn = document.getElementById("spOpen");

const spPrevBtn = document.getElementById("spPrev");
const spPlayPauseBtn = document.getElementById("spPlayPause");
const spNextBtn = document.getElementById("spNext");

let isPlaying = false;

function openSpotifyApp() {
  window.location.href = "spotify://";
  setTimeout(() => window.location.href = "https://open.spotify.com", 250);
}
spOpenBtn?.addEventListener("click", openSpotifyApp);

btnSpotifyConnect?.addEventListener("click", async () => {
  try {
    await getAccessToken();
    spStatus && (spStatus.textContent = "Verbunden");
  } catch {
    spotifyLogin();
  }
});

spPrevBtn?.addEventListener("click", async () => { await prevTrack(); await refreshSpotify(); });
spNextBtn?.addEventListener("click", async () => { await nextTrack(); await refreshSpotify(); });
spPlayPauseBtn?.addEventListener("click", async () => {
  if (isPlaying) await pause();
  else await play();
  await refreshSpotify();
});

function formatTrack(item) {
  if (!item) return "—";
  const name = item.name || "—";
  const artists = (item.artists || []).map(a => a.name).filter(Boolean).join(", ");
  return artists ? `${name} — ${artists}` : name;
}

function handleSpotifyError(e) {
  const msg = String(e?.message || e);
  if (spStatus) spStatus.textContent = "Spotify: Fehler / nicht bereit";
  if (msg.toLowerCase().includes("no active device") || msg.includes("Player command failed")) {
    if (spStatus) spStatus.textContent = "Kein aktiver Player – Spotify öffnen & Musik starten.";
  }
}

async function refreshSpotify() {
  try {
    await getAccessToken();
  } catch {
    if (spStatus) spStatus.textContent = "Nicht verbunden";
    return;
  }

  try {
    const data = await getPlayer();
    if (!data) {
      if (spStatus) spStatus.textContent = "Kein aktiver Player – Spotify öffnen & Musik starten.";
      return;
    }

    const spCover = document.getElementById("spCover");
    const img = data.item?.album?.images?.[0]?.url;
    
    if (spCover) {
      if (img) {
        spCover.src = img;
        document.documentElement.style.setProperty("--sp-bg", `url("${img}")`);
      } else {
        spCover.removeAttribute("src");
        document.documentElement.style.setProperty("--sp-bg", "none");
      }
    }

    isPlaying = !!data.is_playing;
    if (spStatus) spStatus.textContent = "Verbunden";
    if (spNow) spNow.textContent = formatTrack(data.item);
    if (spDevice) spDevice.textContent = "Device: " + (data.device?.name || "—");
  } catch (e) {
    handleSpotifyError(e);
  }
}

setInterval(refreshSpotify, 3000);
refreshSpotify();

// ===== Rotation handling (optional helper) =====
// CSS macht das meiste; das hier sorgt nur dafür, dass iOS nach Rotation sauber neu-layoutet.
window.addEventListener("orientationchange", () => {
  // iOS Safari/PWA: kleine Pause, dann repaint
  setTimeout(() => {
    document.body.style.display = "none";
    // force reflow
    void document.body.offsetHeight;
    document.body.style.display = "";
  }, 120);
});

// ===== Service Worker =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}


