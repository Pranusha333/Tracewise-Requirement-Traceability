import crypto from 'node:crypto';
import Session from '../models/Session.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

export const SESSION_COOKIE = 'tracewise_session';
export function sessionCookieOptions() {
  const configured = (process.env.SESSION_COOKIE_SAME_SITE || 'strict').toLowerCase();
  const sameSite = ['strict', 'lax', 'none'].includes(configured) ? configured : 'strict';
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production' || sameSite === 'none', sameSite, path: '/' };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function readSessionCookie(request) {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : '';
}

export async function requireAuth(request, _response, next) {
  try {
    const token = readSessionCookie(request);
    if (!token) throw new ApiError(401, 'Please sign in to continue.');
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) throw new ApiError(401, 'Your session has expired. Please sign in again.');
    const user = await User.findById(session.userId).select('name email workspaceId role avatarUrl').lean();
    if (!user) throw new ApiError(401, 'Your account is no longer available. Please sign in again.');
    request.user = user;
    request.sessionId = session._id;
    next();
  } catch (error) { next(error); }
}

export function requireWorkspaceOwner(request, _response, next) {
  if (request.user?.role !== 'owner') return next(new ApiError(403, 'Only the workspace owner can change these settings.'));
  next();
}
