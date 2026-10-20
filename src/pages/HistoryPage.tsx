import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Publication } from '../api/types';
import { formatDateTime } from '../lib/format';

export function HistoryPage() {
  const [items, setItems] = useState<Publication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myPublications()
      .then(setItems)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <section>
      <h1>My publications</h1>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {items && items.length === 0 && <p className="muted">You have no publications yet.</p>}
      <ul className="history">
        {items?.map((p) => (
          <li key={p.id} className="panel history-item" data-testid="history-item">
            <img className="pet-thumb" src={p.pet.photo} alt={p.pet.name} />
            <div>
              <Link to={`/publications/${p.id}`}>
                <strong>{p.pet.name}</strong>
              </Link>
              <p className="muted">
                {p.commune} · Lost {formatDateTime(p.lostAt)}
              </p>
            </div>
            <span className={`status status-${p.status}`}>{p.status === 'active' ? 'Lost' : 'Found'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
