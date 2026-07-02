// api.js — Centralized fetch wrapper for Legal OS
// Automatically attaches the stored JWT Bearer token to every request.
// On 401 responses, clears session and reloads to trigger re-login.

export const BASE = 'http://localhost:3001';

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem('legal_os_session') || 'null');
    } catch {
        return null;
    }
}

export function setSession(data) {
    localStorage.setItem('legal_os_session', JSON.stringify(data));
}

export function clearSession() {
    localStorage.removeItem('legal_os_session');
}

export function isAdmin()    { return getSession()?.role === 'admin'; }
export function isSecretary(){ return getSession()?.role === 'secretary'; }
export function isAdvocate() { return getSession()?.role === 'advocate'; }
export function canEdit()    { const r = getSession()?.role; return r === 'admin' || r === 'secretary'; }

export async function api(endpoint, options = {}) {
    const session = getSession();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

    const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });

    if (res.status === 401) {
        clearSession();
        window.location.reload();
        return;
    }
    return res;
}

export async function apiGet(endpoint)        { return api(endpoint); }
export async function apiPost(endpoint, body) { return api(endpoint, { method:'POST', body: JSON.stringify(body) }); }
export async function apiPut(endpoint, body)  { return api(endpoint, { method:'PUT',  body: JSON.stringify(body) }); }
export async function apiPatch(endpoint, body){ return api(endpoint, { method:'PATCH', body: JSON.stringify(body) }); }
export async function apiDelete(endpoint)     { return api(endpoint, { method:'DELETE' }); }

// Upload a file (multipart, no Content-Type override)
export async function apiUpload(endpoint, formData) {
    const session = getSession();
    const headers = {};
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
    const res = await fetch(`${BASE}${endpoint}`, { method:'POST', body: formData, headers });
    if (res.status === 401) { clearSession(); window.location.reload(); return; }
    return res;
}
