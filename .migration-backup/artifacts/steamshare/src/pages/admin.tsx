import { Layout } from "@/components/layout";
import {
  useGetMe,
  useListAccounts,
  useDeleteAccount,
  useListAdLinks,
  useCreateAdLink,
  useDeleteAdLink,
  getListAccountsQueryKey,
  getListAdLinksQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, type ReactNode } from "react";
import { Shield, Trash, Copy, Ban, CheckCircle, UserCheck, Flag, Coins, UserX, Megaphone, Pin, PinOff, Plus, ShoppingBag, Package, Star, Settings, Mail, Phone, MapPin, ExternalLink, X, Hourglass, Check, XCircle, ChevronDown, ChevronUp, Eye, EyeOff, Zap, ArrowLeft, Users, LayoutDashboard, Pencil, Gift, CheckCheck } from "lucide-react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Link } from "wouter";

// --- Dashboard ---
async function fetchDashboard() {
  const res = await fetch("/api/admin/dashboard", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{
    users: { total: number; new24h: number; new7d: number; new30d: number; banned: number };
    accounts: { total: number; new24h: number; new7d: number; removed: number; pending: number };
    reports: { total: number; open: number };
    activity: { totalClaims: number; pointsCirculating: number };
  }>;
}

function DashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: fetchDashboard, refetchInterval: 30000 });
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading dashboard...</div>;
  if (!data) return <div className="text-muted-foreground text-sm py-8 text-center">No data</div>;

  const newUsers = period === "24h" ? data.users.new24h : period === "7d" ? data.users.new7d : data.users.new30d;
  const newAccounts = period === "24h" ? data.accounts.new24h : period === "7d" ? data.accounts.new7d : undefined;

  const StatCard = ({ icon, label, value, sub, color = "text-primary" }: { icon: ReactNode; label: string; value: number | string; sub?: string; color?: string }) => (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2">
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border mb-1 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-foreground leading-none">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium mr-2">Period:</span>
        {(["24h", "7d", "30d"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${period === p ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            Last {p}
          </button>
        ))}
      </div>

      {/* Users */}
      <section>
        <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Users</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Total Members" value={data.users.total} sub="All registered users" />
          <StatCard icon={<Plus className="h-5 w-5" />} label={`New (${period})`} value={newUsers} sub={`Joined in last ${period}`} color="text-emerald-500" />
          <StatCard icon={<Ban className="h-5 w-5" />} label="Banned Users" value={data.users.banned} sub="Currently banned" color="text-red-500" />
          <StatCard icon={<Coins className="h-5 w-5" />} label="Points Circulating" value={data.activity.pointsCirculating} sub="Across all users" color="text-yellow-500" />
        </div>
      </section>

      {/* Accounts */}
      <section>
        <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Accounts</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Package className="h-5 w-5" />} label="Total Accounts" value={data.accounts.total} sub="All submissions" />
          {period !== "30d" && <StatCard icon={<Plus className="h-5 w-5" />} label={`New (${period})`} value={newAccounts ?? 0} sub={`Submitted in last ${period}`} color="text-emerald-500" />}
          <StatCard icon={<Hourglass className="h-5 w-5" />} label="Pending Review" value={data.accounts.pending} sub="Awaiting approval" color="text-yellow-500" />
          <StatCard icon={<Trash className="h-5 w-5" />} label="Removed/Dead" value={data.accounts.removed} sub="Marked unavailable" color="text-red-500" />
          <StatCard icon={<Zap className="h-5 w-5" />} label="Total Claims" value={data.activity.totalClaims} sub="All-time claims" color="text-blue-500" />
        </div>
      </section>

      {/* Reports */}
      <section>
        <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Reports</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Flag className="h-5 w-5" />} label="Total Reports" value={data.reports.total} sub="All-time submitted" />
          <StatCard icon={<Flag className="h-5 w-5" />} label="Open Reports" value={data.reports.open} sub="Needs attention" color={data.reports.open > 0 ? "text-red-500" : "text-emerald-500"} />
        </div>
      </section>
    </div>
  );
}

// --- API helpers ---
async function fetchAdminUsers() {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load users");
  return res.json() as Promise<any[]>;
}

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

async function setModerator(userId: number, promote: boolean) {
  const res = await fetch(`/api/admin/users/${userId}/moderator`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promote }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function adjustPoints(userId: number, delta: number) {
  const res = await fetch(`/api/admin/users/${userId}/points`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function fetchReports() {
  const res = await fetch("/api/admin/reports", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json() as Promise<any[]>;
}

async function dismissReport(reportId: number) {
  const res = await fetch(`/api/admin/reports/${reportId}/dismiss`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function actionReport(reportId: number) {
  const res = await fetch(`/api/reports/${reportId}/action`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function deleteAdminComment(commentId: number) {
  const res = await fetch(`/api/admin/comments/${commentId}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed to delete comment");
  return res.json();
}

const BAN_DURATIONS = [
  { label: "1 hr", hours: 1 },
  { label: "24 hrs", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "1 month", hours: 720 },
  { label: "Permanent", hours: null },
];

// --- Main component ---
export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe();

  if (!userLoading && (!user || (!user.isAdmin && !(user as any).isModerator))) {
    setLocation("/");
    return null;
  }

  const tabs = [
    ...(user?.isAdmin ? [{ value: "dashboard", label: "Dashboard" }] : []),
    { value: "pending", label: "Pending Reviews" },
    { value: "users", label: "Users" },
    { value: "accounts", label: "Accounts" },
    { value: "reports", label: "Reports" },
    ...(user?.isAdmin ? [{ value: "ads", label: "Ad Links" }] : []),
    ...(user?.isAdmin ? [{ value: "store", label: "Store" }] : []),
    ...(user?.isAdmin ? [{ value: "announcements", label: "News" }] : []),
    ...(user?.isAdmin ? [{ value: "site-settings", label: "Site Settings" }] : []),
    ...(user?.isAdmin ? [{ value: "premium", label: "Premium" }] : []),
    ...(user?.isAdmin ? [{ value: "deleted-accounts", label: "Deleted" }] : []),
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-black">Command Center</h1>
            <p className="text-sm text-muted-foreground">{user?.isAdmin ? "Administrator" : "Moderator"} Panel</p>
          </div>
        </div>

        <Tabs defaultValue={user?.isAdmin ? "dashboard" : "pending"} className="w-full">
          <TabsList className="flex flex-wrap w-full mb-8 bg-card border border-border h-auto min-h-12 sm:flex-nowrap sm:overflow-x-auto sm:h-12">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {user?.isAdmin && <TabsContent value="dashboard"><DashboardTab /></TabsContent>}
          <TabsContent value="pending"><PendingReviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab isAdmin={!!user?.isAdmin} /></TabsContent>
          <TabsContent value="accounts"><AccountsTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          {user?.isAdmin && <TabsContent value="ads"><AdLinksTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="store"><StoreTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="site-settings"><SiteSettingsTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="premium"><PremiumAdminTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="deleted-accounts"><DeletedAccountsTab /></TabsContent>}
        </Tabs>
      </div>
    </Layout>
  );
}

// --- Users Tab ---
function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [banTarget, setBanTarget] = useState<any>(null);
  const [banDuration, setBanDuration] = useState<number | null>(24);
  const [banReason, setBanReason] = useState("");
  const [pointsTarget, setPointsTarget] = useState<any>(null);
  const [pointsDelta, setPointsDelta] = useState(0);

  const { data: users = [], isLoading, isError, error } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });

  const banMutation = useMutation({
    mutationFn: () => banUser(banTarget.id, banDuration, banReason),
    onSuccess: () => { setBanTarget(null); setBanReason(""); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User banned" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => unbanUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User unbanned" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const modMutation = useMutation({
    mutationFn: ({ userId, promote }: { userId: number; promote: boolean }) => setModerator(userId, promote),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pointsMutation = useMutation({
    mutationFn: () => adjustPoints(pointsTarget.id, pointsDelta),
    onSuccess: () => { setPointsTarget(null); setPointsDelta(0); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Points updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = users.filter((u: any) => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      {isError && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          Failed to load users: {(error as any)?.message ?? "Unknown error"}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Points / XP</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
            ) : filtered.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/profile/${u.id}`} className="font-medium hover:text-primary">{u.username}</Link>
                  <div className="text-xs text-muted-foreground">#{u.id}</div>
                </TableCell>
                <TableCell>
                  <span className="text-primary font-mono text-sm">{u.points} pts</span>
                  <div className="text-xs text-muted-foreground">{u.xp} XP</div>
                </TableCell>
                <TableCell>
                  {u.isAdmin && <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">ADMIN</Badge>}
                  {u.isModerator && !u.isAdmin && <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">MOD</Badge>}
                  {!u.isAdmin && !u.isModerator && <span className="text-xs text-muted-foreground">User</span>}
                </TableCell>
                <TableCell>
                  {u.isBanned
                    ? <div>
                        <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                        {u.banReason && <div className="text-xs text-muted-foreground mt-0.5 max-w-[120px] truncate" title={u.banReason}>{u.banReason}</div>}
                      </div>
                    : <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">Active</Badge>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {/* Points (admin only) */}
                    {isAdmin && !u.isAdmin && (
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => { setPointsTarget(u); setPointsDelta(0); }}>
                        <Coins className="h-3 w-3" /> Points
                      </Button>
                    )}

                    {/* Mod toggle (admin only) */}
                    {isAdmin && !u.isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`gap-1 h-7 text-xs ${u.isModerator ? "text-blue-600 border-blue-500/30" : ""}`}
                        onClick={() => modMutation.mutate({ userId: u.id, promote: !u.isModerator })}
                        disabled={modMutation.isPending}
                      >
                        {u.isModerator ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        {u.isModerator ? "Demote" : "Mod"}
                      </Button>
                    )}

                    {/* Ban / Unban */}
                    {!u.isAdmin && (
                      u.isBanned ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-500/30"
                          onClick={() => unbanMutation.mutate(u.id)} disabled={unbanMutation.isPending}>
                          <CheckCircle className="h-3 w-3" /> Unban
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                          onClick={() => { setBanTarget(u); setBanDuration(24); setBanReason(""); }}>
                          <Ban className="h-3 w-3" /> Ban
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Ban Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Ban {banTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {BAN_DURATIONS.map((d) => (
                  <button key={d.label} onClick={() => setBanDuration(d.hours)}
                    className={`text-xs border rounded-lg px-2 py-2 font-medium transition-colors ${banDuration === d.hours ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
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

      {/* Points Dialog */}
      <Dialog open={!!pointsTarget} onOpenChange={(open) => !open && setPointsTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Adjust Points — {pointsTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Current: <strong className="text-primary">{pointsTarget?.points} pts</strong></p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Delta (positive = add, negative = remove)</label>
              <Input type="number" value={pointsDelta} onChange={(e) => setPointsDelta(Number(e.target.value))} placeholder="e.g. 100 or -50" />
            </div>
            <div className="flex gap-2">
              {[100, 500, -100, -500].map((d) => (
                <button key={d} onClick={() => setPointsDelta((prev) => prev + d)}
                  className={`text-xs border rounded px-2 py-1 ${d > 0 ? "border-green-500/30 text-green-600" : "border-red-500/30 text-red-500"} hover:opacity-80`}>
                  {d > 0 ? "+" : ""}{d}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => pointsMutation.mutate()} disabled={!pointsDelta || pointsMutation.isPending}>
              {pointsMutation.isPending ? "Saving..." : `Apply ${pointsDelta > 0 ? "+" : ""}${pointsDelta} pts`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Accounts Tab ---
function AccountsTab() {
  const { data: accountsData, isLoading } = useListAccounts({ limit: 100 });
  const deleteAccount = useDeleteAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this account permanently?")) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id });
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      toast({ title: "Account deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Poster</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
          ) : accountsData?.accounts?.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-xs">{a.id}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">
                <Link href={`/accounts/${a.id}`} className="hover:text-primary">{a.title}</Link>
              </TableCell>
              <TableCell>{(a as any).posterUsername}</TableCell>
              <TableCell>
                {a.isAvailable ? <Badge variant="secondary">Available</Badge> : <Badge variant="outline" className="text-muted-foreground">Claimed</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="destructive" size="sm" onClick={() => handleDelete(a.id)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- Deleted Accounts Tab ---
async function fetchDeletedAccounts(page: number) {
  const res = await fetch(`/api/admin/deleted-accounts?page=${page}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load deleted accounts");
  return res.json() as Promise<{ accounts: Array<{ id: number; title: string; steamUsername: string; createdAt: string; deletedAt: string; deletedReason: string | null; posterUsername: string | null; deletedByUsername: string }>; total: number; page: number; limit: number }>;
}

function DeletedAccountsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["admin-deleted-accounts", page], queryFn: () => fetchDeletedAccounts(page) });

  const restoreMutation = useMutation({
    mutationFn: async (accountId: number) => {
      const res = await fetch(`/api/admin/deleted-accounts/${accountId}/restore`, { method: "POST", credentials: "include" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deleted-accounts"] });
      toast({ title: "Account restored" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Deleted Accounts</h2>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} account{(data?.total ?? 0) !== 1 ? "s" : ""} removed</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Steam User</TableHead>
              <TableHead>Posted By</TableHead>
              <TableHead>Deleted By</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !data?.accounts?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No deleted accounts</TableCell></TableRow>
            ) : data.accounts.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{a.id}</TableCell>
                <TableCell className="font-medium max-w-[180px] truncate">{a.title}</TableCell>
                <TableCell className="font-mono text-xs">{a.steamUsername}</TableCell>
                <TableCell className="text-sm">{a.posterUsername ?? "—"}</TableCell>
                <TableCell className="text-sm">{a.deletedByUsername}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{a.deletedReason ?? <span className="italic">No reason</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.deletedAt).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restoreMutation.mutate(a.id)}
                    disabled={restoreMutation.isPending}
                  >
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm flex items-center px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// --- Reports Tab ---
type CommentActionTarget = {
  reportId: number;
  commentId: number;
  commentContent: string;
  authorId: number;
  authorUsername: string;
};

function ReportsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDismissed, setShowDismissed] = useState(false);
  const [actionTarget, setActionTarget] = useState<CommentActionTarget | null>(null);
  const [banDuration, setBanDuration] = useState<number | null>(null);
  const [banReason, setBanReason] = useState("");
  const [deleteContent, setDeleteContent] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const { data: reports = [], isLoading, isError, error } = useQuery({ queryKey: ["admin-reports"], queryFn: fetchReports });

  const dismissMutation = useMutation({
    mutationFn: (reportId: number) => dismissReport(reportId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); toast({ title: "Report dismissed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: (reportId: number) => actionReport(reportId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); toast({ title: "Report actioned — reporter notified" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleCommentApprove() {
    if (!actionTarget) return;
    if (!banReason.trim()) { toast({ title: "Ban reason required", variant: "destructive" }); return; }
    setIsActioning(true);
    try {
      await banUser(actionTarget.authorId, banDuration, banReason.trim());
      if (deleteContent) await deleteAdminComment(actionTarget.commentId);
      await actionReport(actionTarget.reportId);
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "User banned and report actioned" });
      setActionTarget(null);
      setBanDuration(null);
      setBanReason("");
      setDeleteContent(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsActioning(false);
    }
  }

  const filtered = reports.filter((r: any) => showDismissed || !r.isDismissed);
  const pendingCount = reports.filter((r: any) => !r.isDismissed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-primary" />
          <h2 className="font-bold">User Reports</h2>
          {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending</Badge>}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} className="rounded" />
          Show dismissed
        </label>
      </div>

      {isError && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          Failed to load reports: {(error as any)?.message ?? "Unknown error"}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Flag className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">{showDismissed ? "No reports yet." : "No pending reports."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report: any) => (
            <div key={report.id} className={`bg-card border rounded-xl p-4 ${report.isDismissed ? "opacity-50 border-border" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{report.targetType}</Badge>
                    <span className="text-sm font-medium">#{report.targetId}</span>
                    <span className="text-xs text-muted-foreground">by <strong>{report.reporterUsername}</strong></span>
                    <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-semibold">{report.reason}</p>
                  {report.details && <p className="text-sm text-muted-foreground">{report.details}</p>}
                  {report.targetType === "comment" && report.commentContent && (
                    <div className="mt-2 bg-background border border-border rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Comment by <strong>{report.commentAuthorUsername ?? "unknown"}</strong>:
                      </p>
                      <p className="text-sm italic text-foreground/80 line-clamp-3">"{report.commentContent}"</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0 items-end">
                  {report.targetType === "account" && (
                    <Link href={`/accounts/${report.targetId}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    </Link>
                  )}
                  {report.isActioned && (
                    <span className="text-xs font-semibold text-green-600 bg-green-500/10 border border-green-500/20 rounded px-2 py-0.5">Actioned</span>
                  )}
                  {!report.isDismissed && !report.isActioned && (
                    report.targetType === "comment" ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                        onClick={() => setActionTarget({
                          reportId: report.id,
                          commentId: report.targetId,
                          commentContent: report.commentContent ?? "",
                          authorId: report.commentAuthorId ?? 0,
                          authorUsername: report.commentAuthorUsername ?? "unknown",
                        })}
                      >
                        <CheckCircle className="h-3 w-3" /> Approve
                      </Button>
                    ) : (
                      <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white border-0" onClick={() => actionMutation.mutate(report.id)} disabled={actionMutation.isPending}>
                        <CheckCircle className="h-3 w-3" /> Action Taken
                      </Button>
                    )
                  )}
                  {!report.isDismissed && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => dismissMutation.mutate(report.id)} disabled={dismissMutation.isPending}>
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ban + delete dialog for comment reports */}
      <Dialog open={!!actionTarget} onOpenChange={(open) => { if (!open) { setActionTarget(null); setBanDuration(null); setBanReason(""); setDeleteContent(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" /> Ban User
            </DialogTitle>
          </DialogHeader>
          {actionTarget && (
            <div className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs text-muted-foreground">Reported comment by <strong>{actionTarget.authorUsername}</strong>:</p>
                <p className="text-sm italic text-foreground/80">"{actionTarget.commentContent}"</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Ban duration</p>
                <div className="flex flex-wrap gap-2">
                  {BAN_DURATIONS.map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setBanDuration(d.hours)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${banDuration === d.hours ? "bg-red-500 text-white border-red-500" : "border-border hover:border-red-400 hover:text-red-600"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ban reason <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={2}
                  placeholder="Reason for the ban..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={deleteContent}
                  onChange={(e) => setDeleteContent(e.target.checked)}
                  className="mt-0.5 rounded accent-red-500"
                />
                <div>
                  <p className="text-sm font-medium group-hover:text-red-600 transition-colors">Delete reported comment</p>
                  <p className="text-xs text-muted-foreground">Permanently removes the comment from the listing</p>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setActionTarget(null); setBanDuration(null); setBanReason(""); setDeleteContent(false); }}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={!banReason.trim() || isActioning}
                  onClick={handleCommentApprove}
                >
                  {isActioning ? "Processing..." : `Ban${deleteContent ? " & Delete" : ""}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Ad Links Tab ---
function AdLinksTab() {
  const { data: links, isLoading } = useListAdLinks();
  const createLink = useCreateAdLink();
  const deleteLink = useDeleteAdLink();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [desc, setDesc] = useState("");
  const [reward, setReward] = useState(50);
  const [max, setMax] = useState(10);

  const handleCreate = async () => {
    try {
      await createLink.mutateAsync({ data: { description: desc, pointsReward: reward, maxUses: max } });
      setDesc("");
      queryClient.invalidateQueries({ queryKey: getListAdLinksQueryKey() });
      toast({ title: "Link created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/api/ad-links/${code}/redeem`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4">Generate New Ad Link</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Description / Campaign Name</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Discord Drop July" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Points Reward</label>
            <Input type="number" value={reward} onChange={(e) => setReward(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Uses</label>
            <Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </div>
        </div>
        <Button className="mt-4" onClick={handleCreate} disabled={createLink.isPending}>Generate Link</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : links?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.code}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell className="font-bold text-primary">+{l.pointsReward}</TableCell>
                <TableCell>{l.usesCount} / {l.maxUses}</TableCell>
                <TableCell>
                  {l.isActive ? <Badge variant="secondary" className="bg-green-500/10 text-green-500">Active</Badge> : <Badge variant="outline">Depleted</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(l.code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={async () => {
                    await deleteLink.mutateAsync({ adLinkId: l.id });
                    queryClient.invalidateQueries({ queryKey: getListAdLinksQueryKey() });
                  }}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// --- Announcements Tab ---
async function fetchAnnouncements() {
  const res = await fetch("/api/announcements", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<any[]>;
}

async function createAnnouncement(title: string, description: string, pinned: boolean, isPopup: boolean, popupButtons: {label: string; url: string}[]) {
  const res = await fetch("/api/announcements", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, pinned, isPopup, popupButtons }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function deleteAnnouncement(id: number) {
  const res = await fetch(`/api/announcements/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function togglePin(id: number, pinned: boolean) {
  const res = await fetch(`/api/announcements/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ── Store Tab ──
async function fetchAdminProducts() {
  const res = await fetch("/api/store/products", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<any[]>;
}

async function fetchAdminPurchases() {
  const res = await fetch("/api/store/admin/purchases", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load purchases");
  return res.json() as Promise<any[]>;
}

async function createProduct(title: string, description: string, imageUrl: string, imageDetailUrl: string, price: number, priceUsd: string, buyUrl: string, stock: number, paymentMode: string, deliveryContents: string[]) {
  const res = await fetch("/api/store/products", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, imageUrl, imageDetailUrl: imageDetailUrl || null, price, priceUsd: priceUsd || null, buyUrl: buyUrl || null, stock, paymentMode, deliveryContents }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function addDeliveryUnits(id: number, contents: string[]) {
  const res = await fetch(`/api/store/products/${id}/units`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function fetchProductUnits(id: number) {
  const res = await fetch(`/api/store/products/${id}/units`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load units");
  return res.json() as Promise<any[]>;
}

async function addStock(id: number, amount: number) {
  const res = await fetch(`/api/store/products/${id}/stock`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function deleteProduct(id: number) {
  const res = await fetch(`/api/store/products/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function updateProduct(id: number, data: { title: string; description: string; imageUrl: string; imageDetailUrl: string; price: number; priceUsd: string; buyUrl: string; paymentMode: string }) {
  const res = await fetch(`/api/store/products/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

function StoreTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<any>(null);
  const [stockAmount, setStockAmount] = useState(10);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgDetailUrl, setImgDetailUrl] = useState("");
  const [price, setPrice] = useState(100);
  const [priceUsd, setPriceUsd] = useState("");
  const [buyUrl, setBuyUrl] = useState("");
  const [stock, setStock] = useState(0);
  const [paymentMode, setPaymentMode] = useState("both");
  const [deliveryContents, setDeliveryContents] = useState("");
  const [unitsTarget, setUnitsTarget] = useState<any>(null);
  const [unitsText, setUnitsText] = useState("");

  const [editTarget, setEditTarget] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImgUrl, setEditImgUrl] = useState("");
  const [editImgDetailUrl, setEditImgDetailUrl] = useState("");
  const [editPrice, setEditPrice] = useState(100);
  const [editPriceUsd, setEditPriceUsd] = useState("");
  const [editBuyUrl, setEditBuyUrl] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState("both");

  const { data: products = [], isLoading: productsLoading } = useQuery({ queryKey: ["admin-products"], queryFn: fetchAdminProducts });
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({ queryKey: ["admin-purchases"], queryFn: fetchAdminPurchases });

  const createMutation = useMutation({
    mutationFn: () => {
      const contents = deliveryContents.split("\n").map(s => s.trim()).filter(Boolean);
      return createProduct(title, desc, imgUrl, imgDetailUrl, price, priceUsd, buyUrl, stock, paymentMode, contents);
    },
    onSuccess: () => {
      setTitle(""); setDesc(""); setImgUrl(""); setImgDetailUrl(""); setPrice(100); setPriceUsd(""); setBuyUrl(""); setStock(10); setPaymentMode("both"); setDeliveryContents("");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stockMutation = useMutation({
    mutationFn: () => addStock(stockTarget.id, stockAmount),
    onSuccess: () => {
      setStockTarget(null);
      setStockAmount(10);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Stock added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unitsMutation = useMutation({
    mutationFn: () => {
      const contents = unitsText.split("\n").map(s => s.trim()).filter(Boolean);
      return addDeliveryUnits(unitsTarget.id, contents);
    },
    onSuccess: () => {
      setUnitsTarget(null);
      setUnitsText("");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Delivery units added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => updateProduct(editTarget.id, {
      title: editTitle, description: editDesc, imageUrl: editImgUrl, imageDetailUrl: editImgDetailUrl,
      price: editPrice, priceUsd: editPriceUsd, buyUrl: editBuyUrl, paymentMode: editPaymentMode,
    }),
    onSuccess: () => {
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-8">
      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Products</h3>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1"><Plus className="h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> New Product</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium block mb-1">Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steam Gift Card $10" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Description</label>
                  <textarea className="w-full min-h-[80px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Describe the product..." value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Cover Image URL <span className="text-muted-foreground font-normal">(store grid)</span></label>
                    <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://... (portrait cover shown in grid)" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Detail Image URL <span className="text-muted-foreground font-normal">(product page)</span></label>
                    <Input value={imgDetailUrl} onChange={(e) => setImgDetailUrl(e.target.value)} placeholder="https://... (larger image on product page)" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">Price (pts)</label>
                    <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Initial Stock</label>
                    <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">USD Price (optional)</label>
                    <Input placeholder="e.g. 4.99" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Buy URL (for $ button)</label>
                    <Input placeholder="https://..." value={buyUrl} onChange={(e) => setBuyUrl(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Payment Methods</label>
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1 border border-border w-fit">
                    {(["both", "points", "usd"] as const).map((m) => (
                      <button key={m} onClick={() => setPaymentMode(m)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${paymentMode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        {m === "both" ? "Both" : m === "points" ? "Points Only" : "USD Only"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Controls which payment options buyers see.</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Delivery Contents (one per line)</label>
                  <textarea className="w-full min-h-[100px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g.&#10;ABC123-DEF456&#10;GHI789-JKL012" value={deliveryContents} onChange={(e) => {
                    setDeliveryContents(e.target.value);
                    const lines = e.target.value.split("\n").filter(l => l.trim()).length;
                    setStock(lines);
                  }} />
                  <p className="text-xs text-muted-foreground mt-1">Each line = 1 delivery unit. Stock set automatically.</p>
                </div>
                <Button className="w-full" disabled={!title.trim() || !desc.trim() || price <= 0 || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Creating..." : "Create Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products yet.</TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                  <TableCell className="font-bold text-primary">{p.price} pts</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-sm">{p.avgRating || 0} ({p.reviewsCount || 0})</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setUnitsTarget(p); setUnitsText(""); }}>
                        + Units
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setStockTarget(p); setStockAmount(10); }}>
                        + Stock
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => {
                          setEditTarget(p);
                          setEditTitle(p.title);
                          setEditDesc(p.description || "");
                          setEditImgUrl(p.imageUrl || "");
                          setEditImgDetailUrl(p.imageDetailUrl || "");
                          setEditPrice(p.price);
                          setEditPriceUsd(p.priceUsd || "");
                          setEditBuyUrl(p.buyUrl || "");
                          setEditPaymentMode(p.paymentMode || "both");
                        }}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate(p.id); }}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Purchases Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-lg">Purchase History</h3>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchasesLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : purchases.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No purchases yet.</TableCell></TableRow>
              ) : purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.productTitle}</TableCell>
                  <TableCell>{p.username}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell className="font-bold text-primary">{p.totalPrice} pts</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Stock Dialog */}
      <Dialog open={!!stockTarget} onOpenChange={(open) => !open && setStockTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Add Stock — {stockTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Current stock: <strong className="text-primary">{stockTarget?.stock}</strong></p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount to add</label>
              <Input type="number" value={stockAmount} onChange={(e) => setStockAmount(Number(e.target.value))} min={1} />
            </div>
            <Button className="w-full" onClick={() => stockMutation.mutate()} disabled={stockAmount <= 0 || stockMutation.isPending}>
              {stockMutation.isPending ? "Adding..." : `Add ${stockAmount} units`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Units Dialog */}
      <Dialog open={!!unitsTarget} onOpenChange={(open) => !open && setUnitsTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Add Delivery Units — {unitsTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Current stock: <strong className="text-primary">{unitsTarget?.stock}</strong></p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Delivery contents (one per line)</label>
              <textarea className="w-full min-h-[120px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g.&#10;ABC123-DEF456&#10;GHI789-JKL012" value={unitsText} onChange={(e) => setUnitsText(e.target.value)} />
              <p className="text-xs text-muted-foreground">Each line adds 1 stock unit + 1 delivery unit.</p>
            </div>
            <Button className="w-full" onClick={() => unitsMutation.mutate()} disabled={!unitsText.trim() || unitsMutation.isPending}>
              {unitsMutation.isPending ? "Adding..." : "Add Units"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> Edit Product</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium block mb-1">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Product title" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Description</label>
              <textarea className="w-full min-h-[80px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Describe the product..." />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Cover Image URL <span className="text-muted-foreground font-normal">(store grid)</span></label>
                <Input value={editImgUrl} onChange={(e) => setEditImgUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Detail Image URL <span className="text-muted-foreground font-normal">(product page)</span></label>
                <Input value={editImgDetailUrl} onChange={(e) => setEditImgDetailUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Price (pts)</label>
                <Input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">USD Price (optional)</label>
                <Input placeholder="e.g. 4.99" value={editPriceUsd} onChange={(e) => setEditPriceUsd(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Buy URL (for $ button)</label>
              <Input placeholder="https://..." value={editBuyUrl} onChange={(e) => setEditBuyUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Payment Methods</label>
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1 border border-border w-fit">
                {(["both", "points", "usd"] as const).map((m) => (
                  <button key={m} onClick={() => setEditPaymentMode(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${editPaymentMode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {m === "both" ? "Both" : m === "points" ? "Points Only" : "USD Only"}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!editTitle.trim() || !editDesc.trim() || editPrice <= 0 || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pinned, setPinned] = useState(true);
  const [open, setOpen] = useState(false);
  const [showAsPopup, setShowAsPopup] = useState(false);
  const [popupButtons, setPopupButtons] = useState<{label: string; url: string}[]>([]);
  const [newBtnLabel, setNewBtnLabel] = useState("");
  const [newBtnUrl, setNewBtnUrl] = useState("");

  const { data: announcements = [], isLoading } = useQuery({ queryKey: ["announcements"], queryFn: fetchAnnouncements });

  const createMutation = useMutation({
    mutationFn: () => createAnnouncement(title, description, pinned, showAsPopup, popupButtons),
    onSuccess: () => {
      setTitle(""); setDescription(""); setPinned(true); setOpen(false);
      setShowAsPopup(false); setPopupButtons([]); setNewBtnLabel(""); setNewBtnUrl("");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Announcement posted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAnnouncement(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) => togglePin(id, pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Site Announcements</h3>
          <p className="text-sm text-muted-foreground">Posts that appear on the home page and every account page.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Post</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> New Announcement</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium block mb-1">Title</label>
                <Input placeholder="e.g. Maintenance Tonight" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Full details of the announcement..."
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="accent-primary"
                />
                <label htmlFor="pinned" className="text-sm cursor-pointer">Pin this announcement</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showAsPopup"
                  checked={showAsPopup}
                  onChange={(e) => setShowAsPopup(e.target.checked)}
                  className="accent-primary"
                />
                <label htmlFor="showAsPopup" className="text-sm cursor-pointer">Show as popup once per user</label>
              </div>
              {showAsPopup && (
                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground">Popup Buttons (optional)</p>
                  {popupButtons.map((btn, i) => (
                    <div key={i} className="flex items-center gap-2 bg-background rounded px-2 py-1.5">
                      <span className="flex-1 truncate text-xs font-medium">{btn.label}</span>
                      <span className="text-muted-foreground text-xs truncate flex-1">{btn.url}</span>
                      <button onClick={() => setPopupButtons(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:opacity-70 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <Input placeholder="Button label" value={newBtnLabel} onChange={(e) => setNewBtnLabel(e.target.value)} className="flex-1 h-8 text-xs" />
                    <Input placeholder="URL" value={newBtnUrl} onChange={(e) => setNewBtnUrl(e.target.value)} className="flex-1 h-8 text-xs" />
                    <Button
                      size="sm" variant="outline" className="h-8 px-2 shrink-0"
                      onClick={() => {
                        if (newBtnLabel.trim() && newBtnUrl.trim()) {
                          setPopupButtons(prev => [...prev, { label: newBtnLabel.trim(), url: newBtnUrl.trim() }]);
                          setNewBtnLabel(""); setNewBtnUrl("");
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                disabled={!title.trim() || !description.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Posting..." : "Post Announcement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl text-muted-foreground">
          No announcements yet. Click "New Post" to create one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-foreground">{a.title}</span>
                  {a.pinned && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] flex items-center gap-1">
                      <Pin className="h-2.5 w-2.5 rotate-45" /> Pinned
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">by {a.authorUsername}</span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{a.description}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className={a.pinned ? "text-primary" : "text-muted-foreground"}
                  onClick={() => pinMutation.mutate({ id: a.id, pinned: !a.pinned })}
                  title={a.pinned ? "Unpin" : "Pin"}
                >
                  {a.pinned ? <Pin className="h-4 w-4 rotate-45" /> : <PinOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(a.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Site Settings Tab ---
async function fetchSiteSettings() {
  const res = await fetch("/api/site-settings", { credentials: "include" });
  if (!res.ok) return { contact: {}, footerLinks: [], bannedWords: [] };
  return res.json() as Promise<{ contact: Record<string, string>; footerLinks: { id: number; label: string; url: string; sortOrder: number }[]; bannedWords: string[] }>;
}

function SiteSettingsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings });

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [discord, setDiscord] = useState("");
  const [twitter, setTwitter] = useState("");

  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newWord, setNewWord] = useState("");

  const [tickerEnabled, setTickerEnabled] = useState(false);
  const [tickerIcon, setTickerIcon] = useState("");
  const [tickerText, setTickerText] = useState("");
  const [tickerLinkLabel, setTickerLinkLabel] = useState("");
  const [tickerLinkUrl, setTickerLinkUrl] = useState("");
  const tickerInitialized = useState(false);

  const { data: tickerData } = useQuery({
    queryKey: ["ticker"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings/ticker", { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<{ enabled: boolean; icon: string; text: string; linkLabel: string; linkUrl: string }>;
    },
  });

  if (tickerData && !tickerInitialized[0]) {
    tickerInitialized[1](true);
    setTickerEnabled(tickerData.enabled);
    setTickerIcon(tickerData.icon);
    setTickerText(tickerData.text);
    setTickerLinkLabel(tickerData.linkLabel);
    setTickerLinkUrl(tickerData.linkUrl);
  }

  const saveTickerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/ticker", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: tickerEnabled, icon: tickerIcon, text: tickerText, linkLabel: tickerLinkLabel, linkUrl: tickerLinkUrl }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticker"] });
      toast({ title: "Ticker saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const initialized = useState(false);

  // Populate fields once data loads
  if (data && !initialized[0]) {
    (initialized as any)[1](true);
    setEmail(data.contact.contact_email ?? "");
    setPhone(data.contact.contact_phone ?? "");
    setAddress(data.contact.contact_address ?? "");
    setDiscord(data.contact.contact_discord ?? "");
    setTwitter(data.contact.contact_twitter ?? "");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/contact", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_email: email,
          contact_phone: phone,
          contact_address: address,
          contact_discord: discord,
          contact_twitter: twitter,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Contact info saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/footer-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLinkLabel, url: newLinkUrl }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setNewLinkLabel("");
      setNewLinkUrl("");
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Footer link added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/site-settings/footer-links/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Footer link removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addWordMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/banned-words", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: newWord }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setNewWord("");
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Word added to filter" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteWordMutation = useMutation({
    mutationFn: async (word: string) => {
      const res = await fetch(`/api/site-settings/banned-words/${encodeURIComponent(word)}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Word removed from filter" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // XP / Points reward settings
  const XP_LABELS: Record<string, { label: string; description: string; icon: "xp" | "pts" }> = {
    xp_upload_account:    { label: "Upload Account (XP)",      description: "XP earned when a user submits an account listing",         icon: "xp"  },
    points_upload_account:{ label: "Upload Account (Points)",  description: "Points earned when a user submits an account listing",     icon: "pts" },
    xp_redeem_adlink:     { label: "Redeem Ad Link",           description: "XP earned when a user redeems an ad link code",           icon: "xp"  },
    xp_post_comment:      { label: "Post Comment",             description: "XP earned when a user posts a comment",                   icon: "xp"  },
    xp_like_comment:      { label: "Like a Comment",           description: "XP earned when a user likes a comment",                   icon: "xp"  },
    xp_like_account:      { label: "Like an Account",          description: "XP earned (by liker & poster) when liking an account",   icon: "xp"  },
    points_registration:  { label: "Registration Bonus",       description: "Points given to every new user on sign-up",               icon: "pts" },
  };

  const { data: xpData } = useQuery({
    queryKey: ["site-settings-xp"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings/xp-points", { credentials: "include" });
      if (!res.ok) return {};
      return res.json() as Promise<Record<string, number>>;
    },
  });

  const [xpValues, setXpValues] = useState<Record<string, number>>({});
  const xpInitialized = useState(false);
  if (xpData && !xpInitialized[0]) {
    xpInitialized[1](true);
    setXpValues(xpData);
  }

  const saveXpMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, number> = {};
      for (const key of Object.keys(XP_LABELS)) {
        if (xpValues[key] !== undefined) body[key] = xpValues[key];
      }
      const res = await fetch("/api/site-settings/xp-points", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings-xp"] });
      toast({ title: "Rewards settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Contact Info */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground text-lg">Contact Information</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">This information will be displayed in the site footer for visitors to see.</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="support@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="123 Main St, City, Country" value={address} onChange={(e) => setAddress(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Discord Invite URL</label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="https://discord.gg/..." value={discord} onChange={(e) => setDiscord(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Twitter / X Profile URL</label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="https://x.com/yourusername" value={twitter} onChange={(e) => setTwitter(e.target.value)} className="pl-9" />
            </div>
          </div>
          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Contact Info"}
          </Button>
        </div>
      </div>

      {/* Footer Links */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <ExternalLink className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground text-lg">Footer Links</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Add custom links that appear in the footer for all visitors.</p>

        {/* Add new link */}
        <div className="flex gap-2 mb-5">
          <Input
            placeholder="Label (e.g. Privacy Policy)"
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="URL (e.g. /privacy)"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => addLinkMutation.mutate()}
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim() || addLinkMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Existing links */}
        {(data?.footerLinks ?? []).length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No footer links yet. Add one above.
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.footerLinks ?? []).map((link) => (
              <div key={link.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-2.5 border border-border">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm text-foreground">{link.label}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{link.url}</span>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => deleteLinkMutation.mutate(link.id)}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Word Filter */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground text-lg">Word Filter</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Custom words added here will be replaced with <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">[***]</code> in all new account descriptions and comments. A built-in list of profanity is always active.
        </p>

        {/* Add new word */}
        <div className="flex gap-2 mb-5">
          <Input
            placeholder="Enter a word to ban..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newWord.trim()) addWordMutation.mutate(); }}
            className="flex-1"
          />
          <Button
            onClick={() => addWordMutation.mutate()}
            disabled={!newWord.trim() || addWordMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Word list */}
        {(data?.bannedWords ?? []).length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No custom words added yet. The built-in filter is still active.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(data?.bannedWords ?? []).map((word) => (
              <div key={word} className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-full px-3 py-1 text-sm font-medium">
                <span>{word}</span>
                <button
                  onClick={() => deleteWordMutation.mutate(word)}
                  className="hover:opacity-70 transition-opacity ml-0.5 text-destructive"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* XP & Points Rewards */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground text-lg">XP &amp; Points Rewards</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Control how much XP or points users receive for each action. Changes apply to all future events.
        </p>
        <div className="space-y-3">
          {Object.entries(XP_LABELS).map(([key, { label, description, icon }]) => (
            <div key={key} className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  type="number"
                  min={0}
                  value={xpValues[key] ?? ""}
                  onChange={(e) => setXpValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-24 h-9 text-center font-mono"
                />
                <span className="text-xs font-bold text-primary w-7">
                  {icon === "xp" ? "XP" : "pts"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full mt-5" onClick={() => saveXpMutation.mutate()} disabled={saveXpMutation.isPending}>
          {saveXpMutation.isPending ? "Saving..." : "Save Reward Settings"}
        </Button>
      </div>

      {/* Ticker Bar */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground text-lg">Home Page Ticker Bar</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{tickerEnabled ? "Visible" : "Hidden"}</span>
            <button
              onClick={() => setTickerEnabled(!tickerEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tickerEnabled ? "bg-primary" : "bg-muted border border-border"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tickerEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Shows a pill-shaped banner below the site title on the home page. Great for promotions or links.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-20 shrink-0">
              <label className="text-xs font-medium text-foreground mb-1.5 block">Icon (emoji or image URL)</label>
              <Input placeholder="🎮 or https://..." value={tickerIcon} onChange={(e) => setTickerIcon(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-foreground mb-1.5 block">Bar Text</label>
              <Input placeholder="e.g. Crypto Payment Gateway" value={tickerText} onChange={(e) => setTickerText(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-foreground mb-1.5 block">Link Button Label</label>
              <Input placeholder="e.g. Visit Now" value={tickerLinkLabel} onChange={(e) => setTickerLinkLabel(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-foreground mb-1.5 block">Link URL</label>
              <Input placeholder="https://..." value={tickerLinkUrl} onChange={(e) => setTickerLinkUrl(e.target.value)} />
            </div>
          </div>
          {tickerEnabled && tickerText && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Preview:</p>
              <div className="inline-flex items-center gap-3 bg-card border border-border rounded-full px-4 py-2 shadow-sm">
                {tickerIcon && <span className="text-lg leading-none">{tickerIcon}</span>}
                <span className="text-sm font-semibold text-foreground">{tickerText}</span>
                {tickerLinkLabel && (
                  <span className="flex items-center gap-1 bg-muted border border-border rounded-full px-3 py-1 text-xs font-bold text-foreground">
                    {tickerLinkLabel}
                    <ChevronDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                  </span>
                )}
              </div>
            </div>
          )}
          <Button className="w-full" onClick={() => saveTickerMutation.mutate()} disabled={saveTickerMutation.isPending}>
            {saveTickerMutation.isPending ? "Saving..." : "Save Ticker"}
          </Button>
        </div>
      </div>

      {/* Ads Management */}
      <AdsManagerSection />
    </div>
  );
}

function AdsManagerSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newPlacement, setNewPlacement] = useState<"home" | "browse">("home");

  const { data: ads = [], isLoading: adsLoading } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings/ads/all", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<any[]>;
    },
  });

  const addAdMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/ads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placement: newPlacement, imageUrl: newImageUrl, linkUrl: newLinkUrl }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setNewImageUrl("");
      setNewLinkUrl("");
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      queryClient.invalidateQueries({ queryKey: ["ads"] });
      toast({ title: "Ad added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleAdMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await fetch(`/api/site-settings/ads/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      queryClient.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAdMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/site-settings/ads/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      queryClient.invalidateQueries({ queryKey: ["ads"] });
      toast({ title: "Ad deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const homeAds = ads.filter((a: any) => a.placement === "home");
  const browseAds = ads.filter((a: any) => a.placement === "browse");

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShoppingBag className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground text-lg">Ad Placements</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Add image ads (PNG, JPG, or GIF) to the Homepage or Browse page. Each ad links to a URL when clicked.
      </p>

      {/* Add new ad */}
      <div className="space-y-3 mb-6 bg-muted/30 rounded-lg p-4 border border-border">
        <p className="text-sm font-semibold text-foreground">Add New Ad</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Image URL (PNG / JPG / GIF)</label>
            <Input
              placeholder="https://example.com/ad.gif"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
          </div>
          <div className="w-32 shrink-0">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Page</label>
            <select
              value={newPlacement}
              onChange={(e) => setNewPlacement(e.target.value as "home" | "browse")}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="home">Homepage</option>
              <option value="browse">Browse</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Destination URL</label>
          <Input
            placeholder="https://advertiser.com"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
          />
        </div>
        {newImageUrl && (
          <div className="rounded-lg overflow-hidden border border-border max-h-32">
            <img src={newImageUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <Button
          className="w-full"
          onClick={() => addAdMutation.mutate()}
          disabled={addAdMutation.isPending || !newImageUrl.trim() || !newLinkUrl.trim()}
        >
          {addAdMutation.isPending ? "Adding..." : "Add Ad"}
        </Button>
      </div>

      {/* Existing ads grouped by placement */}
      {adsLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading ads...</div>
      ) : ads.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
          No ads yet. Add one above.
        </div>
      ) : (
        <div className="space-y-6">
          {[{ label: "Homepage", key: "home", list: homeAds }, { label: "Browse Page", key: "browse", list: browseAds }].map(({ label, list }) => (
            list.length > 0 && (
              <div key={label}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">{label}</p>
                <div className="space-y-3">
                  {list.map((ad: any) => (
                    <div key={ad.id} className="flex items-center gap-3 bg-muted/20 border border-border rounded-lg p-3">
                      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={ad.imageUrl} alt="Ad" className="h-14 w-24 object-cover rounded-md border border-border" />
                      </a>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{ad.imageUrl}</p>
                        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                          {ad.linkUrl}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleAdMutation.mutate({ id: ad.id, active: !ad.active })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ad.active ? "bg-primary" : "bg-muted border border-border"}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${ad.active ? "translate-x-5" : "translate-x-1"}`} />
                        </button>
                        <button
                          onClick={() => deleteAdMutation.mutate(ad.id)}
                          className="text-destructive hover:text-destructive/80 transition-colors p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// --- Pending Review Tab ---
async function fetchPendingAccounts() {
  const res = await fetch("/api/admin/pending-accounts", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load pending accounts");
  return res.json() as Promise<any[]>;
}

async function approveAccount(accountId: number, games: string[]) {
  const res = await fetch(`/api/admin/accounts/${accountId}/approve`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ games }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function rejectAccount(accountId: number, note: string) {
  const res = await fetch(`/api/admin/accounts/${accountId}/reject`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

function PremiumAdminTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [grantTier, setGrantTier] = useState<"premium" | "pro">("premium");
  const [grantDays, setGrantDays] = useState(30);
  const [contactUrl, setContactUrl] = useState("/messages");
  const [contactUrlLoaded, setContactUrlLoaded] = useState(false);
  const [premiumPointsPrice, setPremiumPointsPrice] = useState<number>(500);
  const [premiumUsdCents, setPremiumUsdCents] = useState<number>(999);
  const [proUsdCents, setProUsdCents] = useState<number>(1999);
  const [premiumDiscountPercent, setPremiumDiscountPercent] = useState<number>(0);
  const premiumPricingInitialized = useState(false);
  const [codeGenTier, setCodeGenTier] = useState<"premium" | "pro">("premium");
  const [codeGenDays, setCodeGenDays] = useState(30);
  const [codeGenMaxUses, setCodeGenMaxUses] = useState(1);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: allUsers = [] } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });

  const { data: pricing } = useQuery({
    queryKey: ["premium-pricing-admin"],
    queryFn: async () => {
      const res = await fetch("/api/premium/pricing");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: codes = [], refetch: refetchCodes } = useQuery({
    queryKey: ["admin-premium-codes"],
    queryFn: async () => {
      const res = await fetch("/api/premium/codes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (pricing && !contactUrlLoaded) {
    setContactUrlLoaded(true);
    setContactUrl(pricing.proContactUrl ?? "/messages");
  }

  if (pricing && !premiumPricingInitialized[0]) {
    premiumPricingInitialized[1](true);
    setPremiumPointsPrice(pricing.premiumPointsPrice ?? 500);
    setPremiumUsdCents(pricing.premiumUsdCents ?? 999);
    setProUsdCents(pricing.proUsdCents ?? 1999);
    setPremiumDiscountPercent(pricing.discountPercent ?? 0);
  }

  const savePremiumPricingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/xp-points", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          premium_points_price: premiumPointsPrice,
          premium_usd_cents: premiumUsdCents,
          pro_usd_cents: proUsdCents,
          premium_discount_percent: premiumDiscountPercent,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premium-pricing-admin"] });
      toast({ title: "Premium pricing saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/premium/generate-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: codeGenTier, days: codeGenDays, maxUses: codeGenMaxUses }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data: any) => {
      setGeneratedCode(data.code);
      refetchCodes();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deactivateCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/premium/codes/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { refetchCodes(); toast({ title: "Code deactivated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = search.trim().length > 0
    ? (allUsers as any[]).filter((u) => u.username.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/premium/grant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, tier: grantTier, days: grantDays }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: `✨ ${grantTier === "pro" ? "Pro" : "Premium"} granted to ${selectedUser.username} for ${grantDays} days` });
      const expiresAt = new Date(Date.now() + grantDays * 24 * 60 * 60 * 1000).toISOString();
      setSelectedUser((u: any) => ({ ...u, premiumTier: grantTier, premiumExpiresAt: expiresAt }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/premium/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: `Premium revoked from ${selectedUser.username}` });
      setSelectedUser((u: any) => ({ ...u, premiumTier: null, premiumExpiresAt: null }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveContactUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/premium/contact-url", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: contactUrl }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premium-pricing-admin"] });
      toast({ title: "Pro contact URL saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Grant / Revoke */}
      <div className="bg-card border border-yellow-500/20 rounded-xl p-6 space-y-4">
        <h3 className="font-bold text-foreground text-base flex items-center gap-2">
          <Coins className="h-5 w-5 text-yellow-400" /> Grant / Revoke Premium
        </h3>
        <p className="text-sm text-muted-foreground">
          Search for a user by username and grant them Premium or Pro access manually (e.g. after they pay via messages).
        </p>

        <Input
          placeholder="Search users by username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }}
          className="max-w-sm"
        />

        {filtered.length > 0 && !selectedUser && (
          <div className="bg-muted/30 border border-border rounded-lg divide-y divide-border">
            {filtered.map((u: any) => (
              <button
                key={u.id}
                onClick={() => { setSelectedUser(u); setSearch(u.username); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(u.username?.substring(0, 2) ?? "").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.premiumTier ? <span className="text-yellow-400">★ {u.premiumTier}</span> : "No premium"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="bg-muted/30 border border-yellow-500/20 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-sm font-bold text-yellow-400 shrink-0">
                {(selectedUser.username?.substring(0, 2) ?? "").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{selectedUser.username}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedUser.premiumTier
                    ? `Active: ${selectedUser.premiumTier} — expires ${selectedUser.premiumExpiresAt ? new Date(selectedUser.premiumExpiresAt).toLocaleDateString() : "—"}`
                    : "No premium subscription"}
                </p>
              </div>
              <button onClick={() => { setSelectedUser(null); setSearch(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Tier to grant</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGrantTier("premium")}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${grantTier === "premium" ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >⭐ Premium</button>
                  <button
                    onClick={() => setGrantTier("pro")}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${grantTier === "pro" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >💎 Pro</button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Duration (days)</p>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={grantDays}
                  onChange={(e) => setGrantDays(Math.max(1, Number(e.target.value)))}
                  className="w-24 h-9 font-mono text-center"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  onClick={() => grantMutation.mutate()}
                  disabled={grantMutation.isPending}
                >
                  {grantMutation.isPending ? "Granting..." : `Grant ${grantTier === "pro" ? "Pro" : "Premium"}`}
                </Button>
                {selectedUser.premiumTier && (
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => revokeMutation.mutate()}
                    disabled={revokeMutation.isPending}
                  >
                    {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pro Contact URL */}
      <div className="bg-card border border-blue-500/20 rounded-xl p-6 space-y-4">
        <h3 className="font-bold text-foreground text-base flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-blue-400" /> Pro "Buy" Button Link
        </h3>
        <p className="text-sm text-muted-foreground">
          Where users are sent when they click <strong className="text-foreground">Buy Pro</strong> on the Premium page.
          Use a relative path like <code className="text-xs bg-muted px-1 rounded">/messages</code> or a full external URL.
        </p>
        <div className="flex gap-2 max-w-lg">
          <Input
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="/messages"
            className="flex-1 font-mono text-sm"
          />
          <Button onClick={() => saveContactUrlMutation.mutate()} disabled={saveContactUrlMutation.isPending}>
            {saveContactUrlMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        {contactUrl && (
          <p className="text-xs text-muted-foreground">
            Current link:{" "}
            <span className="font-mono text-primary">{contactUrl}</span>
          </p>
        )}
      </div>

      {/* Premium Pricing */}
      <div className="bg-card border border-yellow-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-yellow-400 font-bold text-xl">✨</span>
          <h3 className="font-bold text-foreground text-lg">Premium &amp; Pro Pricing</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Set subscription prices. Set discount % &gt; 0 to show a red strikethrough on the original price.</p>
        <div className="space-y-3">
          <div className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3 border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Premium — Points Price</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cost in points to buy Premium for 30 days</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input type="number" min={0} value={premiumPointsPrice} onChange={(e) => setPremiumPointsPrice(Number(e.target.value))} className="w-24 h-9 text-center font-mono" />
              <span className="text-xs font-bold text-primary w-7">pts</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3 border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Premium — USD Price</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cost in cents (e.g. 999 = $9.99/mo)</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input type="number" min={0} value={premiumUsdCents} onChange={(e) => setPremiumUsdCents(Number(e.target.value))} className="w-24 h-9 text-center font-mono" />
              <span className="text-xs font-bold text-primary w-7">¢</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3 border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Pro — USD Price</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cost in cents (e.g. 1999 = $19.99/mo)</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input type="number" min={0} value={proUsdCents} onChange={(e) => setProUsdCents(Number(e.target.value))} className="w-24 h-9 text-center font-mono" />
              <span className="text-xs font-bold text-primary w-7">¢</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3 border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Discount %</p>
              <p className="text-xs text-muted-foreground mt-0.5">Set &gt; 0 to show <span className="text-red-400 line-through">original</span> price with red strikethrough</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input type="number" min={0} max={99} value={premiumDiscountPercent} onChange={(e) => setPremiumDiscountPercent(Math.min(99, Math.max(0, Number(e.target.value))))} className="w-24 h-9 text-center font-mono" />
              <span className="text-xs font-bold text-primary w-7">%</span>
            </div>
          </div>
        </div>
        <Button className="w-full mt-5 bg-yellow-500 hover:bg-yellow-600 text-black font-bold" onClick={() => savePremiumPricingMutation.mutate()} disabled={savePremiumPricingMutation.isPending}>
          {savePremiumPricingMutation.isPending ? "Saving..." : "Save Pricing"}
        </Button>
      </div>

      {/* Code Generator */}
      <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-5">
        <h3 className="font-bold text-foreground text-base flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Redeem Code Generator
        </h3>
        <p className="text-sm text-muted-foreground">Generate single-use or multi-use codes to gift premium access to users.</p>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Tier</p>
            <div className="flex gap-2">
              <button onClick={() => setCodeGenTier("premium")} className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${codeGenTier === "premium" ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground hover:text-foreground"}`}>⭐ Premium</button>
              <button onClick={() => setCodeGenTier("pro")} className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${codeGenTier === "pro" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-border text-muted-foreground hover:text-foreground"}`}>💎 Pro</button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Duration (days)</p>
            <Input type="number" min={1} max={365} value={codeGenDays} onChange={(e) => setCodeGenDays(Math.max(1, Number(e.target.value)))} className="w-24 h-9 font-mono text-center" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Max uses</p>
            <Input type="number" min={1} max={1000} value={codeGenMaxUses} onChange={(e) => setCodeGenMaxUses(Math.max(1, Number(e.target.value)))} className="w-24 h-9 font-mono text-center" />
          </div>
          <Button onClick={() => generateCodeMutation.mutate()} disabled={generateCodeMutation.isPending} className="bg-primary hover:bg-primary/90">
            {generateCodeMutation.isPending ? "Generating..." : "Generate Code"}
          </Button>
        </div>

        {generatedCode && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <code className="font-mono text-primary font-bold text-lg tracking-widest flex-1">{generatedCode}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(generatedCode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copy code"
            >
              {copiedCode ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* Codes list */}
        {(codes as any[]).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Codes</p>
            <div className="bg-muted/30 border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
              {(codes as any[]).map((c: any) => (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${!c.is_active ? "opacity-40" : ""}`}>
                  <code className="font-mono font-bold text-primary flex-1 text-xs">{c.code}</code>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.tier === "pro" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>{c.tier}</span>
                  <span className="text-xs text-muted-foreground">{c.days}d</span>
                  <span className="text-xs text-muted-foreground">{c.uses_count}/{c.max_uses}</span>
                  {c.is_active && (
                    <button onClick={() => deactivateCodeMutation.mutate(c.id)} className="text-destructive hover:text-destructive/80 transition-colors ml-1" title="Deactivate">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingReviewTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});
  const [gameSelections, setGameSelections] = useState<Record<number, string[]>>({});
  const [showPassword, setShowPassword] = useState<Record<number, boolean>>({});

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied`, description: text });
    });
  };

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["admin-pending-accounts"],
    queryFn: fetchPendingAccounts,
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, games }: { id: number; games: string[] }) => approveAccount(id, games),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-accounts"] });
      toast({ title: "Account approved", description: "It's now live and the user earned 50 XP." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => rejectAccount(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-accounts"] });
      toast({ title: "Account rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getGames = (acc: any): string[] => {
    if (gameSelections[acc.id]) return gameSelections[acc.id];
    return acc.games ?? [];
  };

  const initGames = (acc: any) => {
    if (!gameSelections[acc.id]) {
      setGameSelections((prev) => ({ ...prev, [acc.id]: [...(acc.games ?? [])] }));
    }
  };

  const toggleGame = (accountId: number, game: string) => {
    setGameSelections((prev) => {
      const current = prev[accountId] ?? [];
      return {
        ...prev,
        [accountId]: current.includes(game)
          ? current.filter((g) => g !== game)
          : [...current, game],
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Hourglass className="h-5 w-5 animate-pulse mr-2" /> Loading pending reviews…
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <p className="text-lg font-semibold text-foreground">All clear!</p>
        <p className="text-sm text-muted-foreground mt-1">No accounts are pending review right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Hourglass className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-bold text-foreground">Pending Reviews</h2>
        <span className="ml-1 bg-amber-500/20 text-amber-600 border border-amber-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
          {pending.length}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        These paid account listings are waiting for your approval before going live. You can remove individual games before approving.
      </p>

      {pending.map((acc: any) => {
        const isExpanded = expandedId === acc.id;
        const games = getGames(acc);
        const allGames: string[] = acc.games ?? [];

        return (
          <div key={acc.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-4 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground truncate">{acc.title}</span>
                  <span className="bg-amber-500/15 text-amber-600 border border-amber-500/25 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Pending</span>
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{acc.pointsCost} pts</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span>by {acc.posterUsername ?? "Unknown"}</span>
                  <span>·</span>
                  <span>{allGames.length} games</span>
                  <span>·</span>
                  <span>{new Date(acc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => { setExpandedId(isExpanded ? null : acc.id); initGames(acc); }}
                className="p-2 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Expand"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-5 py-4 space-y-5">
                {/* Description */}
                {acc.description && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-foreground">{acc.description}</p>
                  </div>
                )}

                {/* Steam Credentials */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Steam Credentials — for testing only
                  </p>
                  {/* Username */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Username</span>
                    <code className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground select-all">
                      {acc.steamUsername}
                    </code>
                    <button
                      onClick={() => copyToClipboard(acc.steamUsername, "Username")}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Copy username"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Password */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Password</span>
                    <code className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground select-all">
                      {showPassword[acc.id] ? acc.steamPassword : "••••••••••••"}
                    </code>
                    <button
                      onClick={() => setShowPassword((p) => ({ ...p, [acc.id]: !p[acc.id] }))}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title={showPassword[acc.id] ? "Hide password" : "Show password"}
                    >
                      {showPassword[acc.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(acc.steamPassword, "Password")}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Copy password"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Game selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Games — toggle to show/hide ({games.length}/{allGames.length} selected)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGameSelections((p) => ({ ...p, [acc.id]: [...allGames] }))}
                        className="text-xs text-primary hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button
                        onClick={() => setGameSelections((p) => ({ ...p, [acc.id]: [] }))}
                        className="text-xs text-destructive hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {allGames.map((game: string) => {
                      const isVisible = games.includes(game);
                      return (
                        <button
                          key={game}
                          onClick={() => toggleGame(acc.id, game)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            isVisible
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-muted/40 border-border text-muted-foreground line-through"
                          }`}
                          title={isVisible ? "Click to hide this game" : "Click to show this game"}
                        >
                          {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {game}
                        </button>
                      );
                    })}
                  </div>
                  {games.length === 0 && (
                    <p className="text-xs text-amber-500 mt-2">⚠ All games are hidden — at least one game must be visible to approve.</p>
                  )}
                </div>

                {/* Reject note */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Rejection reason (optional)</p>
                  <input
                    type="text"
                    className="w-full border border-border bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Invalid credentials, spam listing…"
                    value={rejectNote[acc.id] ?? ""}
                    onChange={(e) => setRejectNote((p) => ({ ...p, [acc.id]: e.target.value }))}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={games.length === 0 || approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ id: acc.id, games })}
                  >
                    <Check className="h-4 w-4" />
                    Approve & Publish
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ id: acc.id, note: rejectNote[acc.id] ?? "" })}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
