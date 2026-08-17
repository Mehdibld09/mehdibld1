import { Layout } from "@/components/layout";
import {
  useGetAccount,
  getGetAccountQueryKey,
  useLikeAccount,
  useUnlikeAccount,
  useClaimAccount,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  useLikeComment,
  useUnlikeComment,
  useDeleteComment,
  useDeleteAccount,
  useGetMe,
  getGetMeQueryKey,
  useGetUser,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Heart, Coins, MessageSquare, Trash, Lock,
  Copy, CheckCheck, ChevronDown, ChevronUp,
  Flag, Edit2, Check, X, MessageCircle, Eye, ArrowLeft, Star, RefreshCw, CornerDownRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserBadge } from "@/components/user-badge";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-sm break-all select-all">{value}</span>
        <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium">
        <span className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">≡</span> {title} ({items.length})</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="px-4 py-2 text-sm flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-xs">#{i + 1}</span>
              <span className="text-primary font-medium">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderAccountDescription(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted rounded px-0.5 font-mono text-xs">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-primary">$1</a>')
    .replace(/\n/g, "<br/>");
}

async function submitReport(targetType: string, targetId: number, reason: string, details: string) {
  const res = await fetch("/api/reports", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId, reason, details }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to report"); }
  return res.json();
}

async function patchAccount(accountId: number, data: Record<string, unknown>) {
  const res = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to update"); }
  return res.json();
}

export default function AccountDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { data: user } = useGetMe();
  const { data: account, isLoading: accountLoading } = useGetAccount(id, { query: { queryKey: getGetAccountQueryKey(id), refetchOnWindowFocus: false } });
  const { data: comments, isLoading: commentsLoading } = useListComments(id);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [commentContent, setCommentContent] = useState("");
  const [claimResult, setClaimResult] = useState<{ username: string; password: string } | null>(null);
  const [claimError, setClaimError] = useState("");
  const [likeError, setLikeError] = useState("");
  const [commentError, setCommentError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editGames, setEditGames] = useState("");
  const [editCost, setEditCost] = useState(0);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [commentReportId, setCommentReportId] = useState<number | null>(null);
  const [commentReportReason, setCommentReportReason] = useState("");
  const [commentReportDetails, setCommentReportDetails] = useState("");

  const [checkResult, setCheckResult] = useState<{ status: string; checkStatus: "live" | "dead" | "2fa" | "error"; lastCheckedAt: string } | null>(null);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const likeAccount = useLikeAccount();
  const unlikeAccount = useUnlikeAccount();
  const claimAccount = useClaimAccount();
  const createComment = useCreateComment();
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();
  const deleteAccount = useDeleteAccount();

  const checkHealthMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/accounts/${id}/check`, { method: "POST", credentials: "include" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Check failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      // Derive checkStatus from raw status if backend didn't send it
      const cs: string =
        data.checkStatus && data.checkStatus !== "error"
          ? data.checkStatus
          : data.status === "valid" ? "live"
          : data.status === "invalid" ? "dead"
          : "error"; // keep "error" explicit so badge doesn't fall back to old DB status
      setCheckResult({ status: data.status, checkStatus: cs as any, lastCheckedAt: data.lastCheckedAt });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
      const label = cs === "live" ? "Live ✓" : cs === "dead" ? "Dead ✗" : cs === "2fa" ? "2FA (valid creds)" : data.status === "rate_limited" ? "Rate limited — try again later" : data.status === "error" ? "Could not reach Steam" : data.status;
      toast({ title: "Health check complete", description: `Status: ${label}` });
    },
    onError: (e: any) => toast({ title: "Check failed", description: e.message, variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: () => submitReport("account", id, reportReason, reportDetails),
    onSuccess: () => { setReportOpen(false); setReportReason(""); setReportDetails(""); toast({ title: "Report submitted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const commentReportMutation = useMutation({
    mutationFn: () => submitReport("comment", commentReportId!, commentReportReason, commentReportDetails),
    onSuccess: () => { setCommentReportId(null); setCommentReportReason(""); setCommentReportDetails(""); toast({ title: "Comment reported" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => patchAccount(id, { title: editTitle, description: editDesc, games: editGames.split(",").map(s => s.trim()).filter(Boolean), pointsCost: editCost }),
    onSuccess: () => { setEditing(false); queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) }); toast({ title: "Account updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleLike = async () => {
    if (!user) { setLikeError("You must be logged in."); return; }
    setLikeError("");
    try {
      if (account?.userHasLiked) await unlikeAccount.mutateAsync({ accountId: id });
      else await likeAccount.mutateAsync({ accountId: id });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
    } catch (e: any) { setLikeError(e.message || "Failed"); }
  };

  const handleClaim = async () => {
    if (!user) { setClaimError("You must be logged in."); return; }
    if (!account) return;
    if (user.points < account.pointsCost) { setClaimError(`You need ${account.pointsCost} points but only have ${user.points}.`); return; }
    setClaimError("");
    try {
      const res = await claimAccount.mutateAsync({ accountId: id });
      setClaimResult({ username: res.steamUsername, password: res.steamPassword });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (e: any) {
      const raw: string = e.message || "Failed to claim";
      setClaimError(raw.replace(/^HTTP \d+ [^:]+:\s*/i, ""));
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this account permanently?")) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id });
      navigate("/browse");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const startEdit = () => {
    if (!account) return;
    setEditTitle(account.title);
    setEditDesc(account.description);
    setEditGames(account.games.join(", "));
    setEditCost(account.pointsCost);
    setEditing(true);
  };

  const canManage = user && account && (user.id === account.userId || user.isAdmin || (user as any).isModerator);
  const { data: poster } = useGetUser(account?.userId ?? 0);

  const viewCount = (account as any)?.viewCount ?? 0;

  if (accountLoading) return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-96 col-span-2 rounded-xl" />
          <Skeleton className="h-96 col-span-1 rounded-xl" />
        </div>
      </div>
    </Layout>
  );

  if (!account) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Account Not Found</h2>
        <p className="text-muted-foreground mb-6">This account may have been removed.</p>
        <Link href="/browse"><Button>Browse Accounts</Button></Link>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-5xl space-y-4">

        {/* ── FORUM-STYLE HEADER ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 pt-4 pb-3 space-y-3">

            {/* Back */}
            <button
              onClick={() => {
                const prevPath = window.location.pathname;
                window.history.back();
                setTimeout(() => { if (window.location.pathname === prevPath) navigate("/browse"); }, 80);
              }}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors group w-fit"
            >
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back
            </button>

            {/* Title */}
            {editing ? (
              <div className="space-y-3">
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" className="text-base font-black" />
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="resize-none" rows={3} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input value={editGames} onChange={(e) => setEditGames(e.target.value)} placeholder="Games (comma-separated)" />
                  <Input type="number" value={editCost} onChange={(e) => setEditCost(Number(e.target.value))} placeholder="Points cost" min={0} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="gap-1"><Check className="h-4 w-4" /> Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-1"><X className="h-4 w-4" /> Cancel</Button>
                </div>
              </div>
            ) : (
              <h1 className="text-base sm:text-2xl md:text-3xl font-black leading-snug">{account.title}</h1>
            )}

            {/* Inline meta row — badge + views + comments + status */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm text-muted-foreground">
              {account.pointsCost === 0
                ? <Badge className="bg-green-600/20 text-green-600 border-green-600/30 text-[10px] sm:text-xs">Free</Badge>
                : <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 flex items-center gap-1 text-[10px] sm:text-xs"><Coins className="h-2.5 w-2.5" />{account.pointsCost} pts</Badge>
              }
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${account.isAvailable ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-muted/40 text-muted-foreground border-border"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${account.isAvailable ? "bg-green-500" : "bg-muted-foreground"}`} />
                {account.isAvailable ? "Available" : "Claimed"}
              </div>
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{viewCount.toLocaleString()}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{comments?.length ?? 0}</span>
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{account.likesCount}</span>
              <span className="ml-auto text-[10px] sm:text-xs">{formatDistanceToNow(new Date(account.createdAt))} ago</span>
            </div>
          </div>

          {/* Poster info bar — forum style */}
          <div className="flex border-t border-border px-4 sm:px-6 py-3 items-center gap-3">
            <Link href={`/profile/${account.userId}`}>
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border border-border hover:border-primary transition-colors shrink-0">
                <AvatarImage src={poster?.avatarUrl || "/default-avatar.png"} />
                <AvatarFallback className="text-xs">{(account.posterUsername?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {(account as any).posterNameColor === "rainbow" ? (
                  <Link href={`/profile/${account.userId}`} className="rainbow-text font-bold text-sm sm:text-base truncate">{account.posterUsername}</Link>
                ) : (account as any).posterNameColor === "fire" ? (
                  <Link href={`/profile/${account.userId}`} className="fire-text font-bold text-sm sm:text-base truncate">{account.posterUsername}</Link>
                ) : (account as any).posterNameColor === "ocean" ? (
                  <Link href={`/profile/${account.userId}`} className="ocean-text font-bold text-sm sm:text-base truncate">{account.posterUsername}</Link>
                ) : (account as any).posterNameColor === "galaxy" ? (
                  <Link href={`/profile/${account.userId}`} className="galaxy-text font-bold text-sm sm:text-base truncate">{account.posterUsername}</Link>
                ) : (account as any).posterNameColor === "neon" ? (
                  <Link href={`/profile/${account.userId}`} className="neon-text font-bold text-sm sm:text-base truncate">{account.posterUsername}</Link>
                ) : (account as any).posterNameColor === "gold" ? (
                  <Link href={`/profile/${account.userId}`} className="gold-text font-bold text-sm sm:text-base truncate">{account.posterUsername}</Link>
                ) : (
                  <Link
                    href={`/profile/${account.userId}`}
                    className="font-bold text-sm sm:text-base hover:text-primary transition-colors truncate"
                    style={(account as any).posterNameColor ? { color: (account as any).posterNameColor } : undefined}
                  >
                    {account.posterUsername}
                  </Link>
                )}
                <UserBadge badgeType={(account as any).posterBadgeType} size={14} />
                {poster?.badgeName && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0 flex items-center gap-0.5 shrink-0">
                    <Star className="h-2.5 w-2.5" />{poster.badgeName}
                  </Badge>
                )}
                {poster && (
                  <span className="text-xs text-muted-foreground">
                    Lv.{poster.level}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                Member for {formatDistanceToNow(new Date(poster?.createdAt ?? account.createdAt))}
              </p>
            </div>

            {/* Message button */}
            {user && user.id !== account.userId && (
              <Link href={`/messages?user=${account.userId}&username=${encodeURIComponent(account.posterUsername ?? "")}`}>
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs shrink-0">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Message</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Description */}
          {!editing && account.description && (
            <div className="border-t border-border px-4 sm:px-6 py-3">
              <p
                className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderAccountDescription(account.description) }}
              />
            </div>
          )}
        </div>

        {/* ── TWO-COLUMN: Main + Sidebar ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

          {/* ── LEFT: Credentials + Comments ── */}
          <div className="col-span-1 md:col-span-2 space-y-4 sm:space-y-5">

            {/* Credentials panel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border bg-muted/20">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-bold text-xs sm:text-sm">STEAM Account Information</span>
              </div>
              <div className="p-4 sm:p-5">
                {claimResult ? (
                  <div className="space-y-3">
                    <CopyField label="Account" value={claimResult.username} />
                    <CopyField label="Password" value={claimResult.password} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-5 text-center">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm sm:text-base mb-1">View account credentials</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {account.pointsCost === 0 ? "Claim this account for free to reveal the Steam login." : `Spend ${account.pointsCost} points to reveal the Steam login.`}
                      </p>
                    </div>
                    {(() => {
                      const method = (account as any).unlockMethod ?? "login";
                      const isOwner = user?.id === account.userId;
                      const gateBlocked = !isOwner && user && (
                        (method === "like" && !account.userHasLiked) ||
                        (method === "comment" && !(account as any).userHasCommented)
                      );
                      if (gateBlocked) {
                        return (
                          <Button disabled variant="outline" className="gap-2 font-bold w-full text-xs sm:text-sm">
                            <Lock className="h-4 w-4" />
                            {method === "like" ? "Like to Unlock" : "Comment to Unlock"}
                          </Button>
                        );
                      }
                      if (account.isAvailable) {
                        return (
                          <>
                            <Button className="gap-2 font-bold text-xs sm:text-sm" onClick={handleClaim} disabled={claimAccount.isPending}>
                              {claimAccount.isPending ? "Claiming..." : account.pointsCost === 0 ? "Claim for Free" : `Claim for ${account.pointsCost} pts`}
                            </Button>
                            {claimError && <p className="text-sm text-red-500 mt-1">{claimError}</p>}
                          </>
                        );
                      }
                      return <Button disabled className="text-xs sm:text-sm">Currently Unavailable</Button>;
                    })()}
                  </div>
                )}

                {/* Unlock gate hints */}
                {(() => {
                  const method = (account as any).unlockMethod ?? "login";
                  if (method === "like" && !account.userHasLiked && user && user.id !== account.userId) {
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs sm:text-sm text-center space-y-1">
                        <p className="font-medium text-primary">Like this post to unlock credentials</p>
                        <p className="text-xs text-muted-foreground">The author requires a like before you can claim.</p>
                      </div>
                    );
                  }
                  if (method === "comment" && !(account as any).userHasCommented && user && user.id !== account.userId) {
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs sm:text-sm text-center space-y-1">
                        <p className="font-medium text-amber-600">Leave a comment to unlock credentials</p>
                        <p className="text-xs text-muted-foreground">The author requires a comment before you can claim.</p>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="mt-4 space-y-2">
                  <CollapsibleSection title="Games List" items={account.games} />
                  {/* Last checked + status badge + admin/mod check button */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {(() => {
                          const ts = checkResult?.lastCheckedAt ?? (account as any).lastCheckedAt;
                          if (!ts) return "Never checked";
                          return `Last checked: ${formatDistanceToNow(new Date(ts))} ago`;
                        })()}
                      </p>
                      {(() => {
                        // If we just ran a check and it errored, show "?" — never fall back to old "live" DB value
                        const acc = account as any;
                        const freshStatus = checkResult?.checkStatus;
                        if (freshStatus === "error") {
                          return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">? Unknown</span>;
                        }
                        const validStatuses = ["live", "dead", "2fa"];
                        let s: string | null =
                          (freshStatus && validStatuses.includes(freshStatus) ? freshStatus : null)
                          ?? (acc.lastCheckStatus && validStatuses.includes(acc.lastCheckStatus) ? acc.lastCheckStatus : null)
                          ?? null;
                        if (!s && acc.lastCheckedAt) {
                          s = (acc.healthFailCount ?? 0) > 0 ? "dead" : "live";
                        }
                        if (!s) return null;
                        if (s === "live") return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500 border border-green-500/30">● Live</span>;
                        if (s === "2fa")  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">● 2FA</span>;
                        if (s === "dead") return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30">● Dead</span>;
                        return null;
                      })()}
                    </div>
                    {user && ((user as any).isAdmin || (user as any).isModerator) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={checkHealthMutation.isPending}
                        onClick={() => checkHealthMutation.mutate()}
                        className="h-7 px-2 gap-1.5 text-[10px] sm:text-xs border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <RefreshCw className={`h-3 w-3 ${checkHealthMutation.isPending ? "animate-spin" : ""}`} />
                        {checkHealthMutation.isPending ? "Checking…" : "Check"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Like + Report */}
                <div className="mt-4 border-t border-border pt-4 flex gap-3">
                  <Button
                    size="sm"
                    variant={account.userHasLiked ? "default" : "outline"}
                    onClick={() => { if (!user) { setLikeError("Log in to like."); return; } handleLike(); }}
                    disabled={likeAccount.isPending || unlikeAccount.isPending}
                    className={`flex-1 gap-2 text-xs sm:text-sm ${account.userHasLiked ? "bg-primary hover:bg-primary/90 border-primary" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                  >
                    <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${account.userHasLiked ? "fill-white" : ""}`} />
                    {account.userHasLiked ? "Liked" : "Like"}
                    <span className="ml-auto font-mono">{account.likesCount}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { if (!user) return; setReportOpen(true); }}
                    disabled={!user}
                    className="flex-1 gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs sm:text-sm"
                  >
                    <Flag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Report
                  </Button>
                </div>
                {likeError && <p className="text-xs text-red-500 mt-1">{likeError}</p>}
                {!user && <p className="text-xs text-muted-foreground mt-2">Log in to like or report.</p>}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
              <h3 className="text-base sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Discussion ({comments?.length || 0})
              </h3>

              <div className="flex gap-3 sm:gap-4 mb-6 sm:mb-8">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                  <AvatarImage src={user?.avatarUrl || "/default-avatar.png"} />
                  <AvatarFallback className="text-xs">{user?.username?.substring(0, 2).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Ask a question or leave a comment..."
                    className="min-h-[70px] sm:min-h-[80px] resize-none text-xs sm:text-sm"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                  />
                  {commentError && <p className="text-xs sm:text-sm text-red-500">{commentError}</p>}
                  <div className="flex justify-end">
                    <Button size="sm" className="text-xs sm:text-sm" onClick={async () => {
                      if (!user) { setCommentError("You must be logged in."); return; }
                      if (!commentContent.trim()) return;
                      try {
                        await createComment.mutateAsync({ accountId: id, data: { content: commentContent } });
                        setCommentContent("");
                        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                      } catch (e: any) { setCommentError(e.message || "Could not post"); }
                    }} disabled={!commentContent.trim() || createComment.isPending}>
                      {createComment.isPending ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {commentsLoading ? (
                  <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
                ) : (comments?.filter(c => !(c as any).parentId).length === 0 && !commentsLoading) ? (
                  <div className="text-center py-6 text-muted-foreground italic text-sm">No comments yet.</div>
                ) : (
                  comments?.filter(c => !(c as any).parentId).map((comment) => {
                    const replies = comments?.filter(r => (r as any).parentId === comment.id) ?? [];
                    return (
                      <div key={comment.id}>
                        {/* Top-level comment */}
                        <div className="flex gap-3 sm:gap-4 group">
                          <Link href={`/profile/${comment.userId}`}>
                            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 cursor-pointer">
                              <AvatarImage src={comment.avatarUrl || "/default-avatar.png"} />
                              <AvatarFallback className="text-xs">{(comment.username?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </Link>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="inline-flex items-center gap-1">
                                  <Link
                                    href={`/profile/${comment.userId}`}
                                    className="font-semibold text-xs sm:text-sm hover:text-primary transition-colors"
                                    style={(comment as any).nameColor ? { color: (comment as any).nameColor } : undefined}
                                  >
                                    {comment.username}
                                  </Link>
                                  {(comment as any).badgeType && (
                                    <img
                                      src={(comment as any).badgeType === "vip" ? "/badge-vip.png" : "/badge-gold.png"}
                                      alt={(comment as any).badgeType === "vip" ? "Pro VIP" : "Premium"}
                                      title={(comment as any).badgeType === "vip" ? "Pro VIP Member" : "Premium Member"}
                                      style={{ width: 14, height: 14, display: "inline-block" }}
                                    />
                                  )}
                                </span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground ml-2">{formatDistanceToNow(new Date(comment.createdAt))} ago</span>
                              </div>
                              {(user?.id === comment.userId || user?.isAdmin || (user as any)?.isModerator) && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={async () => { await deleteComment.mutateAsync({ accountId: id, commentId: comment.id }); queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) }); }}>
                                  <Trash className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <p className="mt-1 text-xs sm:text-sm">{comment.content}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <Button variant="ghost" size="sm" className={`h-6 px-2 text-xs flex gap-1 ${comment.userHasLiked ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                                onClick={async () => {
                                  if (!user) return;
                                  if (comment.userHasLiked) await unlikeComment.mutateAsync({ accountId: id, commentId: comment.id });
                                  else await likeComment.mutateAsync({ accountId: id, commentId: comment.id });
                                  queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                                }}>
                                <Heart className={`h-3 w-3 ${comment.userHasLiked ? "fill-primary text-primary" : ""}`} />
                                {comment.likesCount}
                              </Button>
                              {user && (
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex gap-1 text-muted-foreground hover:text-primary"
                                  onClick={() => { setReplyToId(replyToId === comment.id ? null : comment.id); setReplyContent(""); }}>
                                  <CornerDownRight className="h-3 w-3" /> Reply
                                </Button>
                              )}
                              {user && user.id !== comment.userId && (
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex gap-1 text-muted-foreground hover:text-red-500"
                                  onClick={() => { setCommentReportId(comment.id); setCommentReportReason(""); setCommentReportDetails(""); }}>
                                  <Flag className="h-3 w-3" /> Report
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inline reply box */}
                        {replyToId === comment.id && (
                          <div className="ml-11 sm:ml-14 mt-2 flex gap-2 items-start">
                            <Avatar className="h-6 w-6 shrink-0 mt-1">
                              <AvatarImage src={user?.avatarUrl || "/default-avatar.png"} />
                              <AvatarFallback className="text-[10px]">{user?.username?.substring(0, 2).toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1.5">
                              <Textarea
                                placeholder={`Replying to ${comment.username}…`}
                                className="min-h-[56px] resize-none text-xs"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setReplyToId(null); setReplyContent(""); }}>Cancel</Button>
                                <Button size="sm" className="h-6 px-2 text-xs" disabled={!replyContent.trim() || createComment.isPending}
                                  onClick={async () => {
                                    if (!user || !replyContent.trim()) return;
                                    try {
                                      await createComment.mutateAsync({ accountId: id, data: { content: replyContent, parentId: comment.id } });
                                      setReplyToId(null);
                                      setReplyContent("");
                                      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                                    } catch (e: any) { toast({ title: e.message || "Could not post reply", variant: "destructive" }); }
                                  }}>
                                  {createComment.isPending ? "Posting…" : "Reply"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Nested replies */}
                        {replies.length > 0 && (
                          <div className="ml-11 sm:ml-14 mt-3 space-y-3 border-l-2 border-border pl-3 sm:pl-4">
                            {replies.map((reply) => (
                              <div key={reply.id} className="flex gap-2 sm:gap-3 group">
                                <Link href={`/profile/${reply.userId}`}>
                                  <Avatar className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 cursor-pointer">
                                    <AvatarImage src={reply.avatarUrl || "/default-avatar.png"} />
                                    <AvatarFallback className="text-[10px]">{(reply.username?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                </Link>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="inline-flex items-center gap-1">
                                        <Link
                                          href={`/profile/${reply.userId}`}
                                          className="font-semibold text-[11px] sm:text-xs hover:text-primary transition-colors"
                                          style={(reply as any).nameColor ? { color: (reply as any).nameColor } : undefined}
                                        >
                                          {reply.username}
                                        </Link>
                                        {(reply as any).badgeType && (
                                          <img
                                            src={(reply as any).badgeType === "vip" ? "/badge-vip.png" : "/badge-gold.png"}
                                            alt={(reply as any).badgeType === "vip" ? "Pro VIP" : "Premium"}
                                            style={{ width: 12, height: 12, display: "inline-block" }}
                                          />
                                        )}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground ml-1.5">{formatDistanceToNow(new Date(reply.createdAt))} ago</span>
                                    </div>
                                    {(user?.id === reply.userId || user?.isAdmin || (user as any)?.isModerator) && (
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={async () => { await deleteComment.mutateAsync({ accountId: id, commentId: reply.id }); queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) }); }}>
                                        <Trash className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-[11px] sm:text-xs">{reply.content}</p>
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <Button variant="ghost" size="sm" className={`h-5 px-1.5 text-[10px] flex gap-1 ${reply.userHasLiked ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                                      onClick={async () => {
                                        if (!user) return;
                                        if (reply.userHasLiked) await unlikeComment.mutateAsync({ accountId: id, commentId: reply.id });
                                        else await likeComment.mutateAsync({ accountId: id, commentId: reply.id });
                                        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                                      }}>
                                      <Heart className={`h-2.5 w-2.5 ${reply.userHasLiked ? "fill-primary text-primary" : ""}`} />
                                      {reply.likesCount}
                                    </Button>
                                    {user && user.id !== reply.userId && (
                                      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] flex gap-1 text-muted-foreground hover:text-red-500"
                                        onClick={() => { setCommentReportId(reply.id); setCommentReportReason(""); setCommentReportDetails(""); }}>
                                        <Flag className="h-2.5 w-2.5" /> Report
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-4">

            {/* Poster stats card — desktop only stats */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posted by</p>

              <Link href={`/profile/${account.userId}`} className="flex items-center gap-3 group">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border group-hover:border-primary transition-colors">
                  <AvatarImage src={poster?.avatarUrl || "/default-avatar.png"} />
                  <AvatarFallback className="text-xs">{(account.posterUsername?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-sm sm:text-base group-hover:text-primary transition-colors">{account.posterUsername}</p>
                  {poster?.badgeName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary mt-0.5">{poster.badgeName}</Badge>
                  )}
                </div>
              </Link>

              {/* Stats — DESKTOP ONLY */}
              {poster && (
                <div className="hidden md:grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Level</p>
                    <p className="font-bold text-sm">{poster.level}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Likes</p>
                    <p className="font-bold text-sm">{(poster as any).totalLikesReceived ?? 0}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Posts</p>
                    <p className="font-bold text-sm">{(poster as any).totalAccounts ?? "—"}</p>
                  </div>
                </div>
              )}

              {user && user.id !== account.userId && (
                <Link href={`/messages?user=${account.userId}&username=${encodeURIComponent(account.posterUsername ?? "")}`}>
                  <Button variant="outline" className="w-full gap-2 text-xs sm:text-sm">
                    <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Message {account.posterUsername}
                  </Button>
                </Link>
              )}
            </div>

            {/* Owner/Admin actions */}
            {canManage && (
              <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manage Listing</p>
                <div className="flex flex-col gap-2">
                  {user.id === account.userId && (
                    <Button variant="outline" onClick={startEdit} className="w-full gap-2 text-xs sm:text-sm">
                      <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Edit Listing
                    </Button>
                  )}
                  <Button variant="destructive" onClick={handleDelete} className="w-full gap-2 text-xs sm:text-sm">
                    <Trash className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Delete Listing
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comment report dialog */}
        <Dialog open={commentReportId !== null} onOpenChange={(open) => { if (!open) setCommentReportId(null); }}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle>Report Comment</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason</label>
                <select className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm" value={commentReportReason} onChange={(e) => setCommentReportReason(e.target.value)}>
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or off-topic</option>
                  <option value="harassment">Harassment or abuse</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Details (optional)</label>
                <Textarea placeholder="Add more details..." value={commentReportDetails} onChange={(e) => setCommentReportDetails(e.target.value)} className="resize-none" rows={3} />
              </div>
              <Button className="w-full" onClick={() => commentReportMutation.mutate()} disabled={!commentReportReason || commentReportMutation.isPending}>
                {commentReportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report dialog */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle>Report this post</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason</label>
                <select className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or misleading</option>
                  <option value="fake">Fake or invalid credentials</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="scam">Potential scam</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Details (optional)</label>
                <Textarea placeholder="Add more details..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="resize-none" rows={3} />
              </div>
              <Button className="w-full" onClick={() => reportMutation.mutate()} disabled={!reportReason || reportMutation.isPending}>
                {reportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
}
