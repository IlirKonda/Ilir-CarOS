import { spotifyLogin, getAccessToken } from "./spotify-auth.js";
import { getPlayer, play, pause, nextTrack, prevTrack } from "./spotify.js";

// ===== Ilir CarOS Theme: Uhrzeit-only (Sommer/Winter) =====
const THEME_LS_KEY = "theme_mode"; // "auto" | "day" | "night"

// Winter: Nov–Feb  → Night 16–08
function isWinterSeason(date = new Date()) {
  const m = date.getMonth() + 1; // 1..12
  return (m === 11 || m === 12 || m === 1 || m === 2);
}

function computeAutoTheme(now = new Date()) {
  const h = now.getHours();
  const winter = isWinterSeason(now);

  // Winter: night from 16:00 to 07:59
  if (winter) return (h >= 16 || h < 8) ? "night" : "day";

  // Sommer: night from 20:00 to 06:59
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

const themeBtn = document.getElementById("themeToggle");

function labelMode(mode){
  return mode === "auto" ? "Auto" : (mode === "day" ? "Day" : "Night");
}

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

// ---------- Helpers ----------
const qs = (id) => document.getElementById(id);

// ---------- Settings (Google Maps Destination) ----------
const dlg = qs("dlg");
const destInput = qs("dest");
const navSub = qs("navSub");

function loadDest() {
  const dest = localStorage.getItem("dest") || "";
  destInput.value = dest;
  navSub.textContent = dest ? `Ziel: ${dest}` : "Ziel: (nicht gesetzt)";
}
function saveDest() {
  localStorage.setItem("dest", destInput.value.trim());
  loadDest();
}

function openGoogleMapsNav() {
  const dest = (localStorage.getItem("dest") || "").trim();

  // Wenn kein Ziel gesetzt: Google Maps öffnen (App → Web fallback)
  if (!dest) {
    window.location.href = "comgooglemaps://";
    setTimeout(() => window.location.href = "https://maps.google.com", 250);
    return;
  }

  // App Scheme + Web fallback
  const scheme = `comgooglemaps://?daddr=${encodeURIComponent(dest)}&directionsmode=driving`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;

  window.location.href = scheme;
  setTimeout(() => window.location.href = web, 250);
}

qs("btnNav").addEventListener("click", openGoogleMapsNav);
qs("btnSettings").addEventListener("click", () => { loadDest(); dlg.showModal(); });

qs("save").addEventListener("click", (e) => {
  e.preventDefault();
  saveDest();
  dlg.close();
});

loadDest();

// ---------- Spotify UI ----------
const btnSpotifyConnect = qs("btnSpotifyConnect");
const spStatus = qs("spStatus");
const spCard = qs("spCard");
const spNow = qs("spNow");
const spDevice = qs("spDevice");

const spPrevBtn = qs("spPrev");
const spPlayPauseBtn = qs("spPlayPause");
const spNextBtn = qs("spNext");
const spOpenBtn = qs("spOpen");

let isPlaying = false;

function openSpotifyApp() {
  window.location.href = "spotify://";
  setTimeout(() => window.location.href = "https://open.spotify.com", 250);
}

spOpenBtn.addEventListener("click", openSpotifyApp);

btnSpotifyConnect.addEventListener("click", async () => {
  try {
    await getAccessToken(); // already logged in?
    spStatus.textContent = "Verbunden";
  } catch {
    spotifyLogin();
  }
});

spPrevBtn.addEventListener("click", async () => {
  try {
    await prevTrack();
    await refreshSpotify();
  } catch (e) {
    handleSpotifyError(e);
  }
});

spNextBtn.addEventListener("click", async () => {
  try {
    await nextTrack();
    await refreshSpotify();
  } catch (e) {
    handleSpotifyError(e);
  }
});

spPlayPauseBtn.addEventListener("click", async () => {
  try {
    if (isPlaying) await pause();
    else await play();
    await refreshSpotify();
  } catch (e) {
    handleSpotifyError(e);
  }
});

function formatTrack(item) {
  if (!item) return "—";
  const name = item.name || "—";
  const artists = (item.artists || []).map(a => a.name).filter(Boolean).join(", ");
  return artists ? `${name} — ${artists}` : name;
}

function handleSpotifyError(e) {
  const msg = String(e?.message || e);
  // Common case: no active device
  if (msg.includes("NO_ACTIVE_DEVICE") || msg.includes("Player command failed")) {
    spStatus.textContent = "Kein aktives Spotify-Device – starte Spotify & spiele kurz Musik.";
    spCard.style.display = "none";
    return;
  }
  spStatus.textContent = "Spotify Fehler – ggf. neu verbinden.";
  spCard.style.display = "none";
}

async function refreshSpotify() {
  try {
    // if not logged in, this will throw
    await getAccessToken();
  } catch {
    spStatus.textContent = "Nicht verbunden";
    spCard.style.display = "none";
    return;
  }

  try {
    const data = await getPlayer(); // can throw if no player
    if (!data) {
      spStatus.textContent = "Kein aktiver Player – starte Spotify einmal manuell.";
      spCard.style.display = "none";
      return;
    }

    isPlaying = !!data.is_playing;
    spStatus.textContent = "Verbunden";
    spCard.style.display = "block";

    spNow.textContent = formatTrack(data.item);
    spDevice.textContent = "Device: " + (data.device?.name || "—");
  } catch (e) {
    handleSpotifyError(e);
  }
}

// Polling (nicht zu aggressiv)
setInterval(refreshSpotify, 3000);
refreshSpotify();

// ---------- Service Worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });

}


