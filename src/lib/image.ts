import { MAX_PHOTO_BYTES } from './constants';

export const PHOTO_TOO_LARGE = 'Photo must be 2MB or smaller';
export const PHOTO_NOT_IMAGE = 'File must be an image (png, jpeg, gif or webp)';
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function validatePhoto(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return PHOTO_NOT_IMAGE;
  if (file.size > MAX_PHOTO_BYTES) return PHOTO_TOO_LARGE;
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
