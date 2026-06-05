import { Text, View } from 'react-native';

type MembershipBadgeProps = {
  premium: boolean;
};

export function MembershipBadge({ premium }: MembershipBadgeProps) {
  return (
    <View
      className={
        premium
          ? 'self-start rounded-full border border-stitch-signal/40 bg-stitch-signal/15 px-3 py-1.5'
          : 'self-start rounded-full border border-white/20 bg-white/8 px-3 py-1.5'
      }>
      <Text
        className={
          premium
            ? 'font-space-grotesk text-[10px] font-semibold uppercase tracking-[0.2em] text-stitch-signal'
            : 'font-space-grotesk text-[10px] font-semibold uppercase tracking-[0.2em] text-md-on-surface-variant'
        }>
        {premium ? 'Premium' : 'Free preview'}
      </Text>
    </View>
  );
}
