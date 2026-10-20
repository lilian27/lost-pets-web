import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Comment } from '../api/types';
import { COMMENT_TYPE_LABEL, MAX_COMMENT_LENGTH } from '../lib/constants';
import { editTokens } from '../lib/editTokens';
import { formatDateTime } from '../lib/format';
import { CharCounter } from './Field';
import { FlagIcon } from './FlagIcon';

interface Props {
  comment: Comment;
  onChange: (c: Comment) => void;
}

export function CommentItem({ comment: c, onChange }: Props) {
  const token = editTokens.get(c.id);
  const canEdit = c.canEdit || (c.isAnonymous && !!token);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.text);
  const [error, setError] = useState<string | null>(null);
  const [flaggedLocally, setFlaggedLocally] = useState(false);

  async function save() {
    if (!text.trim()) return setError('Comment text is required');
    if (text.length > MAX_COMMENT_LENGTH)
      return setError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
    try {
      onChange(await api.updateComment(c.id, text, token));
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function flag() {
    try {
      onChange(await api.flagComment(c.id));
      setFlaggedLocally(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <li className={`comment comment-${c.type}`} data-testid="comment" data-comment-type={c.type}>
      <div className="comment-head">
        {c.type === 'possible_finding' && <FlagIcon title="Possible finding" />}
        <strong data-testid="comment-author">{c.authorName}</strong>
        {c.isAnonymous && <span className="muted">(guest)</span>}
        <span className="tag">{COMMENT_TYPE_LABEL[c.type]}</span>
        <span className="muted">{formatDateTime(c.createdAt)}</span>
        {c.edited && <span className="muted">(edited)</span>}
      </div>
      {editing ? (
        <div className="comment-edit">
          <label htmlFor={`edit-${c.id}`} className="sr-only">
            Edit comment
          </label>
          <textarea id={`edit-${c.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <CharCounter value={text} max={MAX_COMMENT_LENGTH} />
          <div className="row">
            <button type="button" onClick={save}>
              Save
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditing(false);
                setText(c.text);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="comment-text" data-testid="comment-text">
          {c.text}
        </p>
      )}
      {c.photo && <img className="comment-photo" src={c.photo} alt={`Photo from ${c.authorName}`} />}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="comment-actions">
        {canEdit && !editing && (
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {c.flaggedByMe || flaggedLocally ? (
          <span className="muted">Reported</span>
        ) : (
          <button type="button" className="link-button" onClick={flag}>
            Report offensive
          </button>
        )}
        {c.flagged && (
          <span className="flagged" data-testid="offensive-flag">
            Flagged as offensive ({c.flagCount})
          </span>
        )}
      </div>
    </li>
  );
}
