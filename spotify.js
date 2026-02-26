// spotify.js
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
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify API ${res.status} on ${path} ${text ? "- " + text : ""}`);
  }
  return res.json();
}

/**
 * Exported helper that app.js erwartet:
 * - getPlayer(): liefert /me/player (Device + is_playing + item)
 * - play(), pause(), nextTrack(), prevTrack()
 */

export async function getPlayer() {
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

export async function listDevices() {
  const data = await spFetch("/me/player/devices");
  return data.devices || [];
}

export async function transferPlayback(device_id) {
  await spFetch("/me/player", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [device_id], play: true })
  });
}
