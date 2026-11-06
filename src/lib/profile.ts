// Profile updates. PATCH /user/update accepts a partial set of editable fields
// (name, phone, country) and returns the refreshed user. country must be a
// supported ISO alpha-2 code (the server validates it).
import { api } from './api';
import { AuthUser } from '@/types/api';

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  country?: string;
}

export async function updateProfile(update: ProfileUpdate): Promise<AuthUser> {
  const res = await api.patch<{ data: { user: AuthUser } }>(
    '/user/update',
    update,
    { retry: false },
  );
  return res.data.user;
}
