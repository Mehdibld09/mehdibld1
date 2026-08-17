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
    "#e2e8f0",
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
  ];
  return labels[Math.min(tier, labels.length - 1)];
}
