import * as authService from '../services/authService.js';

export async function register(request, response) {
  response.status(202).json(await authService.register(request.body, response));
}

export async function verifyEmail(request, response) {
  response.json(await authService.verifyEmail(request.body, response));
}

export async function resendVerification(request, response) {
  response.json(await authService.resendVerificationCode(request.body));
}

export async function login(request, response) {
  response.json(await authService.login(request.body, response));
}

export async function verifyLogin(request, response) {
  response.json(await authService.verifyLoginCode(request.body, response));
}

export async function resendLoginCode(request, response) {
  response.json(await authService.resendLoginCode(request.body));
}

export async function logout(request, response) {
  await authService.logout(request.sessionId, response);
  response.json({ message: 'You are signed out.' });
}

export async function session(request, response) {
  response.json(await authService.getSession(request.user._id));
}

export async function forgotPassword(request, response) {
  response.json({ message: 'If an account exists for that email, password reset instructions will be sent.', ...(await authService.requestPasswordReset(request.body)) });
}

export async function resetPassword(request, response) {
  await authService.resetPassword(request.body);
  response.json({ message: 'Password updated. Sign in with your new password.' });
}

export async function updateProfile(request, response) {
  response.json({ user: await authService.updateProfile(request.user._id, request.body) });
}

export async function changePassword(request, response) {
  await authService.changePassword(request.user._id, { ...request.body, sessionId: request.sessionId });
  response.json({ message: 'Password updated. Other active sessions were signed out.' });
}

export async function workspace(request, response) {
  response.json(await authService.getWorkspace(request.user));
}

export async function updateWorkspace(request, response) {
  response.json({ workspace: await authService.updateWorkspace(request.user, request.body) });
}

export async function rotateInvite(request, response) {
  response.json({ workspace: await authService.rotateInviteCode(request.user) });
}
