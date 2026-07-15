import type { ImageSourcePropType } from 'react-native';

export type AvatarId =
  | 'moon'
  | 'sun'
  | 'starweaver'
  | 'crystal'
  | 'palm'
  | 'saturn'
  | 'nebula'
  | 'comet'
  | 'lotus'
  | 'owl';

export type AvatarOption = {
  id: AvatarId;
  label: string;
  source: ImageSourcePropType;
};

/** Fixed cartoon astrology profile pictures available in Profile. */
export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'moon', label: 'Moon', source: require('../assets/avatars/avatar-moon.png') },
  { id: 'sun', label: 'Sun', source: require('../assets/avatars/avatar-sun.png') },
  { id: 'starweaver', label: 'Starweaver', source: require('../assets/avatars/avatar-starweaver.png') },
  { id: 'crystal', label: 'Crystal', source: require('../assets/avatars/avatar-crystal.png') },
  { id: 'palm', label: 'Palm', source: require('../assets/avatars/avatar-palm.png') },
  { id: 'saturn', label: 'Saturn', source: require('../assets/avatars/avatar-saturn.png') },
  { id: 'nebula', label: 'Nebula', source: require('../assets/avatars/avatar-nebula.png') },
  { id: 'comet', label: 'Comet', source: require('../assets/avatars/avatar-comet.png') },
  { id: 'lotus', label: 'Lotus', source: require('../assets/avatars/avatar-lotus.png') },
  { id: 'owl', label: 'Owl', source: require('../assets/avatars/avatar-owl.png') },
];

const AVATAR_BY_ID = Object.fromEntries(AVATAR_OPTIONS.map((a) => [a.id, a])) as Record<
  AvatarId,
  AvatarOption
>;

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && value in AVATAR_BY_ID;
}

export function getAvatarOption(id?: string | null): AvatarOption | undefined {
  if (!isAvatarId(id)) return undefined;
  return AVATAR_BY_ID[id];
}
