import type { UserData } from '../types';

export const FALLBACK_USER: UserData = {
  name: 'Usuario',
  initials: '?',
  color: '#6B7280',
  bg: '#F3F4F6',
};

export function getUserData(users: Record<string, UserData>, uid?: string | null): UserData {
  if (uid && users[uid]) return users[uid];
  if (!uid) return FALLBACK_USER;

  const clean = uid.trim();
  return {
    ...FALLBACK_USER,
    name: clean || FALLBACK_USER.name,
    initials: (clean.slice(0, 2) || '?').toUpperCase(),
  };
}

export function getPartnerId(partnerForUser: Record<string, string>, uid: string): string {
  return partnerForUser[uid] ?? uid;
}
