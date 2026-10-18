import { apiRequest } from './apiClient.js';

const request = (path, options = {}) => apiRequest(path, options, {
  dispatchUnauthorized: false,
  networkError: 'Could not reach TraceWise. Check that the backend is running.',
  fallbackError: (status) => status >= 500
    ? 'The backend could not complete this request. Make sure it is running on port 5000, then check the backend terminal for details.'
    : `The request failed (${status}).`,
});

export const getSession = () => request('/auth/me');
export const register = (values) => request('/auth/register', { method: 'POST', body: JSON.stringify(values) });
export const verifyEmail = (values) => request('/auth/verify-email', { method: 'POST', body: JSON.stringify(values) });
export const resendVerification = (values) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify(values) });
export const login = (values) => request('/auth/login', { method: 'POST', body: JSON.stringify(values) });
export const verifyLogin = (values) => request('/auth/verify-login', { method: 'POST', body: JSON.stringify(values) });
export const resendLoginCode = (values) => request('/auth/resend-login-code', { method: 'POST', body: JSON.stringify(values) });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const forgotPassword = (values) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(values) });
export const resetPassword = (values) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(values) });
export const updateProfile = (values) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(values) });
export const changePassword = (values) => request('/auth/password', { method: 'PUT', body: JSON.stringify(values) });
export const getWorkspace = () => request('/auth/workspace');
export const updateWorkspace = (values) => request('/auth/workspace', { method: 'PATCH', body: JSON.stringify(values) });
export const rotateInviteCode = () => request('/auth/workspace/invite-code', { method: 'POST' });
