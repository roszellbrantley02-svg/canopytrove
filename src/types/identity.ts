export type CanopyTroveAuthSessionStatus =
  | 'disabled'
  | 'checking'
  | 'signed-out'
  | 'anonymous'
  | 'authenticated';

export type CanopyTroveAuthSession = {
  status: CanopyTroveAuthSessionStatus;
  uid: string | null;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
};
