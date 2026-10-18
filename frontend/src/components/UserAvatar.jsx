import { useEffect, useState } from 'react';

export default function UserAvatar({ url, name, className = '', fallbackClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || 'User').trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => setFailed(false), [url]);

  if (url && !failed) return <img className={className} src={url} alt="" onError={() => setFailed(true)} />;
  return <span className={`${className} ${fallbackClassName}`.trim()} aria-hidden="true">{initials || 'U'}</span>;
}
