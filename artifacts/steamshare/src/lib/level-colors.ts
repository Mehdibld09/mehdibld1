export function getLevelColor(level: number): string {
  const tier = Math.floor((level - 1) / 10);
  const colors = [
    "#94a3b8",
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#f97316",
    "#eab308",
    "#ef4444",
    "#ec4899",
    "#06b6d4",
    "#f59e0b", // tier  9: Immortal     (91-100)
    "#a78bfa", // tier 10: Transcendent (101-110) — soft violet
    "#f43f5e", // tier 11: Godlike      (111-120) — rose red
    "#34d399", // tier 12: Eternal      (121-130) — emerald
    "#60a5fa", // tier 13: Celestial    (131-140) — sky blue
    "#fb923c", // tier 14: Sovereign    (141-150) — vivid orange
    "#e879f9", // tier 15: Infinite     (151-160) — fuchsia
    "#2dd4bf", // tier 16: Primordial   (161-170) — teal
    "#facc15", // tier 17: Cosmic       (171-180) — yellow
    "#f87171", // tier 18: Ascendant    (181-190) — coral
    "#4ade80", // tier 19: Supreme      (191-200) — bright green
    "#c084fc", // tier 20: Legendary    (201-210) — purple orchid
    "#38bdf8", // tier 21: Mythbreaker  (211-220) — light cyan
    "#fde68a", // tier 22: Apex         (221-230) — pale gold
    "#86efac", // tier 23: Pinnacle     (231-240) — mint
    "#fca5a5", // tier 24: Transcended  (241-250) — soft coral
    "#818cf8", // tier 25: Omega        (251+)    — indigo
  ];
  return colors[Math.min(tier, colors.length - 1)];
}

export function getLevelLabel(level: number): string {
  const tier = Math.floor((level - 1) / 10);
  const labels = [
    "Newcomer",
    "Rookie",
    "Regular",
    "Veteran",
    "Expert",
    "Elite",
    "Master",
    "Legend",
    "Mythic",
    "Immortal",
    "Transcendent",
    "Godlike",
    "Eternal",
    "Celestial",
    "Sovereign",
    "Infinite",
    "Primordial",
    "Cosmic",
    "Ascendant",
    "Supreme",
    "Legendary",
    "Mythbreaker",
    "Apex",
    "Pinnacle",
    "Transcended",
    "Omega",
  ];
  return labels[Math.min(tier, labels.length - 1)];
}
