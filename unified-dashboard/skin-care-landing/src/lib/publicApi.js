import { apiUrl } from './apiBase.js';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function publicGet(path) {
  const res = await fetch(apiUrl(path), { headers: { 'ngrok-skip-browser-warning': 'true' } });
  const data = await parseJson(res);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

export async function publicPost(path, body) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}
