import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, errorMessage } from '../api/client';
import type { Pet } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { Field } from '../components/Field';
import { COMMUNES, SEX_LABEL, SIZE_LABEL, SPECIES_LABEL } from '../lib/constants';

export const ACTIVE_EXISTS_WARNING =
  'This pet already has an active publication. Mark it as found before publishing a new one.';

function PublishForm({ pet, onCancel }: { pet: Pet; onCancel: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [commune, setCommune] = useState(user?.commune ?? '');
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!commune) return setError('Commune is required');
    setError(null);
    try {
      const pub = await api.createPublication({
        petId: pet.id,
        commune,
        ...(description ? { description } : {}),
        ...(lastSeenAddress ? { lastSeenAddress } : {}),
      });
      navigate(`/publications/${pub.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setWarning(ACTIVE_EXISTS_WARNING);
      else setError(errorMessage(err));
    }
  }

  return (
    <form className="publish-form" onSubmit={submit} noValidate aria-label={`Report ${pet.name} as lost`}>
      <p className="muted">The date and time of the report are recorded automatically.</p>
      <Field id={`commune-${pet.id}`} label="Commune where lost" error={error}>
        <select id={`commune-${pet.id}`} value={commune} onChange={(e) => setCommune(e.target.value)}>
          <option value="">Select a commune</option>
          {COMMUNES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field id={`address-${pet.id}`} label="Last seen near (optional)">
        <input id={`address-${pet.id}`} value={lastSeenAddress} onChange={(e) => setLastSeenAddress(e.target.value)} />
      </Field>
      <Field id={`desc-${pet.id}`} label="Details (optional)">
        <textarea id={`desc-${pet.id}`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {warning && (
        <p className="warning" role="alert" data-testid="publish-warning">
          {warning}
        </p>
      )}
      <div className="row">
        <button type="submit">Publish</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function MyPetsPage() {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPets()
      .then(setPets)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <section>
      <div className="row space-between">
        <h1>My pets</h1>
        <Link className="button" to="/pets/new">
          Add pet
        </Link>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {pets && pets.length === 0 && <p className="muted">You have not added any pets yet.</p>}
      <ul className="pet-list">
        {pets?.map((pet) => (
          <li key={pet.id} className="panel pet-item" data-testid="pet-item">
            <img className="pet-thumb" src={pet.photo} alt={pet.name} />
            <div className="pet-info">
              <h2>{pet.name}</h2>
              <p className="muted">
                {SPECIES_LABEL[pet.species]} · {SEX_LABEL[pet.sex]} · {SIZE_LABEL[pet.size]}
              </p>
              {pet.vaccines && <p className="muted">Vaccines: {pet.vaccines}</p>}
              {publishing === pet.id ? (
                <PublishForm pet={pet} onCancel={() => setPublishing(null)} />
              ) : (
                <button type="button" onClick={() => setPublishing(pet.id)}>
                  Report as lost
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
