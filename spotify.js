import { getAccessToken } from "./spotify-auth.js";

async function spFetch(path, opts = {}) {
  const token = await getAccessToken();
  const res = await fetch("https://api.spotify.com/v1" + path, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify API ${res.status} on ${path}`);
  return res.json();
}

export async function getNowPlaying() {
  // returns { item, is_playing, device, progress_ms, ... } or null
  return await spFetch("/me/player");
}

export async function play() {
  await spFetch("/me/player/play", { method: "PUT" });
}

export async function pause() {
  await spFetch("/me/player/pause", { method: "PUT" });
}

export async function nextTrack() {
  await spFetch("/me/player/next", { method: "POST" });
}

export async function prevTrack() {
  await spFetch("/me/player/previous", { method: "POST" });
}

// Optional: auf ein bestimmtes Device umschalten (z.B. iPhone)
export async function transferPlayback(device_id) {
  await spFetch("/me/player", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [device_id], play: true })
  });
}

export async function listDevices() {
  const data = await spFetch("/me/player/devices");
  return data.devices || [];
}