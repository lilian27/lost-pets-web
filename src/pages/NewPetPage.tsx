import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Sex, Size, Species } from '../api/types';
import { CharCounter, Field } from '../components/Field';
import { PhotoInput } from '../components/PhotoInput';
import { MAX_VACCINES_LENGTH, SEX_LABEL, SIZE_LABEL, SPECIES_LABEL } from '../lib/constants';

interface Values {
  name: string;
  species: Species | '';
  sex: Sex | '';
  size: Size | '';
  color: string;
  vaccines: string;
  description: string;
}
type Errors = Partial<Record<keyof Values | 'photo' | 'form', string>>;

function Options<T extends string>({ labels, placeholder }: { labels: Record<T, string>; placeholder: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {(Object.keys(labels) as T[]).map((k) => (
        <option key={k} value={k}>
          {labels[k]}
        </option>
      ))}
    </>
  );
}

export function NewPetPage() {
  const navigate = useNavigate();
  const [v, setV] = useState<Values>({ name: '', species: '', sex: '', size: '', color: '', vaccines: '', description: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  function validate(): Errors {
    const e: Errors = {};
    if (!v.name.trim()) e.name = 'Name is required';
    if (!v.species) e.species = 'Species is required';
    if (!v.sex) e.sex = 'Sex is required';
    if (!v.size) e.size = 'Size is required';
    if (v.vaccines.length > MAX_VACCINES_LENGTH)
      e.vaccines = `Vaccines must be ${MAX_VACCINES_LENGTH} characters or fewer`;
    if (!photo) e.photo = 'Photo is required';
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.createPet({
        name: v.name,
        species: v.species as Species,
        sex: v.sex as Sex,
        size: v.size as Size,
        photo: photo as string,
        ...(v.color ? { color: v.color } : {}),
        ...(v.vaccines ? { vaccines: v.vaccines } : {}),
        ...(v.description ? { description: v.description } : {}),
      });
      navigate('/my-pets');
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel narrow" onSubmit={submit} noValidate>
      <h1>Add a pet</h1>
      <Field id="petName" label="Name" error={errors.name}>
        <input id="petName" value={v.name} onChange={set('name')} />
      </Field>
      <div className="grid-3">
        <Field id="species" label="Species" error={errors.species}>
          <select id="species" value={v.species} onChange={set('species')}>
            <Options labels={SPECIES_LABEL} placeholder="Select" />
          </select>
        </Field>
        <Field id="sex" label="Sex" error={errors.sex}>
          <select id="sex" value={v.sex} onChange={set('sex')}>
            <Options labels={SEX_LABEL} placeholder="Select" />
          </select>
        </Field>
        <Field id="size" label="Size" error={errors.size}>
          <select id="size" value={v.size} onChange={set('size')}>
            <Options labels={SIZE_LABEL} placeholder="Select" />
          </select>
        </Field>
      </div>
      <Field id="color" label="Color (optional)">
        <input id="color" value={v.color} onChange={set('color')} />
      </Field>
      <Field
        id="vaccines"
        label="Vaccines (optional)"
        error={errors.vaccines}
        hint={<CharCounter value={v.vaccines} max={MAX_VACCINES_LENGTH} />}
      >
        <textarea id="vaccines" rows={2} value={v.vaccines} onChange={set('vaccines')} />
      </Field>
      <Field id="description" label="Description (optional)">
        <textarea id="description" rows={3} value={v.description} onChange={set('description')} />
      </Field>
      <PhotoInput id="petPhoto" label="Photo" value={photo} onChange={setPhoto} error={errors.photo} />
      {errors.form && (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save pet'}
      </button>
    </form>
  );
}
