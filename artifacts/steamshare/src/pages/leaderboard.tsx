import { Layout } from "@/components/layout";
import { useGetLeaderboard, useGetMe } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Trophy, Medal, Crown, Star, Shield, ArrowLeft } from "lucide-react";
import { getLevelColor } from "@/lib/level-colors";
import { useQuery } from "@tanstack/react-query";
import { UserBadge } from "@/components/user-badge";

async function fetchMyRank() {
  const res = await fetch("/api/users/leaderboard/rank", { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<{ rank: number; xp: number }>;
}

export default function Leaderboard() {
  const { data: users, isLoading } = useGetLeaderboard({ limit: 10 });
  const { data: me } = useGetMe();
  const { data: myRank } = useQuery({
    queryKey: ["my-rank"],
    queryFn: fetchMyRank,
    enabled: !!me,
  });

  const rankColors = [
    "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    "text-slate-300 bg-slate-300/10 border-slate-300/20",
    "text-amber-600 bg-amber-600/10 border-amber-600/20",
  ];

  const meInTop10 = me && users?.some((u) => Number(u.id) === Number((me as any).id));
  const showMyRow = me && myRank && !meInTop10;

  function UserRow({ user, index, highlight = false }: { user: any; index: number; highlight?: boolean }) {
    const isTop3 = index < 3;
    const levelColor = getLevelColor(user.level);
    const isAdmin = user.isAdmin;
    const isModerator = user.isModerator;

    return (
      <Link
        href={`/profile/${user.id}`}
        className={`grid grid-cols-12 gap-2 sm:gap-4 p-3 sm:p-4 items-center hover:bg-muted/50 transition-colors group ${highlight ? "bg-primary/5 border-t-2 border-primary/30" : ""}`}
      >
        <div className="col-span-2 sm:col-span-1 text-center font-bold">
          {isTop3 && !highlight ? (
            <div className={`mx-auto w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border ${rankColors[index]}`}>
              {index === 0 ? <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : index === 1 ? <Medal className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </div>
          ) : (
            <span className={`text-sm sm:text-base ${highlight ? "text-primary font-black" : "text-muted-foreground group-hover:text-foreground transition-colors"}`}>
              #{highlight ? myRank?.rank : index + 1}
            </span>
          )}
        </div>

        <div className="col-span-7 sm:col-span-7 flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="rounded-full p-[2px] shrink-0" style={{ background: levelColor }}>
            <Avatar className="h-7 w-7 sm:h-9 sm:w-9 border-2 border-background">
              <AvatarImage src={user.avatarUrl || "/default-avatar.png"} />
              <AvatarFallback className="text-xs">{(user.username?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {user.nameColor === "rainbow" ? (
              <span className={`rainbow-text font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none`}>
                {user.displayName || user.username}
                {highlight && <span className="text-xs ml-1">(you)</span>}
              </span>
            ) : user.nameColor === "fire" ? (
              <span className="fire-text font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{user.displayName || user.username}{highlight && <span className="text-xs ml-1">(you)</span>}</span>
            ) : user.nameColor === "ocean" ? (
              <span className="ocean-text font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{user.displayName || user.username}{highlight && <span className="text-xs ml-1">(you)</span>}</span>
            ) : user.nameColor === "galaxy" ? (
              <span className="galaxy-text font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{user.displayName || user.username}{highlight && <span className="text-xs ml-1">(you)</span>}</span>
            ) : user.nameColor === "neon" ? (
              <span className="neon-text font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{user.displayName || user.username}{highlight && <span className="text-xs ml-1">(you)</span>}</span>
            ) : user.nameColor === "gold" ? (
              <span className="gold-text font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{user.displayName || user.username}{highlight && <span className="text-xs ml-1">(you)</span>}</span>
            ) : (
              <span
                className={`font-semibold text-sm sm:text-base truncate max-w-[100px] sm:max-w-none ${highlight ? "text-primary" : "group-hover:text-primary transition-colors"}`}
                style={user.nameColor ? { color: user.nameColor } : undefined}
              >
                {user.displayName || user.username}
                {highlight && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
              </span>
            )}
            <UserBadge badgeType={user.badgeType} size={14} />
            {isAdmin && (
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-[9px] sm:text-[10px] flex items-center gap-0.5 h-4 px-1">
                <Shield className="h-2 w-2 sm:h-2.5 sm:w-2.5" />ADMIN
              </Badge>
            )}
            {isModerator && !isAdmin && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[9px] sm:text-[10px] flex items-center gap-0.5 h-4 px-1">
                <Shield className="h-2 w-2 sm:h-2.5 sm:w-2.5" />MOD
              </Badge>
            )}
          </div>
        </div>

        <div className="col-span-3 sm:col-span-2 hidden sm:flex text-center justify-center">
          <Badge variant="secondary" className="font-mono text-xs" style={{ color: levelColor, borderColor: `${levelColor}40` }}>
            LVL {user.level}
          </Badge>
        </div>

        <div className="col-span-3 sm:col-span-2 text-right font-mono font-medium text-primary text-xs sm:text-sm">
          {Number(user.xp).toLocaleString()} <span className="text-muted-foreground text-[10px] sm:text-xs">XP</span>
        </div>
      </Link>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
        <button onClick={() => window.history.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">Top 10 Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Ranked by total XP earned</p>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-12 gap-2 sm:gap-4 p-3 sm:p-4 border-b border-border bg-muted/50 text-xs sm:text-sm font-semibold text-muted-foreground">
            <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
            <div className="col-span-7">User</div>
            <div className="col-span-3 sm:col-span-2 text-center hidden sm:block">Level</div>
            <div className="col-span-3 sm:col-span-2 text-right">XP</div>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center">
                  <div className="col-span-12"><Skeleton className="h-10 w-full" /></div>
                </div>
              ))
            ) : (
              users?.slice(0, 10).map((user, index) => (
                <UserRow key={user.id} user={user} index={index} />
              ))
            )}
          </div>

          {/* Current user row if not in top 10 */}
          {showMyRow && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-t border-border">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">Your Position</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <UserRow user={me} index={-1} highlight />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
