export type Species = 'dog' | 'cat';
export type Sex = 'male' | 'female';
export type Size = 'small' | 'medium' | 'large';
export type PublicationStatus = 'active' | 'found';
export type CommentType = 'comment' | 'sighting' | 'possible_finding';

export interface User {
  id: string;
  alias: string;
  name: string;
  email: string;
  phone: string;
  commune: string;
}

export interface PublicUser {
  id: string;
  alias: string;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  sex: Sex;
  size: Size;
  color: string | null;
  vaccines: string | null;
  description: string | null;
  photo: string;
  createdAt: string;
}

export interface Publication {
  id: string;
  status: PublicationStatus;
  commune: string;
  description: string | null;
  lastSeenAddress: string | null;
  lostAt: string;
  foundAt: string | null;
  createdAt: string;
  owner: PublicUser;
  pet: Pet;
  isOwner: boolean;
}

export interface Comment {
  id: string;
  publicationId: string;
  type: CommentType;
  text: string;
  photo: string | null;
  isAnonymous: boolean;
  authorName: string;
  author: PublicUser | null;
  flagCount: number;
  flagged: boolean;
  flaggedByMe: boolean;
  edited: boolean;
  editedAt: string | null;
  createdAt: string;
  canEdit: boolean;
  editToken?: string;
}

export interface Notification {
  id: string;
  type: CommentType;
  message: string;
  read: boolean;
  publicationId: string;
  commentId: string;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface RegisterInput {
  alias: string;
  name: string;
  email: string;
  phone: string;
  commune: string;
  password: string;
}

export interface PetInput {
  name: string;
  species: Species;
  sex: Sex;
  size: Size;
  color?: string;
  vaccines?: string;
  description?: string;
  photo: string;
}

export interface PublicationInput {
  petId: string;
  commune: string;
  description?: string;
  lastSeenAddress?: string;
}

export interface CommentInput {
  text: string;
  type: CommentType;
  photo?: string;
  authorName?: string;
  authorEmail?: string;
}

export interface PublicationFilters {
  commune?: string;
  species?: Species | '';
}
