export type UserRole = 'patient' | 'admin';

export type ClinicalRole = 'doctor' | 'nurse' | 'clinician' | '';

export type AppUser = {
  id?: string;
  email: string;
  name: string;
  phone?: string | null;
  role: UserRole;
  clinicalRole?: ClinicalRole | null;
  created_at?: string;
  avatar_url?: string | null;
};

const USER_STORAGE_KEY = 'user';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getFullNameFromUser(user: Record<string, unknown>) {
  const fullName = user.full_name;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const name = typeof user.name === 'string' ? user.name.trim() : '';

  return name || [firstName, lastName].filter(Boolean).join(' ').trim();
}

export function normalizeUser(rawUser: unknown): AppUser | null {
  if (!rawUser || typeof rawUser !== 'object') {
    return null;
  }

  const user = rawUser as Record<string, unknown>;
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  if (!email) {
    return null;
  }

  const roleValue = typeof user.role === 'string' ? user.role.toLowerCase() : '';
  const clinicalRoleValue = typeof user.clinicalRole === 'string'
    ? user.clinicalRole
    : typeof user.clinical_role === 'string'
      ? user.clinical_role
      : null;

  return {
    id: typeof user.id === 'string' || typeof user.id === 'number' ? String(user.id) : undefined,
    email,
    name: getFullNameFromUser(user) || email,
    phone: typeof user.phone === 'string' ? user.phone : null,
    role: roleValue === 'admin' ? 'admin' : 'patient',
    clinicalRole: clinicalRoleValue === 'doctor' || clinicalRoleValue === 'nurse' || clinicalRoleValue === 'clinician'
      ? clinicalRoleValue
      : null,
    created_at: typeof user.created_at === 'string' ? user.created_at : undefined,
    avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : null,
  };
}

export function getStoredUser(): AppUser | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) {
      return null;
    }

    return normalizeUser(JSON.parse(rawUser));
  } catch {
    return null;
  }
}

export function saveUserSession(rawUser: unknown) {
  if (!isBrowser()) {
    return null;
  }

  const user = normalizeUser(rawUser);
  if (!user) {
    return null;
  }

  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}

export function clearUserSession() {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Browser storage can be blocked; logout should still continue gracefully.
  }
}

export function isAdminUser(user: AppUser | null) {
  return user?.role === 'admin' && ['doctor', 'nurse', 'clinician'].includes(user.clinicalRole || '');
}

export function getUserHomePath(user: AppUser | null) {
  return user?.role === 'admin' ? '/admin' : '/dashboard/risk-assessment';
}
