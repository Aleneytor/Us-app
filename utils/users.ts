import type { UserData } from '../types';

export const FALLBACK_USER: UserData = {
  name: 'Usuario',
  initials: '?',
  color: '#6B7280',
  bg: '#F3F4F6',
};

export function getUserData(users: Record<string, UserData>, uid?: string | null): UserData {
  if (uid && users[uid]) {
    const rawUser = users[uid];
    return {
      ...rawUser,
      name: rawUser.name ? rawUser.name.trim().split(/\s+/)[0].replace(/\.+$/, '') : FALLBACK_USER.name,
    };
  }
  if (!uid) return FALLBACK_USER;

  const clean = uid.trim();
  const name = clean || FALLBACK_USER.name;
  return {
    ...FALLBACK_USER,
    name: name.split(/\s+/)[0].replace(/\.+$/, ''),
    initials: (clean.slice(0, 2) || '?').toUpperCase(),
  };
}

export function getPartnerId(partnerForUser: Record<string, string>, uid: string): string {
  return partnerForUser[uid] ?? uid;
}
