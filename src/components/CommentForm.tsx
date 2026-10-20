import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import type { Comment, CommentType } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { COMMENT_TYPE_LABEL, MAX_COMMENT_LENGTH } from '../lib/constants';
import { editTokens } from '../lib/editTokens';
import { CharCounter, Field } from './Field';
import { PhotoInput } from './PhotoInput';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Errors = Partial<Record<'authorName' | 'authorEmail' | 'text' | 'form', string>>;

export function CommentForm({
  publicationId,
  onCreated,
}: {
  publicationId: string;
  onCreated: (c: Comment) => void;
}) {
  const { user } = useAuth();
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [type, setType] = useState<CommentType>('comment');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function validate(): Errors {
    const e: Errors = {};
    if (!user) {
      if (!authorName.trim()) e.authorName = 'Name is required';
      if (!EMAIL_RE.test(authorEmail)) e.authorEmail = 'A valid email is required';
    }
    if (!text.trim()) e.text = 'Comment text is required';
    else if (text.length > MAX_COMMENT_LENGTH)
      e.text = `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`;
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const created = await api.createComment(publicationId, {
        text,
        type,
        ...(photo ? { photo } : {}),
        ...(user ? {} : { authorName, authorEmail }),
      });
      if (created.editToken) editTokens.set(created.id, created.editToken);
      onCreated(created);
      setText('');
      setPhoto(null);
      setType('comment');
      setFormKey((k) => k + 1);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={submit} noValidate aria-label="Add a comment">
      <h3>Add a comment</h3>
      {!user && (
        <div className="grid-2">
          <Field id="authorName" label="Your name" error={errors.authorName}>
            <input id="authorName" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          </Field>
          <Field id="authorEmail" label="Your email (never shown)" error={errors.authorEmail}>
            <input
              id="authorEmail"
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
            />
          </Field>
        </div>
      )}
      <Field id="commentType" label="Type">
        <select id="commentType" value={type} onChange={(e) => setType(e.target.value as CommentType)}>
          {(Object.keys(COMMENT_TYPE_LABEL) as CommentType[]).map((t) => (
            <option key={t} value={t}>
              {COMMENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="commentText" label="Comment" error={errors.text} hint={<CharCounter value={text} max={MAX_COMMENT_LENGTH} />}>
        <textarea id="commentText" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <PhotoInput key={formKey} id="commentPhoto" label="Photo (optional)" value={photo} onChange={setPhoto} />
      {errors.form && (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send comment'}
      </button>
    </form>
  );
}
