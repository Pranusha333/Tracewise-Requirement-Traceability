const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export async function apiRequest(path, options = {}, {
  dispatchUnauthorized = true,
  networkError = 'Could not reach the API. Make sure the backend is running.',
  fallbackError = (status) => `The API request failed (${status}).`,
} = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error(networkError);
  }

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && dispatchUnauthorized && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tracewise:unauthorized'));
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || fallbackError(response.status));
  }
  return payload;
}
