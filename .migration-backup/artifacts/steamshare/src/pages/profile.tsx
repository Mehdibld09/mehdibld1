import { Layout } from "@/components/layout";
import { useGetUser, useGetUserAccounts, useGetMe, getGetUserQueryKey, getGetUserAccountsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/account-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Heart, Gamepad2, Award, Ban, Shield, MessageCircle, Coins, Settings, ArrowLeft } from "lucide-react";
import { UserBadge } from "@/components/user-badge";
import { format } from "date-fns";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getLevelColor } from "@/lib/level-colors";

async function banUser(userId: number, durationHours: number | null, reason: string) {
  const res = await fetch(`/api/admin/users/${userId}/ban`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationHours, reason }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function unbanUser(userId: number) {
  const res = await fetch(`/api/admin/users/${userId}/ban`, { method: "DELETE", credentials: "include" });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

const BAN_DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "1 month", hours: 720 },
  { label: "Permanent", hours: null },
];

export default function Profile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: user, isLoading: userLoading } = useGetUser(id, { query: { queryKey: getGetUserQueryKey(id), enabled: !!id } });
  const { data: accounts, isLoading: accountsLoading } = useGetUserAccounts(id, { query: { queryKey: getGetUserAccountsQueryKey(id), enabled: !!id } });
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [banOpen, setBanOpen] = useState(false);
  const [banDuration, setBanDuration] = useState<number | null>(24);
  const [banReason, setBanReason] = useState("");

  const xpProgress = user ? (user.xp % 100) : 0;
  const canManage = me && (me.isAdmin || (me as any).isModerator) && me.id !== id;
  const isOwn = me?.id === id;

  const banMutation = useMutation({
    mutationFn: () => banUser(id, banDuration, banReason),
    onSuccess: () => {
      setBanOpen(false);
      setBanReason("");
      queryClient.invalidateQueries({ queryKey: [`/api/users/${id}`] });
      toast({ title: "User banned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: () => unbanUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${id}`] });
      toast({ title: "User unbanned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (userLoading) return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </Layout>
  );

  if (!user) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">User Not Found</h2>
      </div>
    </Layout>
  );

  const levelColor = getLevelColor(user.level);
  const displayedName = (user as any).displayName || user.username;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-5">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* ── Profile Card ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top section: avatar + name */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6">
            {/* Avatar with level-colored border */}
            <div className="relative shrink-0">
              <div
                className="rounded-full p-[3px]"
                style={{ background: levelColor, boxShadow: `0 0 16px ${levelColor}55` }}
              >
                <Avatar className="h-24 w-24 sm:h-20 sm:w-20 border-2 border-background shadow-lg">
                  <AvatarImage src={user.avatarUrl || "/default-avatar.png"} />
                  <AvatarFallback className="text-3xl sm:text-2xl bg-secondary">
                    {(user.username?.substring(0, 2) ?? "").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              {/* Level badge */}
              <div
                className="absolute -bottom-1 -right-1 text-white text-xs font-black rounded-full w-7 h-7 flex items-center justify-center shadow"
                style={{ background: levelColor }}
              >
                {user.level}
              </div>
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl sm:text-xl font-black mb-1.5 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                {(user as any).nameColor === "rainbow" ? (
                  <span className="rainbow-text">{displayedName}</span>
                ) : (user as any).nameColor === "fire" ? (
                  <span className="fire-text">{displayedName}</span>
                ) : (user as any).nameColor === "ocean" ? (
                  <span className="ocean-text">{displayedName}</span>
                ) : (user as any).nameColor === "galaxy" ? (
                  <span className="galaxy-text">{displayedName}</span>
                ) : (user as any).nameColor === "neon" ? (
                  <span className="neon-text">{displayedName}</span>
                ) : (user as any).nameColor === "gold" ? (
                  <span className="gold-text">{displayedName}</span>
                ) : (
                  <span style={(user as any).nameColor ? { color: (user as any).nameColor } : undefined}>
                    {displayedName}
                  </span>
                )}
                <UserBadge badgeType={(user as any).badgeType} size={20} />
                {(user as any).displayName && (
                  <span className="text-xs text-muted-foreground font-normal">@{user.username}</span>
                )}
                {user.isBanned && <Badge variant="destructive" className="text-xs">BANNED</Badge>}
                {(user as any).isAdmin && (
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-xs flex items-center gap-1">
                    <Shield className="h-3 w-3" />ADMIN
                  </Badge>
                )}
                {(user as any).isModerator && !((user as any).isAdmin) && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-xs flex items-center gap-1">
                    <Shield className="h-3 w-3" />MOD
                  </Badge>
                )}
              </h1>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Joined {format(new Date(user.createdAt), "MMMM yyyy")}
                </span>
                {user.badgeName && (
                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-xs flex items-center gap-1">
                    <Award className="h-3 w-3" /> {user.badgeName}
                  </Badge>
                )}
              </div>

              {/* XP bar */}
              <div className="max-w-xs mx-auto sm:mx-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold" style={{ color: levelColor }}>Level {user.level}</span>
                  <span className="text-xs font-mono" style={{ color: levelColor }}>{user.xp} XP</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${xpProgress}%`, background: levelColor }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{100 - xpProgress} XP to next level</div>
              </div>
            </div>

            {/* Edit button (own profile, desktop) */}
            {isOwn && (
              <Link href="/edit-profile" className="hidden sm:block shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" /> Edit
                </Button>
              </Link>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
            <div className="flex flex-col items-center py-4 px-3">
              <Gamepad2 className="h-4 w-4 text-primary mb-1" />
              <span className="text-lg font-bold">{user.totalAccounts}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Uploads</span>
            </div>
            <div className="flex flex-col items-center py-4 px-3">
              <Heart className="h-4 w-4 text-red-500 mb-1" />
              <span className="text-lg font-bold">{user.totalLikesReceived}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Likes</span>
            </div>
            <div className="flex flex-col items-center py-4 px-3">
              <Coins className="h-4 w-4 text-amber-500 mb-1" />
              <span className="text-lg font-bold">{user.points}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Points</span>
            </div>
          </div>

          {/* Action buttons */}
          {(isOwn || canManage || (me && me.id !== id)) && (
            <div className="flex flex-wrap gap-2 px-6 pb-5 pt-4 border-t border-border">
              {isOwn && (
                <Link href="/edit-profile" className="sm:hidden">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Settings className="h-3.5 w-3.5" /> Edit Profile
                  </Button>
                </Link>
              )}

              {me && me.id !== id && (
                <Link href={`/messages?user=${id}&username=${encodeURIComponent(user.username)}`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> Message
                  </Button>
                </Link>
              )}

              {canManage && (
                <>
                  {!user.isBanned ? (
                    <Dialog open={banOpen} onOpenChange={setBanOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5">
                          <Ban className="h-3.5 w-3.5" /> Ban
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border max-w-sm">
                        <DialogHeader><DialogTitle>Ban {displayedName}</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Duration</label>
                            <div className="grid grid-cols-3 gap-2">
                              {BAN_DURATIONS.map((d) => (
                                <button
                                  key={d.label}
                                  onClick={() => setBanDuration(d.hours)}
                                  className={`text-xs border rounded-lg px-2 py-2 font-medium transition-colors ${banDuration === d.hours ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Reason</label>
                            <Input placeholder="Reason for ban..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                          </div>
                          <Button variant="destructive" className="w-full" onClick={() => banMutation.mutate()} disabled={!banReason || banMutation.isPending}>
                            {banMutation.isPending ? "Banning..." : "Confirm Ban"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-600/30" onClick={() => unbanMutation.mutate()} disabled={unbanMutation.isPending}>
                      <Ban className="h-3.5 w-3.5" /> Unban
                    </Button>
                  )}

                  {me.isAdmin && (
                    <Link href={`/admin?tab=users&id=${id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Coins className="h-3.5 w-3.5" /> Manage Points
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Upload History ── */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-sm inline-block" />
            Upload History
          </h2>
          {accountsLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : accounts?.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border border-dashed rounded-xl">
              <p className="text-muted-foreground text-sm">No uploads yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {accounts?.map(account => <AccountCard key={account.id} account={account} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
