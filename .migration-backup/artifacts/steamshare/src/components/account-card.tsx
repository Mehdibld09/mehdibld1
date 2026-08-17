import { Link } from "wouter";
import { Account } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Coins, Heart, Gamepad2 } from "lucide-react";
import { UserBadge } from "@/components/user-badge";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  return (
    <Link href={`/accounts/${account.id}`} className="block group">
      <div
        className="bg-card hover:bg-secondary/40 border border-border hover:border-primary/40 rounded-xl transition-all duration-200 overflow-hidden"
        data-testid={`card-account-${account.id}`}
      >
        <div className="px-4 pt-4 pb-3 space-y-2">

          {/* Title */}
          <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors truncate">
            {account.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-1">{account.description}</p>

          {/* Games */}
          {account.games.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              <Gamepad2 className="h-3 w-3 text-muted-foreground shrink-0" />
              {account.games.slice(0, 4).map((game, i) => (
                <span key={i} className="text-[11px] text-muted-foreground">{i > 0 ? "· " : ""}{game}</span>
              ))}
              {account.games.length > 4 && (
                <span className="text-[11px] text-muted-foreground">+{account.games.length - 4} more</span>
              )}
            </div>
          )}

          {/* Bottom row: cost + user + stats */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            {/* Cost */}
            <div className="shrink-0">
              {account.pointsCost === 0 ? (
                <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs px-2">Free</Badge>
              ) : (
                <div className="flex items-center gap-1 text-primary font-bold text-xs">
                  <Coins className="h-3 w-3" />
                  {account.pointsCost} pts
                </div>
              )}
            </div>

            {/* User + stats */}
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-5 w-5 border border-border shrink-0">
                <AvatarImage src={account.posterAvatarUrl || "/default-avatar.png"} />
                <AvatarFallback className="text-[9px] bg-secondary">
                  {(account.posterUsername?.substring(0, 2) ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {(account as any).posterNameColor === "rainbow" ? (
                <span className="rainbow-text text-xs font-medium truncate max-w-[80px]">{account.posterUsername}</span>
              ) : (account as any).posterNameColor === "fire" ? (
                <span className="fire-text text-xs font-medium truncate max-w-[80px]">{account.posterUsername}</span>
              ) : (account as any).posterNameColor === "ocean" ? (
                <span className="ocean-text text-xs font-medium truncate max-w-[80px]">{account.posterUsername}</span>
              ) : (account as any).posterNameColor === "galaxy" ? (
                <span className="galaxy-text text-xs font-medium truncate max-w-[80px]">{account.posterUsername}</span>
              ) : (account as any).posterNameColor === "neon" ? (
                <span className="neon-text text-xs font-medium truncate max-w-[80px]">{account.posterUsername}</span>
              ) : (account as any).posterNameColor === "gold" ? (
                <span className="gold-text text-xs font-medium truncate max-w-[80px]">{account.posterUsername}</span>
              ) : (
                <span
                  className="text-xs font-medium truncate max-w-[80px]"
                  style={(account as any).posterNameColor ? { color: (account as any).posterNameColor } : undefined}
                >
                  {account.posterUsername}
                </span>
              )}
              <UserBadge badgeType={(account as any).posterBadgeType} size={14} />
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Heart className={`h-3 w-3 ${account.userHasLiked ? "text-red-500 fill-red-500" : ""}`} />
                <span>{account.likesCount}</span>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                {formatDistanceToNow(new Date(account.createdAt))} ago
              </span>
            </div>
          </div>

        </div>
      </div>
    </Link>
  );
}
