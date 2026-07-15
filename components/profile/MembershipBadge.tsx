import { PremiumBadge } from '@/components/profile/PremiumBadge';

type MembershipBadgeProps = {
  premium: boolean;
};

/** @deprecated Prefer PremiumBadge — kept for existing imports. */
export function MembershipBadge({ premium }: MembershipBadgeProps) {
  return <PremiumBadge premium={premium} />;
}
