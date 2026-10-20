import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Publication, Species } from '../api/types';
import { PublicationCard } from '../components/PublicationCard';
import { COMMUNES, SPECIES_LABEL } from '../lib/constants';

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const commune = params.get('commune') ?? '';
  const species = (params.get('species') ?? '') as Species | '';
  const [items, setItems] = useState<Publication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .listPublications({ commune, species })
      .then((r) => alive && setItems(r))
      .catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, [commune, species]);

  function setFilter(key: 'commune' | 'species', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <section>
      <h1>Lost pets</h1>
      <div className="filters" role="search">
        <label>
          Commune
          <select aria-label="Filter by commune" value={commune} onChange={(e) => setFilter('commune', e.target.value)}>
            <option value="">All communes</option>
            {COMMUNES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Species
          <select aria-label="Filter by species" value={species} onChange={(e) => setFilter('species', e.target.value)}>
            <option value="">All species</option>
            {(Object.keys(SPECIES_LABEL) as Species[]).map((s) => (
              <option key={s} value={s}>
                {SPECIES_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {items === null && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && <p className="muted">No active publications match your filters.</p>}
      {items && items.length > 0 && (
        <div className="grid" data-testid="publication-grid">
          {items.map((p) => (
            <PublicationCard key={p.id} publication={p} />
          ))}
        </div>
      )}
    </section>
  );
}
