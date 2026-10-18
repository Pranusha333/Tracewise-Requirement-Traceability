import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, GitBranch, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles, Waypoints } from 'lucide-react';
import { forgotPassword, login, register, resendLoginCode, resendVerification, resetPassword, verifyEmail, verifyLogin } from '../services/authService.js';
import './auth.css';

const resetToken = new URLSearchParams(window.location.search).get('token') || '';

function OtpFields({ value, onChange }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  function put(text, index) {
    const incoming = text.replace(/\D/g, '').slice(0, 6);
    if (incoming.length > 1) {
      onChange(incoming);
      refs.current[Math.min(incoming.length, 5)]?.focus();
      return;
    }
    const next = digits.map((digit, at) => at === index ? (incoming || ' ') : digit).join('').replace(/\s/g, '');
    onChange(next);
    if (incoming && index < 5) refs.current[index + 1]?.focus();
  }
  return <div className="otp-fields" onPaste={(event) => { const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (pasted) { event.preventDefault(); onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus(); } }}>
    {digits.map((digit, index) => <input key={index} ref={(node) => { refs.current[index] = node; }} aria-label={`Verification digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={6} value={digit.trim()} onChange={(event) => put(event.target.value, index)} onKeyDown={(event) => { if (event.key === 'Backspace' && !digits[index].trim() && index > 0) refs.current[index - 1]?.focus(); if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus(); if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus(); }} />)}
  </div>;
}

function maskEmail(value) {
  const [name, domain] = value.split('@');
  if (!name || !domain) return value;
  return `${name.slice(0, 1)}${'•'.repeat(Math.min(6, Math.max(3, name.length - 1)))}@${domain}`;
}

export default function AuthPage({ mode, onAuthenticated, onModeChange }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loginOtp, setLoginOtp] = useState(false);
  const [loginChallenge, setLoginChallenge] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [forgotStep, setForgotStep] = useState('email');
  const isRegister = mode === 'register';
  const isVerify = mode === 'verify-email';
  const isForgot = mode === 'forgot-password';
  const isReset = mode === 'reset-password';
  const isRecovery = isForgot && forgotStep === 'reset';
  const passwordStrength = password.length === 0 ? 0 : Math.min(4, (password.length >= 10 ? 1 : 0) + (/[A-Z]/.test(password) && /[a-z]/.test(password) ? 1 : 0) + (/\d/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0));

  useEffect(() => { if (!resendIn) return undefined; const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000); return () => window.clearTimeout(timer); }, [resendIn]);

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'login' && !loginOtp) {
        const result = await login({ email, password, rememberMe: remember });
        if (result.requiresOtp) {
          setLoginOtp(true); setLoginChallenge(result.loginChallenge || ''); setOtp(''); setResendIn(result.resendAfterSeconds || 60);
          setMessage('A one-time sign-in code has been sent to your email.');
        } else onAuthenticated(result);
      } else if (loginOtp) onAuthenticated(await verifyLogin({ email, code: otp, loginChallenge, rememberMe: remember }));
      else if (isRegister) {
        if (password !== confirmPassword) throw new Error('Your passwords do not match.');
        if (!acceptedTerms) throw new Error('Please accept the terms to create your account.');
        const result = await register({ name, email, password, inviteCode });
        setEmail(result.email || email); setResendIn(result.resendAfterSeconds || 60); setOtp('');
        setMessage('Your account is ready. Enter the code we sent to your email.'); onModeChange('verify-email');
      } else if (isVerify) onAuthenticated(await verifyEmail({ email, code: otp }));
      else if (isForgot && forgotStep === 'email') {
        const result = await forgotPassword({ email }); setResendIn(result.resendAfterSeconds || 60); setForgotStep('reset');
        setMessage('If that address has an account, a reset code has been sent.');
      } else if (isRecovery) {
        if (password !== confirmPassword) throw new Error('Your passwords do not match.');
        const result = await resetPassword({ email, code: otp, password }); setForgotStep('email'); setPassword(''); setConfirmPassword(''); setOtp('');
        setMessage(result.message); onModeChange('login');
      } else if (isReset) {
        if (password !== confirmPassword) throw new Error('Your passwords do not match.');
        const result = await resetPassword({ token: resetToken, password }); setMessage(result.message); onModeChange('login');
      }
    } catch (submitError) {
      if (mode === 'login' && submitError.message.toLowerCase().includes('verify your email')) {
        setError('');
        setMessage('Enter the email code to activate your account, or resend a code below.');
        onModeChange('verify-email');
      } else setError(submitError.message);
    }
    finally { setBusy(false); }
  }

  async function resendCode() {
    setError(''); setBusy(true);
    try {
      const result = loginOtp ? await resendLoginCode({ email, loginChallenge }) : isVerify ? await resendVerification({ email }) : await forgotPassword({ email });
      setResendIn(result.resendAfterSeconds || 60); setMessage(result.message || 'A new code has been sent.');
    } catch (sendError) { setError(sendError.message); }
    finally { setBusy(false); }
  }

  const heading = isRegister ? 'Create your account' : isVerify ? 'Verify your email' : loginOtp ? 'Check your email' : isForgot && !isRecovery ? 'Forgot your password?' : isRecovery ? 'Create a new password' : isReset ? 'Choose a new password' : 'Welcome back!';
  const subtitle = isRegister ? 'Start managing requirements with smarter traceability.' : isVerify ? `We've sent a 6-digit verification code to ${maskEmail(email)}.` : loginOtp ? `Enter the sign-in code sent to ${email}.` : isForgot && !isRecovery ? 'Enter your email and we’ll send you a reset code.' : isRecovery ? 'Enter the code from your email and choose a secure password.' : isReset ? 'Use a strong password you have not used before.' : 'Sign in to continue to your workspace.';
  const showOtp = isVerify || isRecovery || loginOtp;
  const displayedEmail = isVerify ? maskEmail(email) : email;

  return <main className={`auth-page${mode === 'login' ? ' auth-page-login' : ''}${isRegister ? ' auth-page-signup' : ''}${isVerify ? ' auth-page-verify' : ''}`}>
    <section className="auth-brand-panel">
      <a className="auth-brand" href="#login"><span><GitBranch size={23} /></span><strong>tracewise<span>.</span></strong></a>
      <div className="auth-brand-copy">
        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-grid-glow" /><div className="auth-flow-line flow-a" /><div className="auth-flow-line flow-b" />
          <div className="auth-graph-card"><div className="graph-card-head"><span><i /><i /><i /></span><b>Traceability map</b><Waypoints size={15} /></div><div className="graph-map"><div className="map-node node-a"><Check size={11} /></div><div className="map-node node-b"><span>REQ</span></div><div className="map-node node-c"><ShieldCheck size={13} /></div><div className="map-node node-d"><span>TEST</span></div><i className="map-link link-a" /><i className="map-link link-b" /><i className="map-link link-c" /></div><div className="graph-card-foot"><span>Requirements</span><strong>Linked to tests</strong></div></div>
          <div className="auth-float auth-float-one"><Sparkles size={15} /><span>Change review</span></div><div className="auth-float auth-float-two"><GitBranch size={15} /><span>Project links</span></div>
        </div>
        <span className="auth-kicker"><Sparkles size={13} /> REQUIREMENTS. CONNECTIONS. CLARITY.</span>
        <h1>Understand every change.<br /><em>Stay connected.</em></h1>
        <p>Link requirements to tests, review project dependencies, and see which records may be affected by a proposed change.</p>
        <div className="auth-proof"><span><Check size={13} /></span>Requirements, tests, and decisions in sync</div>
      </div>
      <div className="auth-brand-footer"><ShieldCheck size={14} /> Secure by design <i /> Built for engineering teams</div>
    </section>
    <section className="auth-form-panel"><div className="auth-form-wrap">
      <div className="auth-mobile-brand"><span><GitBranch size={18} /></span><strong>tracewise<span>.</span></strong></div>
      <div className="auth-glass-card">
        <div className="auth-form-heading"><div className="auth-form-icon">{showOtp ? <KeyRound size={19} /> : isForgot || isReset ? <LockKeyhole size={19} /> : <Mail size={19} />}</div><span className="auth-kicker">{isRegister ? 'GET STARTED' : isVerify ? 'EMAIL VERIFICATION' : loginOtp ? 'TWO-STEP VERIFICATION' : isForgot || isReset ? 'ACCOUNT RECOVERY' : 'YOUR WORKSPACE'}</span><h2>{heading}</h2><p>{subtitle}</p></div>
        <form onSubmit={submit} className="auth-form">
          {isRegister && <label>Full name<div className="auth-input-wrap"><input required autoComplete="name" minLength="2" maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></div></label>}
          {(!isReset && !isVerify && !loginOtp && (!isForgot || forgotStep === 'email')) && <label>Email address<div className="auth-input-wrap"><Mail size={16} /><input required type="email" autoComplete="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></div></label>}
          {(isVerify || loginOtp) && <div className="auth-verified-email"><Mail size={15} /> {displayedEmail}<button type="button" onClick={() => { setError(''); setMessage(''); setOtp(''); if (loginOtp) { setLoginOtp(false); setLoginChallenge(''); } else onModeChange('register'); }}>Change</button></div>}
          {isRegister && <label>Team invite code <span className="auth-optional">optional</span><input autoComplete="off" maxLength="40" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Join an existing workspace" /></label>}
          {showOtp && <label className="otp-label">6-digit code<OtpFields value={otp} onChange={setOtp} /></label>}
          {!isForgot && !isVerify && !loginOtp && <label>{isReset || isRecovery ? 'New password' : 'Password'}<span className="auth-password-wrap"><LockKeyhole size={15} /><input required type={visible ? 'text' : 'password'} minLength="10" maxLength="200" autoComplete={isRegister || isReset || isRecovery ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister || isReset || isRecovery ? 'At least 10 characters' : 'Enter your password'} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
          {(isRegister || isReset || isRecovery) && <>{isRegister && <div className="password-strength"><div className={`strength-meter strength-${passwordStrength}`}><i /><i /><i /><i /></div><span>{password.length ? ['Too short', 'Fair', 'Good', 'Strong', 'Very strong'][passwordStrength] : 'Use 10+ characters with mixed case, a number, and a symbol'}</span></div>}<label>Confirm password<span className="auth-password-wrap"><LockKeyhole size={15} /><input required type={visible ? 'text' : 'password'} minLength="10" maxLength="200" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></span></label></>}
          {isRegister && <label className="terms-option"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /> <span>I agree to the Terms of Service and Privacy Policy.</span></label>}
          {mode === 'login' && !loginOtp && <div className="auth-options"><label className="remember-option"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label><button className="auth-text-button" type="button" onClick={() => { setError(''); setMessage(''); setForgotStep('email'); onModeChange('forgot-password'); }}>Forgot password?</button></div>}
          {error && <div className="auth-feedback error" role="alert">{error}</div>}
          {message && <div className="auth-feedback success" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy || (showOtp && otp.length !== 6) || ((isRegister || isReset || isRecovery) && password.length < 10) || (isRegister && !acceptedTerms) || (isReset && !resetToken)}>{busy ? <><LoaderCircle className="auth-spinner" size={16} />Please wait…</> : <>{isRegister ? 'Create account' : isVerify ? 'Verify email' : isForgot && !isRecovery ? 'Send reset code' : isRecovery ? 'Reset password' : isReset ? 'Update password' : 'Sign in'} <ArrowRight size={16} /></>}</button>
        </form>
        {showOtp && <div className="auth-resend">Didn’t receive the code? <button type="button" disabled={busy || resendIn > 0} onClick={resendCode}>{resendIn ? `Resend in ${resendIn}s` : 'Resend code'}</button></div>}
        {(isForgot || isReset || isVerify || loginOtp) ? <button className="auth-back-link" type="button" onClick={() => { if (loginOtp) { setLoginOtp(false); setLoginChallenge(''); setOtp(''); setError(''); setMessage(''); } else onModeChange(isVerify ? 'register' : 'login'); }}><ArrowLeft size={14} /> {isVerify ? 'Back to create account' : 'Back to sign in'}</button> : <div className="auth-switch">{isRegister ? 'Already have an account?' : 'Don’t have an account?'} <button type="button" onClick={() => { setError(''); setMessage(''); onModeChange(isRegister ? 'login' : 'register'); }}>{isRegister ? 'Sign in' : 'Create account'}</button></div>}
        <p className="auth-security"><ShieldCheck size={14} /> Protected with encrypted sessions and secure password hashing.</p>
        <nav className="auth-legal-links" aria-label="Legal information"><a href="#privacy">Privacy policy</a><a href="#terms">Terms of service</a></nav>
      </div>
    </div></section>
  </main>;
}
