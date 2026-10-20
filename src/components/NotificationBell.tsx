import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';

export const POLL_MS = 5000;

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .unreadCount()
        .then((r) => alive && setCount(r.count))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [location.key]);

  return (
    <Link to="/notifications" className="bell" aria-label={`Notifications (${count} unread)`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 0 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"
        />
      </svg>
      {count > 0 && (
        <span className="badge" data-testid="notification-badge">
          {count}
        </span>
      )}
    </Link>
  );
}
