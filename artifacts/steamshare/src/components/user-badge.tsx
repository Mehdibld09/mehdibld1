import { Medal, Star, Gem, Crown, Flame, Shield, Sparkles, Zap } from "lucide-react";

interface UserBadgeProps {
  badgeType?: string | null;
  size?: number;
}

export const BADGE_OPTIONS = [
  { key: "gold",    label: "Gold",    title: "Premium Member", pro: false },
  { key: "star",    label: "Star",    title: "Premium Star",   pro: false },
  { key: "vip",     label: "VIP",     title: "Pro VIP",        pro: true  },
  { key: "crown",   label: "Crown",   title: "Pro Crown",      pro: true  },
  { key: "fire",    label: "Fire",    title: "Pro Fire",       pro: true  },
  { key: "shield",  label: "Shield",  title: "Pro Shield",     pro: true  },
  { key: "diamond", label: "Diamond", title: "Pro Diamond",    pro: true  },
  { key: "bolt",    label: "Bolt",    title: "Pro Bolt",       pro: true  },
];

const BADGE_ICONS: Record<string, { icon: React.ElementType; className: string }> = {
  gold:    { icon: Medal,    className: "text-yellow-400" },
  star:    { icon: Star,     className: "text-yellow-300" },
  vip:     { icon: Gem,      className: "text-purple-400" },
  crown:   { icon: Crown,    className: "text-yellow-500" },
  fire:    { icon: Flame,    className: "text-orange-500" },
  shield:  { icon: Shield,   className: "text-blue-400"   },
  diamond: { icon: Sparkles, className: "text-cyan-400"   },
  bolt:    { icon: Zap,      className: "text-yellow-300" },
};

export function UserBadge({ badgeType, size = 16 }: UserBadgeProps) {
  if (!badgeType) return null;

  const config = BADGE_ICONS[badgeType];
  if (!config) return null;

  const option = BADGE_OPTIONS.find((b) => b.key === badgeType);
  const Icon = config.icon;

  return (
    <Icon
      title={option?.title ?? badgeType}
      className={config.className}
      style={{ width: size, height: size, flexShrink: 0, display: "inline-block" }}
    />
  );
}
