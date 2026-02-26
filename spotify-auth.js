// ====== CONFIG (HIER ANPASSEN) ======
export const SPOTIFY_CLIENT_ID = "a5c8f595cbf54432975e26c4cb55762f";
export const REDIRECT_URI = "https://ilirkonda.github.io/Ilir-CarOS/callback.html";
// Beispiel: https://ilir123.github.io/car-dashboard/callback.html

// ====== SCOPES ======
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing"
].join(" ");

const LS = {
  verifier: "sp_pkce_verifier",
  access: "sp_access_token",
  refresh: "sp_refresh_token",
  expiry: "sp_token_expiry"
};

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

export async function spotifyLogin() {
  const verifier = randomString(64);
  localStorage.setItem(LS.verifier, verifier);

  const challenge = base64url(await sha256(verifier));

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("scope", SCOPES);

  window.location.href = authUrl.toString();
}

export async function handleSpotifyCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const err = params.get("error");

  if (err) throw new Error("Spotify auth error: " + err);
  if (!code) throw new Error("No code in callback");

  const verifier = localStorage.getItem(LS.verifier);
  if (!verifier) throw new Error("Missing PKCE verifier");

  const body = new URLSearchParams();
  body.set("client_id", SPOTIFY_CLIENT_ID);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", REDIRECT_URI);
  body.set("code_verifier", verifier);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) throw new Error("Token exchange failed: " + res.status);

  const data = await res.json();
  localStorage.setItem(LS.access, data.access_token);
  if (data.refresh_token) localStorage.setItem(LS.refresh, data.refresh_token);
  localStorage.setItem(LS.expiry, String(Date.now() + (data.expires_in * 1000) - 10_000));
}

export async function getAccessToken() {
  const access = localStorage.getItem(LS.access);
  const expiry = Number(localStorage.getItem(LS.expiry) || "0");
  if (access && Date.now() < expiry) return access;
  return await refreshAccessToken();
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem(LS.refresh);
  if (!refresh) throw new Error("No refresh token (login again).");

  const body = new URLSearchParams();
  body.set("client_id", SPOTIFY_CLIENT_ID);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refresh);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) throw new Error("Refresh failed: " + res.status);

  const data = await res.json();
  localStorage.setItem(LS.access, data.access_token);
  localStorage.setItem(LS.expiry, String(Date.now() + (data.expires_in * 1000) - 10_000));
  return data.access_token;
}

export function spotifyLogout() {
  Object.values(LS).forEach(k => localStorage.removeItem(k));

}

