import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Notification } from '../api/types';
import { formatDateTime } from '../lib/format';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listNotifications()
      .then(setItems)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function open(n: Notification) {
    if (!n.read) await api.markNotificationRead(n.id).catch(() => undefined);
    navigate(`/publications/${n.publicationId}`);
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section>
      <div className="row space-between">
        <h1>Notifications</h1>
        <button type="button" className="secondary" onClick={markAll}>
          Mark all as read
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {items && items.length === 0 && <p className="muted">No notifications yet.</p>}
      <ul className="notifications">
        {items?.map((n) => (
          <li key={n.id} className={n.read ? 'notification' : 'notification unread'} data-testid="notification">
            <button type="button" className="link-button" onClick={() => open(n)}>
              {n.message}
            </button>
            <span className="muted">{formatDateTime(n.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
