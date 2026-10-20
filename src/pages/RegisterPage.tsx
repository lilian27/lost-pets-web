import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import type { RegisterInput } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { Field } from '../components/Field';
import { COMMUNES } from '../lib/constants';

type Errors = Partial<Record<keyof RegisterInput | 'form', string>>;
const EMPTY: RegisterInput = { alias: '', name: '', email: '', phone: '', commune: '', password: '' };

export function validateRegister(v: RegisterInput): Errors {
  const e: Errors = {};
  if (!/^[\w.-]{3,30}$/.test(v.alias)) e.alias = 'Alias must be 3-30 letters, numbers, dots, dashes or underscores';
  if (!v.name.trim()) e.name = 'Name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'A valid email is required';
  if (!/^\+?[0-9\s-]{7,20}$/.test(v.phone)) e.phone = 'A valid phone is required';
  if (!v.commune) e.commune = 'Commune is required';
  if (v.password.length < 6) e.password = 'Password must have at least 6 characters';
  return e;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<RegisterInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const set = (k: keyof RegisterInput) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validateRegister(values);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await register(values);
      navigate('/my-pets');
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  return (
    <form className="panel narrow" onSubmit={submit} noValidate>
      <h1>Create account</h1>
      <p className="muted">Only your alias is shown publicly. Name, email and phone stay private.</p>
      <Field id="alias" label="Alias (public)" error={errors.alias}>
        <input id="alias" value={values.alias} onChange={set('alias')} />
      </Field>
      <Field id="name" label="Full name" error={errors.name}>
        <input id="name" value={values.name} onChange={set('name')} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" type="email" value={values.email} onChange={set('email')} />
      </Field>
      <Field id="phone" label="Phone" error={errors.phone}>
        <input id="phone" type="tel" value={values.phone} onChange={set('phone')} />
      </Field>
      <Field id="commune" label="Commune" error={errors.commune}>
        <select id="commune" value={values.commune} onChange={set('commune')}>
          <option value="">Select a commune</option>
          {COMMUNES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <input id="password" type="password" value={values.password} onChange={set('password')} />
      </Field>
      {errors.form && (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit">Register</button>
    </form>
  );
}
