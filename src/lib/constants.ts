import type { CommentType, Sex, Size, Species } from '../api/types';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_VACCINES_LENGTH = 200;
export const MAX_COMMENT_LENGTH = 300;

export const COMMUNES = [
  'Cerrillos',
  'Estación Central',
  'Independencia',
  'La Florida',
  'La Reina',
  'Las Condes',
  'Lo Barnechea',
  'Macul',
  'Maipú',
  'Ñuñoa',
  'Peñalolén',
  'Providencia',
  'Pudahuel',
  'Puente Alto',
  'Quilicura',
  'Recoleta',
  'San Bernardo',
  'San Miguel',
  'Santiago',
  'Vitacura',
];

export const SPECIES_LABEL: Record<Species, string> = { dog: 'Dog', cat: 'Cat' };
export const SEX_LABEL: Record<Sex, string> = { male: 'Male', female: 'Female' };
export const SIZE_LABEL: Record<Size, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};
export const COMMENT_TYPE_LABEL: Record<CommentType, string> = {
  comment: 'Comment',
  sighting: 'Sighting',
  possible_finding: 'Possible finding',
};
