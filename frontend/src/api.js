// Small API helper for frontend
import { API_URL } from './config';

export const API_BASE = API_URL;

export async function apiFetch(path, options = {}){
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch {}
  if(!res.ok){
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}
