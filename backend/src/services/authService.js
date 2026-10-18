import crypto from 'node:crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { promisify } from 'node:util';
import { hashToken, sessionCookieOptions } from '../middleware/requireAuth.js';
import ImpactAnalysis from '../models/ImpactAnalysis.js';
import Requirement from '../models/Requirement.js';
import Session from '../models/Session.js';
import TestCase from '../models/TestCase.js';
import TraceabilityRelationship from '../models/TraceabilityRelationship.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import ApiError from '../utils/ApiError.js';
import { encryptSecret } from '../utils/secretVault.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 7;
const OTP_MINUTES = 10;
const RESEND_SECONDS = 60;
const PASSWORD_MIN = 10;

function cleanUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl || '', workspaceId: String(user.workspaceId) };
}

function validateNameEmail(name, email) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw new ApiError(400, 'Name must be between 2 and 100 characters.');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) throw new ApiError(400, 'Enter a valid email address.');
  return { name: name.trim(), email: email.trim().toLowerCase() };
}

async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > 200) throw new ApiError(400, `Password must be between ${PASSWORD_MIN} and 200 characters.`);
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !stored) return false;
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function makeInviteCode() { return crypto.randomBytes(9).toString('base64url').toUpperCase(); }

async function newWorkspace(user) {
  const workspace = await Workspace.create({ name: `${user.name}'s workspace`, ownerId: user._id, inviteCode: makeInviteCode() });
  user.workspaceId = workspace._id;
  user.role = 'owner';
  await user.save();
  return workspace;
}

async function assignLegacyData(workspaceId) {
  const unassigned = { workspaceId: { $exists: false } };
  await Promise.all([
    Requirement.updateMany(unassigned, { $set: { workspaceId } }),
    TraceabilityRelationship.updateMany(unassigned, { $set: { workspaceId } }),
    TestCase.updateMany(unassigned, { $set: { workspaceId } }),
    ImpactAnalysis.updateMany(unassigned, { $set: { workspaceId } }),
  ]);
}

async function resolveWorkspace(user, inviteCode) {
  if (inviteCode) {
    const workspace = await Workspace.findOne({ inviteCode: inviteCode.trim().toUpperCase() }).select('+inviteCode');
    if (!workspace) throw new ApiError(400, 'That team invite code is invalid or expired.');
    user.workspaceId = workspace._id;
    user.role = 'member';
    await user.save();
    return workspace;
  }
  const legacy = await Workspace.findOne({ key: 'legacy' });
  if (legacy) return newWorkspace(user);
  try {
    const workspace = await Workspace.create({ key: 'legacy', name: 'Project workspace', description: 'Migrated project workspace', ownerId: user._id, inviteCode: makeInviteCode() });
    user.workspaceId = workspace._id;
    user.role = 'owner';
    await user.save();
    await assignLegacyData(workspace._id);
    return workspace;
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Workspace.findOne({ key: 'legacy' });
    if (existing) return newWorkspace(user);
    throw error;
  }
}

async function createSession(user, response, rememberMe = true) {
  const token = crypto.randomBytes(32).toString('base64url');
  const lifetime = (rememberMe ? SESSION_DAYS : 1) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + lifetime);
  await Session.create({ tokenHash: hashToken(token), userId: user._id, expiresAt });
  response.cookie('tracewise_session', token, { ...sessionCookieOptions(), ...(rememberMe ? { maxAge: lifetime } : {}) });
}

function makeOtp() { return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); }

function safeEmailErrorCode(error) {
  return typeof error?.code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(error.code) ? error.code : undefined;
}

async function sendGmailOtpEmail(email, code, subject, purpose) {
  const missing = [
    ...(!process.env.EMAIL_USER ? ['EMAIL_USER'] : []),
    ...(!process.env.EMAIL_APP_PASSWORD ? ['EMAIL_APP_PASSWORD'] : []),
    ...(!process.env.EMAIL_FROM ? ['EMAIL_FROM'] : []),
  ];
  if (missing.length) {
    console.error('[auth-email] Gmail SMTP is not configured', { category: 'missing_configuration', missing });
    throw new ApiError(503, 'Email codes are not configured. Set EMAIL_USER, EMAIL_APP_PASSWORD, and EMAIL_FROM in backend/.env, then try again.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD.replace(/\s/g, ''),
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#201d39"><h2>${purpose}</h2><p>Your Tracewise verification code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in ${OTP_MINUTES} minutes. If you did not request it, you can ignore this email.</p></div>`,
    });
  } catch (error) {
    console.error('[auth-email] Gmail SMTP delivery failed', {
      category: error?.code === 'EAUTH' ? 'authentication_failed' : 'smtp_delivery_failed',
      ...(safeEmailErrorCode(error) ? { errorCode: safeEmailErrorCode(error) } : {}),
      ...(Number.isInteger(error?.responseCode) ? { smtpStatus: error.responseCode } : {}),
    });
    throw new ApiError(503, 'We could not send the email code. Check your Gmail SMTP settings and try again.');
  } finally {
    transporter.close();
  }
}

async function sendResendOtpEmail(email, code, subject, purpose) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error('[auth-email] Resend is not configured', {
      category: 'missing_configuration',
      missing: [
        ...(!process.env.RESEND_API_KEY ? ['RESEND_API_KEY'] : []),
        ...(!process.env.RESEND_FROM_EMAIL ? ['RESEND_FROM_EMAIL'] : []),
      ],
    });
    throw new ApiError(503, 'Email codes are not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env, then try again.');
  }
  let result;
  try {
    result = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject, html: `<div style="font-family:Arial,sans-serif;color:#201d39"><h2>${purpose}</h2><p>Your Tracewise verification code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in ${OTP_MINUTES} minutes. If you did not request it, you can ignore this email.</p></div>` }),
    });
  } catch (error) {
    console.error('[auth-email] Resend request could not reach the provider', {
      category: error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
      errorType: typeof error?.name === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(error.name) ? error.name : 'Error',
    });
    throw new ApiError(503, 'We could not send the email code. Check your Resend settings and try again.');
  }
  if (!result.ok) {
    let providerError;
    try { providerError = await result.json(); } catch { /* Provider returned no JSON error body. */ }
    const rawCode = providerError?.name ?? providerError?.code ?? providerError?.error;
    const providerCode = typeof rawCode === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(rawCode) ? rawCode : undefined;
    console.error('[auth-email] Resend rejected the email request', {
      category: 'provider_rejected',
      httpStatus: result.status,
      ...(providerCode ? { providerCode } : {}),
    });
    throw new ApiError(503, 'We could not send the email code. Check your Resend settings and try again.');
  }
  return {};
}

async function sendOtpEmail(email, code, subject, purpose) {
  const provider = (process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
  if (provider === 'gmail') return sendGmailOtpEmail(email, code, subject, purpose);
  if (provider === 'resend') return sendResendOtpEmail(email, code, subject, purpose);
  console.error('[auth-email] Unsupported email provider', { category: 'invalid_provider_configuration' });
  throw new ApiError(500, 'Email provider configuration is invalid. Set EMAIL_PROVIDER to gmail or resend.');
}

async function issueCode(user, kind, options = {}) {
  const code = makeOtp();
  const hashField = kind === 'verification' ? 'verificationCodeHash' : kind === 'login' ? 'loginCodeHash' : 'resetCodeHash';
  const expiryField = kind === 'verification' ? 'verificationCodeExpiresAt' : kind === 'login' ? 'loginCodeExpiresAt' : 'resetCodeExpiresAt';
  user[hashField] = hashToken(code);
  user[expiryField] = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
  let loginChallenge;
  if (kind === 'login' && !options.challengeToken) {
    loginChallenge = crypto.randomBytes(32).toString('base64url');
    user.loginChallengeHash = hashToken(loginChallenge);
  }
  await user.save();
  const purpose = kind === 'verification' ? 'Verify your email' : kind === 'login' ? 'Sign in to your account' : 'Reset your password';
  const delivery = await sendOtpEmail(user.email, code, `${purpose} | Tracewise`, purpose);
  return { ...delivery, ...(loginChallenge ? { loginChallenge } : {}), expiresInSeconds: OTP_MINUTES * 60, resendAfterSeconds: RESEND_SECONDS };
}

function workspaceView(workspace, showInvite = false) {
  const output = {
    id: String(workspace._id), name: workspace.name, description: workspace.description,
    preferences: workspace.preferences, aiModel: workspace.aiModel,
    aiConfigured: Boolean(workspace.aiKeyEncrypted || process.env.OPENAI_API_KEY),
    canConfigureAiKey: Boolean(process.env.SETTINGS_ENCRYPTION_KEY && process.env.SETTINGS_ENCRYPTION_KEY.length >= 32),
  };
  if (showInvite) output.inviteCode = workspace.inviteCode;
  return output;
}

export async function register(input, response) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'Request body must be an object.');
  if (input.inviteCode !== undefined && typeof input.inviteCode !== 'string') throw new ApiError(400, 'Team invite code must be text.');
  const { name, email } = validateNameEmail(input.name, input.email);
  const encodedPassword = await passwordHash(input.password);
  const existingUser = await User.findOne({ email }).select('+verificationCodeHash +verificationCodeExpiresAt');
  if (existingUser && existingUser.emailVerified !== false) throw new ApiError(409, 'An account with this email already exists.');
  if (existingUser) {
    const code = await issueCode(existingUser, 'verification');
    return { requiresVerification: true, email, ...code };
  }
  const user = await User.create({ name, email, passwordHash: encodedPassword, workspaceId: new mongoose.Types.ObjectId(), emailVerified: false });
  try {
    await resolveWorkspace(user, input.inviteCode);
    user.emailVerified = false;
    await user.save();
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  const code = await issueCode(user, 'verification');
  return { requiresVerification: true, email, ...code };
}

export async function login(input, response) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await verifyPassword(input?.password, user.passwordHash))) throw new ApiError(401, 'Email or password is incorrect.');
  if (user.emailVerified === undefined) { user.emailVerified = true; await user.save(); }
  if (!user.emailVerified) throw new ApiError(403, 'Verify your email address before signing in.');
  const code = await issueCode(user, 'login');
  return { requiresOtp: true, email: user.email, ...code };
}

export async function resendLoginCode(input) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const challengeToken = typeof input?.loginChallenge === 'string' ? input.loginChallenge : '';
  const user = await User.findOne({ email, emailVerified: true }).select('+loginCodeHash +loginCodeExpiresAt +loginChallengeHash');
  if (!user || !challengeToken || hashToken(challengeToken) !== user.loginChallengeHash || !user.loginCodeExpiresAt || user.loginCodeExpiresAt <= new Date()) throw new ApiError(400, 'Sign-in verification expired. Return to sign in and try again.');
  const code = await issueCode(user, 'login', { challengeToken });
  return { message: 'A new sign-in code has been sent.', ...code };
}

export async function verifyLoginCode(input, response) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const code = typeof input?.code === 'string' ? input.code.trim() : '';
  const challengeToken = typeof input?.loginChallenge === 'string' ? input.loginChallenge : '';
  const user = await User.findOne({ email }).select('+loginCodeHash +loginCodeExpiresAt +loginChallengeHash');
  if (!user || !user.emailVerified || !challengeToken || hashToken(challengeToken) !== user.loginChallengeHash || !/^\d{6}$/.test(code) || !user.loginCodeExpiresAt || user.loginCodeExpiresAt <= new Date() || hashToken(code) !== user.loginCodeHash) {
    throw new ApiError(400, 'That sign-in code is invalid or expired. Request a new code and try again.');
  }
  user.loginCodeHash = undefined;
  user.loginCodeExpiresAt = undefined;
  user.loginChallengeHash = undefined;
  await user.save();
  await createSession(user, response, input?.rememberMe !== false);
  const workspace = await Workspace.findById(user.workspaceId).select('+inviteCode +aiKeyEncrypted');
  return { user: cleanUser(user), workspace: workspace ? workspaceView(workspace, user.role === 'owner') : null };
}

export async function verifyEmail(input, response) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const code = typeof input?.code === 'string' ? input.code.trim() : '';
  const user = await User.findOne({ email }).select('+verificationCodeHash +verificationCodeExpiresAt');
  if (!user || user.emailVerified || !/^\d{6}$/.test(code) || user.verificationCodeExpiresAt <= new Date() || hashToken(code) !== user.verificationCodeHash) {
    throw new ApiError(400, 'That verification code is invalid or expired. Request a new code and try again.');
  }
  user.emailVerified = true;
  user.verificationCodeHash = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();
  await createSession(user, response);
  const workspace = await Workspace.findById(user.workspaceId).select('+inviteCode +aiKeyEncrypted');
  return { user: cleanUser(user), workspace: workspace ? workspaceView(workspace, user.role === 'owner') : null };
}

export async function resendVerificationCode(input) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const user = await User.findOne({ email, emailVerified: false }).select('+verificationCodeHash +verificationCodeExpiresAt');
  if (!user) return { message: 'If that address is awaiting verification, a new code will be sent.' };
  const code = await issueCode(user, 'verification');
  return { message: 'A new verification code has been sent.', ...code };
}

export async function logout(sessionId, response) {
  if (sessionId) await Session.deleteOne({ _id: sessionId });
  response.clearCookie('tracewise_session', sessionCookieOptions());
}

export async function getSession(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(401, 'Please sign in again.');
  const workspace = await Workspace.findById(user.workspaceId).select('+inviteCode +aiKeyEncrypted');
  return { user: cleanUser(user), workspace: workspace ? workspaceView(workspace, user.role === 'owner') : null };
}

export async function updateProfile(userId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Profile details must be an object.');
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User account not found.');
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 100) throw new ApiError(400, 'Name must be between 2 and 100 characters.');
    user.name = input.name.trim();
  }
  if (input.email !== undefined && (typeof input.email !== 'string' || input.email.trim().toLowerCase() !== user.email)) {
    const { email } = validateNameEmail(user.name, input.email);
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new ApiError(400, 'Enter your current password to change your email address.');
    if (await User.exists({ email, _id: { $ne: user._id } })) throw new ApiError(409, 'An account with this email already exists.');
    user.email = email;
  }
  if (input.avatarUrl !== undefined) {
    let validAvatarUrl = !input.avatarUrl;
    if (typeof input.avatarUrl === 'string' && input.avatarUrl) {
      try { const parsed = new URL(input.avatarUrl); validAvatarUrl = parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password; }
      catch { validAvatarUrl = false; }
    }
    if (typeof input.avatarUrl !== 'string' || !validAvatarUrl || input.avatarUrl.length > 1000) throw new ApiError(400, 'Profile image must be a valid HTTPS URL.');
    user.avatarUrl = input.avatarUrl.trim();
  }
  await user.save();
  return cleanUser(user);
}

export async function changePassword(userId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Password details must be an object.');
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) throw new ApiError(400, 'Current password is incorrect.');
  user.passwordHash = await passwordHash(input.newPassword);
  await user.save();
  await Session.deleteMany({ userId, _id: { $ne: input.sessionId } });
}

export async function requestPasswordReset(input) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const user = await User.findOne({ email, emailVerified: true }).select('+resetTokenHash +resetTokenExpiresAt +resetCodeHash +resetCodeExpiresAt');
  if (!user) return {};
  return { ...(await issueCode(user, 'reset')), message: 'If an account exists for that email, a reset code has been sent.' };
}

export async function resetPassword(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Password reset details must be an object.');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  const legacyToken = typeof input.token === 'string' ? input.token : '';
  const user = legacyToken
    ? await User.findOne({ resetTokenHash: hashToken(legacyToken), resetTokenExpiresAt: { $gt: new Date() } }).select('+resetCodeHash +resetCodeExpiresAt +resetTokenHash +resetTokenExpiresAt +passwordHash')
    : await User.findOne({ email, resetCodeHash: hashToken(code), resetCodeExpiresAt: { $gt: new Date() } }).select('+resetCodeHash +resetCodeExpiresAt +resetTokenHash +resetTokenExpiresAt +passwordHash');
  if (!user || !/^\d{6}$/.test(code)) throw new ApiError(400, 'This password reset code is invalid or expired. Request a new one.');
  user.passwordHash = await passwordHash(input.password);
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  user.resetCodeHash = undefined;
  user.resetCodeExpiresAt = undefined;
  await user.save();
  await Session.deleteMany({ userId: user._id });
}

export async function getWorkspace(user) {
  const workspace = await Workspace.findById(user.workspaceId).select('+inviteCode +aiKeyEncrypted');
  if (!workspace) throw new ApiError(404, 'Workspace not found.');
  const members = await User.find({ workspaceId: user.workspaceId }).select('name email role avatarUrl createdAt').sort({ createdAt: 1 }).lean();
  return { workspace: workspaceView(workspace, user.role === 'owner'), members: members.map((member) => ({ id: String(member._id), name: member.name, email: member.email, role: member.role, avatarUrl: member.avatarUrl })) };
}

export async function updateWorkspace(user, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Workspace settings must be an object.');
  const workspace = await Workspace.findById(user.workspaceId).select('+inviteCode +aiKeyEncrypted');
  if (!workspace) throw new ApiError(404, 'Workspace not found.');
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 120) throw new ApiError(400, 'Project name must be between 2 and 120 characters.');
    workspace.name = input.name.trim();
  }
  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.length > 1000) throw new ApiError(400, 'Description must be 1000 characters or fewer.');
    workspace.description = input.description.trim();
  }
  if (input.aiModel !== undefined) {
    if (typeof input.aiModel !== 'string' || !/^[a-z0-9._-]{2,120}$/i.test(input.aiModel.trim())) throw new ApiError(400, 'Enter a valid model name.');
    workspace.aiModel = input.aiModel.trim();
  }
  if (input.aiApiKey !== undefined && input.aiApiKey !== '') {
    if (typeof input.aiApiKey !== 'string' || input.aiApiKey.trim().length < 20 || input.aiApiKey.trim().length > 4096 || /\s/.test(input.aiApiKey.trim())) throw new ApiError(400, 'AI provider key must be 20 to 4096 characters and contain no spaces.');
    workspace.aiKeyEncrypted = encryptSecret(input.aiApiKey.trim());
  }
  if (input.clearAiApiKey === true) workspace.aiKeyEncrypted = undefined;
  if (input.preferences !== undefined) {
    const prefs = input.preferences;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) throw new ApiError(400, 'Preferences must be an object.');
    if (prefs.theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(prefs.theme)) throw new ApiError(400, 'Theme must be light, dark, or system.');
      workspace.preferences.theme = prefs.theme;
    }
    if (prefs.notifications !== undefined) {
      if (typeof prefs.notifications !== 'boolean') throw new ApiError(400, 'notifications must be true or false.');
      workspace.preferences.notifications = prefs.notifications;
    }
    if (prefs.compactMode !== undefined) {
      if (typeof prefs.compactMode !== 'boolean') throw new ApiError(400, 'compactMode must be true or false.');
      workspace.preferences.compactMode = prefs.compactMode;
    }
  }
  await workspace.save();
  return workspaceView(workspace, user.role === 'owner');
}

export async function rotateInviteCode(user) {
  const workspace = await Workspace.findById(user.workspaceId).select('+inviteCode +aiKeyEncrypted');
  if (!workspace) throw new ApiError(404, 'Workspace not found.');
  workspace.inviteCode = makeInviteCode();
  await workspace.save();
  return workspaceView(workspace, true);
}
