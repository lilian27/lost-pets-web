import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { Field } from '../components/Field';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return setError('Email and password are required');
    try {
      await login(email, password);
      navigate(params.get('next') ?? '/');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="panel narrow" onSubmit={submit} noValidate>
      <h1>Log in</h1>
      <Field id="email" label="Email">
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="password" label="Password">
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Log in</button>
      <p className="muted">
        No account? <Link to="/register">Register</Link>
      </p>
    </form>
  );
}
