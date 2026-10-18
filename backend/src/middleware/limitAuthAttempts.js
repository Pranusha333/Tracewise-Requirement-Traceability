const attempts = new Map();

export function limitAuthAttempts(request, response, next) {
  const key = `${request.ip}:${request.path}`;
  const now = Date.now();
  const window = attempts.get(key);

  if (window && window.expiresAt > now && window.count >= 15) {
    response.set('Retry-After', String(Math.ceil((window.expiresAt - now) / 1000)));
    return response.status(429).json({ error: { message: 'Too many account requests. Please wait a few minutes and try again.' } });
  }

  if (!window || window.expiresAt <= now) attempts.set(key, { count: 1, expiresAt: now + 15 * 60 * 1000 });
  else window.count += 1;

  if (attempts.size > 5000) {
    for (const [attemptKey, value] of attempts) if (value.expiresAt <= now) attempts.delete(attemptKey);
  }
  next();
}
