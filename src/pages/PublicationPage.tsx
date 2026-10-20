import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, api, errorMessage } from '../api/client';
import type { Comment, Publication } from '../api/types';
import { CommentForm } from '../components/CommentForm';
import { CommentItem } from '../components/CommentItem';
import { SEX_LABEL, SIZE_LABEL, SPECIES_LABEL } from '../lib/constants';
import { formatDateTime } from '../lib/format';

export function PublicationPage() {
  const { id = '' } = useParams();
  const [pub, setPub] = useState<Publication | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getPublication(id), api.listComments(id)])
      .then(([p, c]) => {
        if (!alive) return;
        setPub(p);
        setComments(c);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof ApiError && err.status === 404 ? 'Publication not found' : errorMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [id]);

  async function markFound() {
    try {
      setPub(await api.updatePublicationStatus(id, 'found'));
    } catch (err) {
      setStatusError(errorMessage(err));
    }
  }

  const replace = (c: Comment) => setComments((list) => list.map((x) => (x.id === c.id ? c : x)));

  if (error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  if (!pub) return <p className="muted">Loading…</p>;
  const { pet } = pub;

  return (
    <article className="publication">
      <div className="publication-main panel">
        <img className="publication-photo" src={pet.photo} alt={pet.name} />
        <div>
          <h1>{pet.name}</h1>
          <p>
            <span className={`status status-${pub.status}`} data-testid="publication-status">
              {pub.status === 'active' ? 'Lost' : 'Found'}
            </span>
          </p>
          <dl className="details">
            <dt>Species</dt>
            <dd>{SPECIES_LABEL[pet.species]}</dd>
            <dt>Sex</dt>
            <dd>{SEX_LABEL[pet.sex]}</dd>
            <dt>Size</dt>
            <dd>{SIZE_LABEL[pet.size]}</dd>
            {pet.color && (
              <>
                <dt>Color</dt>
                <dd>{pet.color}</dd>
              </>
            )}
            {pet.vaccines && (
              <>
                <dt>Vaccines</dt>
                <dd>{pet.vaccines}</dd>
              </>
            )}
            <dt>Commune</dt>
            <dd>{pub.commune}</dd>
            {pub.lastSeenAddress && (
              <>
                <dt>Last seen</dt>
                <dd>{pub.lastSeenAddress}</dd>
              </>
            )}
            <dt>Lost on</dt>
            <dd data-testid="lost-at">{formatDateTime(pub.lostAt)}</dd>
            {pub.foundAt && (
              <>
                <dt>Found on</dt>
                <dd>{formatDateTime(pub.foundAt)}</dd>
              </>
            )}
            <dt>Published by</dt>
            <dd data-testid="owner-alias">{pub.owner.alias}</dd>
          </dl>
          {pub.description && <p>{pub.description}</p>}
          {pub.isOwner && pub.status === 'active' && (
            <button type="button" onClick={markFound}>
              Mark as found
            </button>
          )}
          {statusError && (
            <p className="form-error" role="alert">
              {statusError}
            </p>
          )}
        </div>
      </div>
      <section className="thread">
        <h2>Comments ({comments.length})</h2>
        <ul className="comment-list">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} onChange={replace} />
          ))}
        </ul>
        {pub.status === 'active' ? (
          <CommentForm publicationId={pub.id} onCreated={(c) => setComments((l) => [...l, c])} />
        ) : (
          <p className="muted">This publication is closed. The thread is kept for your records.</p>
        )}
      </section>
    </article>
  );
}
