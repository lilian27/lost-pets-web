import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { fileToDataUrl, validatePhoto } from '../lib/image';
import { Field } from './Field';

interface PhotoInputProps {
  id: string;
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  error?: string | null;
}

export function PhotoInput({ id, label, value, onChange, error }: PhotoInputProps) {
  const [fileError, setFileError] = useState<string | null>(null);

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileError(null);
      onChange(null);
      return;
    }
    const problem = validatePhoto(file);
    if (problem) {
      setFileError(problem);
      onChange(null);
      e.target.value = '';
      return;
    }
    setFileError(null);
    onChange(await fileToDataUrl(file));
  }

  return (
    <Field id={id} label={label} error={fileError ?? error} hint="PNG, JPEG, GIF or WebP, max 2MB">
      <input id={id} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handle} />
      {value && <img className="photo-preview" src={value} alt="Selected photo preview" />}
    </Field>
  );
}
