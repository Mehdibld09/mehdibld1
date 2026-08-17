import { Link } from "wouter";
import { Account } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Coins, Eye, Gamepad2, MoreVertical, Pin, PinOff } from "lucide-react";
import { UserBadge } from "@/components/user-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountCardProps {
  account: Account;
  isAdmin?: boolean;
  onPin?: (accountId: number) => void;
  onUnpin?: (accountId: number) => void;
}

export function AccountCard({ account, isAdmin, onPin, onUnpin }: AccountCardProps) {
  const isPinned = (account as any).isPinned as boolean | undefined;

  return (
    <div className="relative group">
      <Link href={`/accounts/${account.id}`} className="block">
        <div
          className="bg-card hover:bg-secondary/40 border border-border hover:border-primary/40 rounded-xl transition-all duration-200 overflow-hidden"
          data-testid={`card-account-${account.id}`}
        >
          <div className="px-4 pt-4 pb-3 space-y-2">

            {/* Title row with pinned indicator */}
            <div className="flex items-center gap-2 pr-7">
              {isPinned && (
                <Pin className="h-3 w-3 text-primary shrink-0 rotate-45" />
              )}
              <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors truncate">
                {account.title}
              </h3>
            </div>

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
                  <Eye className="h-3 w-3" />
                  <span>{(account as any).viewCount ?? 0}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                  {formatDistanceToNow(new Date(account.createdAt))} ago
                </span>
              </div>
            </div>

          </div>
        </div>
      </Link>

      {/* Admin 3-dot menu — outside the Link so clicks don't navigate */}
      {isAdmin && (
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(e) => e.preventDefault()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                aria-label="Account options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {isPinned ? (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onUnpin?.(account.id); }}
                  className="gap-2 cursor-pointer"
                >
                  <PinOff className="h-3.5 w-3.5" />
                  Unpin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onPin?.(account.id); }}
                  className="gap-2 cursor-pointer"
                >
                  <Pin className="h-3.5 w-3.5" />
                  Pin to top
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
