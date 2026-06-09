import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

/**
 * Stitch designs use Material Symbols (underscore glyph names). React Native
 * ships MaterialIcons via @expo/vector-icons using hyphenated names, so this
 * wrapper lets screens use the exact Stitch glyph names (e.g. `auto_awesome`).
 */
type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export type IconName =
  | 'auto_awesome'
  | 'auto_fix_high'
  | 'front_hand'
  | 'task_alt'
  | 'favorite'
  | 'favorite_border'
  | 'person'
  | 'person_add'
  | 'menu'
  | 'menu_book'
  | 'chevron_right'
  | 'chevron_left'
  | 'arrow_back'
  | 'arrow_forward'
  | 'send'
  | 'mic'
  | 'check'
  | 'check_circle'
  | 'radio_button_unchecked'
  | 'work'
  | 'payments'
  | 'eco'
  | 'flag'
  | 'close'
  | 'notifications'
  | 'visibility'
  | 'psychology'
  | 'chat_bubble'
  | 'verified_user'
  | 'lock'
  | 'local_fire_department'
  | 'auto_graph'
  | 'spa'
  | 'settings'
  | 'logout'
  | 'star'
  | 'cloud_done'
  | 'encrypted'
  | 'devices'
  | 'mail';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
};

/** Stitch glyph names that do not map 1:1 to MaterialIcons hyphen names. */
const GLYPH_ALIASES: Partial<Record<IconName, MaterialIconName>> = {
  encrypted: 'enhanced-encryption',
};

export function Icon({ name, size = 24, color = '#e6e1e5', className }: IconProps) {
  const mapped = (GLYPH_ALIASES[name] ?? name.replace(/_/g, '-')) as MaterialIconName;
  return <MaterialIcons name={mapped} size={size} color={color} className={className} />;
}
