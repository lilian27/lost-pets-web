import { Link } from 'react-router-dom';
import type { Publication } from '../api/types';
import { SEX_LABEL, SIZE_LABEL, SPECIES_LABEL } from '../lib/constants';
import { formatDateTime } from '../lib/format';

export function PublicationCard({ publication: p }: { publication: Publication }) {
  return (
    <article className="card" data-testid="publication-card">
      <Link to={`/publications/${p.id}`} className="card-link">
        <img className="card-photo" src={p.pet.photo} alt={p.pet.name} />
        <div className="card-body">
          <h3>{p.pet.name}</h3>
          <p className="tags">
            <span className="tag">{SPECIES_LABEL[p.pet.species]}</span>
            <span className="tag">{SEX_LABEL[p.pet.sex]}</span>
            <span className="tag">{SIZE_LABEL[p.pet.size]}</span>
          </p>
          <p className="muted" data-testid="card-commune">
            {p.commune}
          </p>
          <p className="muted">Lost {formatDateTime(p.lostAt)}</p>
          <p className="muted">
            Published by <strong data-testid="owner-alias">{p.owner.alias}</strong>
          </p>
        </div>
      </Link>
    </article>
  );
}
