// api.js — Centralized fetch wrapper for Legal OS
// Automatically attaches the stored JWT Bearer token to every request.
// On 401 responses, clears session and reloads to trigger re-login.

export function isElectronEnv() {
    return typeof window !== 'undefined' && (
        !!window.electronAPI ||
        navigator.userAgent.includes('Electron') ||
        window.location.protocol === 'file:'
    );
}

export function resolveBaseUrl() {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('legal_os_api_url') : null;
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    if (isElectronEnv()) return 'http://localhost:3001';
    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001';
        return window.location.origin;
    }
    return 'http://localhost:3001';
}

export let BASE = resolveBaseUrl();

export function setApiUrl(newUrl) {
    if (newUrl && newUrl.trim()) {
        const formatted = newUrl.trim().replace(/\/+$/, '');
        localStorage.setItem('legal_os_api_url', formatted);
        BASE = formatted;
    } else {
        localStorage.removeItem('legal_os_api_url');
        BASE = resolveBaseUrl();
    }
    return BASE;
}

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

export function isAdmin()    { const r = getSession()?.role; return r === 'admin' || r === 'developer'; }
export function isSecretary(){ return getSession()?.role === 'secretary'; }
export function isAdvocate() { return getSession()?.role === 'advocate'; }
export function canEdit()    { const r = getSession()?.role; return r === 'admin' || r === 'secretary' || r === 'developer'; }

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

// Full Cache Invalidation & Force Fresh App Reload
export async function clearAppCacheAndReload() {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                await reg.unregister();
            }
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) {
                await caches.delete(key);
            }
        }
    } catch (e) {
        console.warn('Cache unregister warning:', e);
    }
    window.location.reload();
}
