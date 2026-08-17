import { Layout } from "@/components/layout";
import {
  useGetMe,
  useDeleteAccount,
  useListAdLinks,
  useCreateAdLink,
  useDeleteAdLink,
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
import { Fragment, useState, useEffect, type ReactNode } from "react";
import { Shield, Trash, Copy, Ban, CheckCircle, UserCheck, Flag, Coins, UserX, Megaphone, Pin, PinOff, Plus, ShoppingBag, Package, Star, Settings, Mail, Phone, MapPin, ExternalLink, X, Hourglass, Check, XCircle, ChevronDown, ChevronUp, Eye, EyeOff, Zap, ArrowLeft, Users, LayoutDashboard, Pencil, Gift, CheckCheck, Menu, RefreshCw, MessageSquare, Send, RotateCcw, DollarSign, AlertTriangle, MessageCircle, SlidersHorizontal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { MarkdownEditor } from "@/components/markdown-editor";

// --- Dashboard ---
async function fetchDashboard() {
  const res = await fetch("/api/admin/dashboard", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{
    users: { total: number; new24h: number; new7d: number; new30d: number; banned: number; premium: number; vip: number };
    accounts: { total: number; new24h: number; new7d: number; removed: number; pending: number };
    reports: { total: number; open: number };
    activity: { totalClaims: number; pointsCirculating: number };
  }>;
}

function DashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: fetchDashboard, refetchInterval: 120_000 });
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

      {/* Membership */}
      <section>
        <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Star className="h-4 w-4 text-yellow-400" /> Membership</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={<Star className="h-5 w-5" />} label="Premium Users" value={data.users.premium} sub="Active Premium memberships" color="text-yellow-400" />
          <StatCard icon={<Zap className="h-5 w-5" />} label="VIP / Pro Users" value={data.users.vip} sub="Active VIP/Pro memberships" color="text-blue-400" />
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
async function fetchAdminUsers(search = "") {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const res = await fetch(`/api/admin/users${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load users");
  return res.json() as Promise<any[]>;
}

async function fetchAdminAccounts(search = "") {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const res = await fetch(`/api/admin/accounts${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load accounts");
  return res.json() as Promise<{ accounts: any[]; limit: number }>;
}

async function fetchPremiumUsers() {
  const res = await fetch("/api/admin/premium-users", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load premium users");
  return res.json() as Promise<{ users: any[]; limit: number }>;
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

async function fetchPendingAccounts() {
  const res = await fetch("/api/admin/pending-accounts", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load pending accounts");
  return res.json() as Promise<any[]>;
}

async function approveAccount(id: number, games?: string[], pointsCost?: number) {
  const res = await fetch(`/api/admin/accounts/${id}/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ games, pointsCost }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to approve account");
  }
  return res.json();
}

async function updatePendingAccount(id: number, data: { games?: string[]; pointsCost?: number; title?: string; description?: string }) {
  const res = await fetch(`/api/admin/accounts/${id}/review-edit`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update account");
  }
  return res.json();
}

async function rejectAccount(id: number, note: string) {
  const res = await fetch(`/api/admin/accounts/${id}/reject`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to reject account");
  }
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
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const isAdmin = !!user?.isAdmin;
  const isModerator = !!user?.isModerator;
  const canAccess = isAdmin || isModerator;

  // Real-time counts for badges
  const { data: pendingAccounts = [] } = useQuery({
    queryKey: ["admin-pending-accounts"],
    queryFn: fetchPendingAccounts,
    refetchInterval: 30_000,
    enabled: canAccess,
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: fetchReports,
    refetchInterval: 30_000,
    enabled: canAccess,
  });

  const pendingCount = pendingAccounts.length;
  const reportsCount = allReports.filter((r: any) => !r.isDismissed).length;

  useEffect(() => {
    if (!userLoading && !canAccess) {
      setLocation("/login");
    }
    if (!isAdmin && activeTab === "dashboard") {
      setActiveTab("pending");
    }
  }, [setLocation, canAccess, userLoading, isAdmin, activeTab]);

  if (userLoading || !canAccess) {
    return null;
  }

  // Sidebar navigation structure grouped logically
  const navSections = [
    {
      group: "Moderation",
      items: [
        { value: "pending", label: "Pending Reviews", icon: Hourglass, modAllowed: true, badge: pendingCount, badgeColor: "bg-amber-500/20 text-amber-500 border border-amber-500/30" },
        { value: "reports", label: "Reports", icon: Flag, modAllowed: true, badge: reportsCount, badgeColor: "bg-red-500/20 text-red-500 border border-red-500/30" },
        { value: "users", label: "Users", icon: Users, modAllowed: true },
      ],
    },
    {
      group: "Overview & Content",
      items: [
        { value: "dashboard", label: "Dashboard", icon: LayoutDashboard, modAllowed: false },
        { value: "store", label: "Store", icon: ShoppingBag, modAllowed: false },
        { value: "announcements", label: "News & Alerts", icon: Megaphone, modAllowed: false },
      ],
    },
    {
      group: "System & Security",
      items: [
        { value: "site-settings", label: "Site Settings", icon: Settings, modAllowed: false },
        { value: "premium", label: "Premium & VIP", icon: Star, modAllowed: false },
        { value: "ip-bans", label: "IP Bans", icon: Ban, modAllowed: false },
        { value: "deleted-accounts", label: "Deleted Archive", icon: Trash, modAllowed: false },
      ],
    },
  ];

  // Filter sections for role
  const visibleSections = navSections.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => (isAdmin ? true : item.modAllowed)),
  })).filter((sec) => sec.items.length > 0);

  const currentTabObj = visibleSections.flatMap((s) => s.items).find((i) => i.value === activeTab);

  const renderNavList = () => (
    <div className="space-y-6">
      {visibleSections.map((section) => (
        <div key={section.group} className="space-y-1.5">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {section.group}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => {
                    setActiveTab(item.value);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${isActive ? "bg-black/20 text-white" : item.badgeColor || "bg-secondary text-foreground"}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        {/* Mobile Header Bar */}
        <div className="lg:hidden sticky top-14 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-border"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 truncate">
              {currentTabObj?.icon && (
                <currentTabObj.icon className="h-4 w-4 text-primary shrink-0" />
              )}
              <span className="font-bold text-foreground text-sm truncate">
                {currentTabObj?.label ?? "Admin Panel"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border-primary/30 text-primary">
              {isAdmin ? "Admin" : "Mod"}
            </Badge>
          </div>
        </div>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Sidebar drawer */}
            <div className="relative z-50 w-72 max-w-[85vw] bg-card border-r border-border h-full flex flex-col p-4 overflow-y-auto animate-in slide-in-from-left duration-200 shadow-2xl">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Control Center</h2>
                    <p className="text-[11px] text-muted-foreground">{isAdmin ? "Administrator" : "Moderator"}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1">
                {renderNavList()}
              </div>

              <div className="pt-4 mt-4 border-t border-border">
                <button
                  onClick={() => { setMobileMenuOpen(false); window.history.back(); }}
                  className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg bg-secondary/50 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to SteamShare
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid Container with Desktop Sidebar */}
        <div className="max-w-7xl mx-auto flex">
          {/* Desktop Left Sidebar */}
          <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card/60 min-h-[calc(100vh-4rem)] p-4 space-y-6">
            {/* Brand Header */}
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight text-foreground truncate">Command Center</h1>
                <span className="inline-block text-[10px] font-bold text-primary tracking-wide uppercase">
                  {isAdmin ? "Administrator" : "Moderator"}
                </span>
              </div>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 space-y-1">
              {renderNavList()}
            </nav>

            {/* User Profile / Footer status */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
                  {user?.username?.[0]?.toUpperCase() ?? "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">@{user?.username}</p>
                  <p className="text-[10px] text-muted-foreground">{user?.points ?? 0} pts · Lvl {user?.level ?? 1}</p>
                </div>
              </div>
              <button
                onClick={() => window.history.back()}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to SteamShare
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
            {/* Header for current tab */}
            <div className="mb-6 pb-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-black text-foreground flex items-center gap-2.5">
                  {currentTabObj?.icon && <currentTabObj.icon className="h-6 w-6 text-primary" />}
                  {currentTabObj?.label ?? "Admin"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === "pending" && "Review and approve paid account listings before they go live on SteamShare."}
                  {activeTab === "reports" && "Investigate reported accounts and comments with instant Steam account checking & refund tools."}
                  {activeTab === "users" && "Manage user accounts, ban durations, moderator permissions, and points balances."}
                  {activeTab === "dashboard" && "Real-time statistics, registrations, activity analytics, and circulation metrics."}
                  {activeTab === "store" && "Configure VIP and Premium store packages, pricing, and perks."}
                  {activeTab === "announcements" && "Broadcast site-wide news, alerts, and popup announcements instantly."}
                  {activeTab === "site-settings" && "Configure automated word filters, XP rewards, ticker alerts, and ads."}
                  {activeTab === "premium" && "Grant premium subscriptions, manage pricing, and test checkout flows."}
                  {activeTab === "ip-bans" && "Block malicious IP addresses from registration and authentication."}
                  {activeTab === "deleted-accounts" && "Archive and restore soft-deleted or removed account listings."}
                </p>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="w-full">
              {isAdmin && activeTab === "dashboard" && <DashboardTab />}
              {activeTab === "pending" && <PendingReviewTab />}
              {activeTab === "users" && <UsersTab isAdmin={isAdmin} />}
              {activeTab === "reports" && <ReportsTab />}
              {isAdmin && activeTab === "store" && <StoreTab />}
              {isAdmin && activeTab === "announcements" && <AnnouncementsTab />}
              {isAdmin && activeTab === "site-settings" && <SiteSettingsTab />}
              {isAdmin && activeTab === "premium" && <PremiumAdminTab />}
              {isAdmin && activeTab === "ip-bans" && <IpBansTab />}
              {isAdmin && activeTab === "deleted-accounts" && <DeletedAccountsTab />}
            </div>
          </main>
        </div>
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
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: () => fetchAdminUsers(debouncedSearch),
  });

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
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
            ) : users.map((u: any) => (
              <Fragment key={u.id}>
                <TableRow key={u.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {expandedUser === u.id ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <div>
                        <span className="font-medium">{u.username}</span>
                        {u.displayName && u.displayName !== u.username && (
                          <div className="text-xs text-muted-foreground">{u.displayName}</div>
                        )}
                        <div className="text-xs text-muted-foreground">#{u.id}</div>
                      </div>
                    </div>
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
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                {expandedUser === u.id && (
                  <TableRow key={`${u.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={5} className="py-3 px-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Email</div>
                          <div className="font-mono text-foreground break-all">{u.email ?? "—"}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Registration IP</div>
                          <div className="font-mono text-foreground">{u.registrationIp ?? "—"}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Last Login IP</div>
                          <div className="font-mono text-foreground">{u.lastLoginIp ?? "—"}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Last Login</div>
                          <div className="text-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Joined</div>
                          <div className="text-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Premium</div>
                          <div className="text-foreground">{u.premiumTier ?? "None"}{u.premiumExpiresAt ? ` (until ${new Date(u.premiumExpiresAt).toLocaleDateString()})` : ""}</div>
                        </div>
                        {u.avatarUrl && (
                          <div className="space-y-0.5 col-span-2">
                            <div className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Avatar URL</div>
                            <div className="font-mono text-foreground break-all text-[10px]">{u.avatarUrl}</div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
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

type MessageUserTarget = {
  userId: number;
  username: string;
  reportId: number;
  contextTitle?: string;
};

type RefundTarget = {
  reportId: number;
  accountId: number;
  reporterId: number;
  reporterUsername: string;
  points: number;
  accountTitle?: string;
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

  // Check account state per accountId
  const [checkStates, setCheckStates] = useState<Record<number, { loading: boolean; status?: string; message?: string; checkStatus?: string; lastChecked?: string }>>({});

  // Message modal state
  const [messageTarget, setMessageTarget] = useState<MessageUserTarget | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Refund modal state
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [isRefunding, setIsRefunding] = useState(false);

  const { data: reports = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: fetchReports,
  });

  const dismissMutation = useMutation({
    mutationFn: (reportId: number) => dismissReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "Report dismissed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: (reportId: number) => actionReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "Report actioned — notification sent via Bot" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleCheckAccount(accountId: number) {
    setCheckStates((p) => ({ ...p, [accountId]: { loading: true } }));
    try {
      const res = await fetch(`/api/accounts/${accountId}/check`, { method: "POST", credentials: "include" });
      const data = await res.json();
      setCheckStates((p) => ({
        ...p,
        [accountId]: {
          loading: false,
          status: data.status,
          message: data.message,
          checkStatus: data.checkStatus,
          lastChecked: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      }));
      if (data.status === "valid" && data.checkStatus === "live") {
        toast({ title: "Account Verified: LIVE", description: "Steam credentials are fully valid and operational." });
      } else if (data.status === "invalid" || data.checkStatus === "dead") {
        toast({ title: "Account Status: DEAD", description: data.message || "Steam credentials failed.", variant: "destructive" });
      } else if (data.checkStatus === "2fa") {
        toast({ title: "Account Status: 2FA Prompt", description: "Steam Guard code active.", variant: "destructive" });
      } else {
        toast({ title: "Check Result", description: data.message || data.status });
      }
    } catch (e: any) {
      setCheckStates((p) => ({ ...p, [accountId]: { loading: false, status: "error", message: e.message } }));
      toast({ title: "Check failed", description: e.message, variant: "destructive" });
    }
  }

  async function handleSendMessage() {
    if (!messageTarget || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: messageTarget.userId,
          content: messageText.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send message");
      }
      toast({ title: "Message Sent", description: `Message delivered to @${messageTarget.username}` });
      setMessageTarget(null);
      setMessageText("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleProcessRefund() {
    if (!refundTarget) return;
    if (refundAmount < 0) {
      toast({ title: "Invalid amount", description: "Refund amount cannot be negative", variant: "destructive" });
      return;
    }
    setIsRefunding(true);
    try {
      const res = await fetch(`/api/admin/reports/${refundTarget.reportId}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: refundAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({
        title: "Refund Processed",
        description: `Successfully refunded ${data.amount} points to @${refundTarget.reporterUsername}. Bot notification sent.`,
      });
      setRefundTarget(null);
    } catch (e: any) {
      toast({ title: "Refund error", description: e.message, variant: "destructive" });
    } finally {
      setIsRefunding(false);
    }
  }

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
          <h2 className="font-bold text-lg">User Reports</h2>
          {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending</Badge>}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
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
          {filtered.map((report: any) => {
            const isAccount = report.targetType === "account";
            const accountCheck = isAccount ? checkStates[report.targetId] : null;
            const refundPointsValue = report.claimedPoints ?? report.accountCost ?? 0;

            return (
              <div
                key={report.id}
                className={`bg-card border rounded-xl p-4 transition-all ${
                  report.isDismissed
                    ? "opacity-50 border-border"
                    : report.isActioned
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-red-500/25 bg-red-500/5"
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                  {/* Report Details & Metadata */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider">
                        {report.targetType}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {isAccount ? (report.accountTitle ? `"${report.accountTitle}"` : `Account #${report.targetId}`) : `#${report.targetId}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by <strong className="text-foreground">@{report.reporterUsername}</strong>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        {report.reason}
                      </p>
                      {report.details && (
                        <p className="text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-lg p-2">
                          {report.details}
                        </p>
                      )}
                    </div>

                    {/* Account Info Box */}
                    {isAccount && (
                      <div className="bg-background/80 border border-border rounded-lg p-2.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            {report.accountUsername && (
                              <span>Steam User: <strong className="text-foreground font-mono">{report.accountUsername}</strong></span>
                            )}
                            {report.accountStatus && (
                              <Badge variant="outline" className="text-[10px] uppercase">
                                Status: {report.accountStatus}
                              </Badge>
                            )}
                            {refundPointsValue > 0 && (
                              <span className="text-amber-500 font-bold flex items-center gap-1">
                                <Coins className="h-3 w-3" /> Purchase Cost: {refundPointsValue} pts
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Instant Check Result display */}
                        {accountCheck && (
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {accountCheck.loading ? (
                                <span className="flex items-center gap-1 text-primary animate-pulse">
                                  <RefreshCw className="h-3 w-3 animate-spin" /> Verifying Steam credentials live...
                                </span>
                              ) : accountCheck.status === "valid" && accountCheck.checkStatus === "live" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <CheckCircle className="h-3.5 w-3.5" /> LIVE / Credentials Valid
                                </span>
                              ) : accountCheck.checkStatus === "2fa" ? (
                                <span className="inline-flex items-center gap-1 text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                  <Shield className="h-3.5 w-3.5" /> 2FA / Steam Guard Required
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                  <XCircle className="h-3.5 w-3.5" /> DEAD / {accountCheck.message || "Invalid Credentials"}
                                </span>
                              )}
                            </div>
                            {accountCheck.lastChecked && (
                              <span className="text-[10px] text-muted-foreground">
                                Checked at {accountCheck.lastChecked}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comment report content */}
                    {report.targetType === "comment" && report.commentContent && (
                      <div className="bg-background border border-border rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Comment by <strong>@{report.commentAuthorUsername ?? "unknown"}</strong>:
                        </p>
                        <p className="text-sm italic text-foreground/80 line-clamp-3">"{report.commentContent}"</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 items-start lg:items-end w-full lg:w-auto">
                    {/* Check Account Button */}
                    {isAccount && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => handleCheckAccount(report.targetId)}
                        disabled={accountCheck?.loading}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${accountCheck?.loading ? "animate-spin" : ""}`} />
                        {accountCheck?.loading ? "Checking..." : "Check Acc"}
                      </Button>
                    )}

                    {/* Message Reporter Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 border-border hover:bg-secondary"
                      onClick={() => {
                        setMessageTarget({
                          userId: report.reporterId,
                          username: report.reporterUsername,
                          reportId: report.id,
                          contextTitle: isAccount ? report.accountTitle : undefined,
                        });
                        setMessageText(
                          isAccount
                            ? `Hello @${report.reporterUsername}, regarding your report on account "${report.accountTitle || report.targetId}": `
                            : `Hello @${report.reporterUsername}, regarding your report: `
                        );
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
                      Message User
                    </Button>

                    {/* Refund Button */}
                    {isAccount && !report.isDismissed && !report.isActioned && (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0"
                        onClick={() => {
                          setRefundTarget({
                            reportId: report.id,
                            accountId: report.targetId,
                            reporterId: report.reporterId,
                            reporterUsername: report.reporterUsername,
                            points: refundPointsValue || 100,
                            accountTitle: report.accountTitle,
                          });
                          setRefundAmount(refundPointsValue || 100);
                        }}
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Refund ({refundPointsValue > 0 ? `${refundPointsValue} pts` : "Points"})
                      </Button>
                    )}

                    {/* External Account Link */}
                    {isAccount && (
                      <a
                        href={`/accounts/${report.targetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View Acc
                      </a>
                    )}

                    {/* Status indicator or Action button */}
                    {report.isActioned && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1 flex items-center gap-1">
                        <CheckCheck className="h-3.5 w-3.5" /> Actioned
                      </span>
                    )}

                    {!report.isDismissed && !report.isActioned && (
                      report.targetType === "comment" ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                          onClick={() => setActionTarget({
                            reportId: report.id,
                            commentId: report.targetId,
                            commentContent: report.commentContent ?? "",
                            authorId: report.commentAuthorId ?? 0,
                            authorUsername: report.commentAuthorUsername ?? "unknown",
                          })}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Ban & Action
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                          onClick={() => actionMutation.mutate(report.id)}
                          disabled={actionMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Resolve (Bot Notify)
                        </Button>
                      )
                    )}

                    {!report.isDismissed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => dismissMutation.mutate(report.id)}
                        disabled={dismissMutation.isPending}
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Message User Dialog */}
      <Dialog
        open={!!messageTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMessageTarget(null);
            setMessageText("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-sky-500" />
              Message Reporter (@{messageTarget?.username})
            </DialogTitle>
          </DialogHeader>
          {messageTarget && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Send a direct notification message to the user who filed this report:
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Message Body</label>
                <textarea
                  className="w-full border border-border rounded-lg p-3 bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary h-28"
                  placeholder="Type your message to the reporter..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMessageTarget(null);
                    setMessageText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                  disabled={!messageText.trim() || isSendingMessage}
                  onClick={handleSendMessage}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSendingMessage ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              Issue Point Refund
            </DialogTitle>
          </DialogHeader>
          {refundTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1 text-xs">
                <p className="font-bold text-amber-600">
                  Refund to @{refundTarget.reporterUsername}
                </p>
                <p className="text-muted-foreground">
                  The refunded points will be credited immediately to the reporter's account balance, and an automated confirmation message will be sent via the <strong>Admin Bot</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Refund Amount (Points)</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                  <Input
                    type="number"
                    min={0}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="pl-9 font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Original purchase cost: {refundTarget.points} points.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setRefundTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={refundAmount <= 0 || isRefunding}
                  onClick={handleProcessRefund}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isRefunding ? "Processing Refund..." : `Refund ${refundAmount} pts`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

  const { data: announcements = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements,
    refetchInterval: 3000,
  });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "Pin updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Site Announcements</h3>
          <p className="text-sm text-muted-foreground">Posts that appear on the home page and every account page (live polling enabled).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
            title="Instant Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
            Refresh
          </Button>
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
  if (!res.ok) return { bannedWords: [] };
  return res.json() as Promise<{ bannedWords: string[] }>;
}

function SiteSettingsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings });

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

      {/* Email (SMTP) Settings */}
      <SmtpSettingsSection />
    </div>
  );
}

function SmtpSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: smtpData } = useQuery({
    queryKey: ["admin-smtp"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings/smtp", { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<{ smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string; smtp_from: string; configured: boolean; register_2fa_enabled: boolean }>;
    },
  });

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [register2faEnabled, setRegister2faEnabled] = useState(true);
  const smtpInitialized = useState(false);

  if (smtpData && !smtpInitialized[0]) {
    smtpInitialized[1](true);
    setHost(smtpData.smtp_host);
    setPort(smtpData.smtp_port);
    setUser(smtpData.smtp_user);
    setPass(smtpData.smtp_pass);
    setFrom(smtpData.smtp_from);
    setRegister2faEnabled(smtpData.register_2fa_enabled ?? true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/smtp", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp_host: host, smtp_port: port, smtp_user: user, smtp_pass: pass, smtp_from: from, register_2fa_enabled: register2faEnabled }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-smtp"] });
      toast({ title: "SMTP settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/site-settings/smtp/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send test email.");
      return data;
    },
    onSuccess: () => toast({ title: "Test email sent!", description: `Check ${testEmail} — if it arrived, SMTP is working.` }),
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground text-lg">Email (SMTP)</h3>
        {smtpData?.configured && (
          <span className="ml-auto text-xs bg-green-500/15 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5 font-medium">Configured</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Used to send 2FA login codes to users. Works with Gmail, Outlook, or any SMTP provider.<br />
        <span className="text-xs">For Gmail: use an <b>App Password</b> (not your regular password) — create one at Google Account → Security → 2-Step Verification → App passwords.</span>
      </p>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 mb-4">
        <div>
          <p className="text-sm font-medium text-foreground">Require 2FA on registration</p>
          <p className="text-xs text-muted-foreground mt-0.5">When enabled, new users must verify their email with a one-time code before their account is activated.</p>
        </div>
        <Switch
          checked={register2faEnabled}
          onCheckedChange={setRegister2faEnabled}
        />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-foreground mb-1.5 block">SMTP Host</label>
            <Input placeholder="smtp.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Port</label>
            <Input placeholder="587" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Username / Email</label>
          <Input placeholder="yourapp@gmail.com" value={user} onChange={(e) => setUser(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Password / App Password</label>
          <Input type="password" placeholder={smtpData?.configured ? "Leave blank to keep current" : "App password or SMTP password"} value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">From Address (optional)</label>
          <Input placeholder="Steam Family <noreply@yourapp.com>" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save SMTP Settings"}
        </Button>

        {/* Test email */}
        {smtpData?.configured && (
          <div className="pt-3 border-t border-border space-y-2">
            <label className="text-xs font-medium text-foreground block">Send a test email</label>
            <p className="text-xs text-muted-foreground">Enter any email address and click Send — you'll see the exact error if something is wrong.</p>
            <div className="flex gap-2">
              <Input
                placeholder="test@gmail.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                type="email"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={!testEmail.includes("@") || testMutation.isPending}
              >
                {testMutation.isPending ? "Sending…" : "Send Test"}
              </Button>
            </div>
          </div>
        )}
      </div>
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

  // Server-side user search for grant/revoke (finds any user, not just first 50)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-users-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<any[]>;
    },
    enabled: debouncedSearch.trim().length > 0,
  });
  const { data: premiumUsersData, isLoading: premiumUsersLoading } = useQuery({
    queryKey: ["admin-premium-users"],
    queryFn: fetchPremiumUsers,
  });

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

  const filtered = searchResults.slice(0, 8);

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
      queryClient.invalidateQueries({ queryKey: ["admin-premium-users"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-premium-users"] });
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

  const premiumUsers = premiumUsersData?.users ?? [];

  return (
    <div className="space-y-6">

      {/* Active Premium Users */}
      <div className="bg-card border border-yellow-500/20 rounded-xl p-6 space-y-4">
        <h3 className="font-bold text-foreground text-base flex items-center gap-2">
          <span className="text-yellow-400">★</span> Active Premium Users
          <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{premiumUsers.length}</span>
        </h3>
        {premiumUsersLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading memberships...</p>
        ) : premiumUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active premium subscriptions.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-3 px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>User</span><span>Tier</span><span>Expires</span>
            </div>
            {premiumUsers.map((u: any) => {
              const expired = u.premiumExpiresAt && new Date(u.premiumExpiresAt) < new Date();
              return (
                <div key={u.id} className="grid grid-cols-3 px-4 py-2.5 text-sm items-center hover:bg-muted/20 transition-colors">
                  <span className="font-medium truncate">{u.username}</span>
                  <span className={u.premiumTier === "pro" ? "text-blue-400 font-semibold" : "text-yellow-400 font-semibold"}>
                    {u.premiumTier === "pro" ? "💎 VIP / Pro" : "⭐ Premium"}
                  </span>
                  <span className={expired ? "text-destructive" : "text-muted-foreground"}>
                    {u.premiumExpiresAt ? new Date(u.premiumExpiresAt).toLocaleDateString() : "—"}
                    {expired && <span className="ml-1 text-xs">(expired)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
  const [allGamesList, setAllGamesList] = useState<Record<number, string[]>>({});
  const [gameSelections, setGameSelections] = useState<Record<number, string[]>>({});
  const [showPassword, setShowPassword] = useState<Record<number, boolean>>({});
  const [newGameInput, setNewGameInput] = useState<Record<number, string>>({});
  const [editingGame, setEditingGame] = useState<Record<number, { index: number; name: string } | null>>({});
  const [priceEdits, setPriceEdits] = useState<Record<number, number>>({});
  const [titleEdits, setTitleEdits] = useState<Record<number, string>>({});
  const [descEdits, setDescEdits] = useState<Record<number, string>>({});

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
    mutationFn: ({ id, games, pointsCost }: { id: number; games: string[]; pointsCost: number }) =>
      approveAccount(id, games, pointsCost),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "Account approved", description: "It's now live and points reward assigned." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveEditMutation = useMutation({
    mutationFn: ({ id, games, pointsCost, title, description }: { id: number; games?: string[]; pointsCost?: number; title?: string; description?: string }) =>
      updatePendingAccount(id, { games, pointsCost, title, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-accounts"] });
      toast({ title: "Changes Saved", description: "Account listing details updated successfully." });
    },
    onError: (e: any) => toast({ title: "Error saving changes", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => rejectAccount(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-accounts"] });
      toast({ title: "Account rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const initAccountState = (acc: any) => {
    if (allGamesList[acc.id] === undefined) {
      const initialGames = [...(acc.games ?? [])];
      setAllGamesList((prev) => ({ ...prev, [acc.id]: initialGames }));
      setGameSelections((prev) => ({ ...prev, [acc.id]: initialGames }));
      setPriceEdits((prev) => ({ ...prev, [acc.id]: acc.pointsCost ?? 0 }));
      setTitleEdits((prev) => ({ ...prev, [acc.id]: acc.title ?? "" }));
      setDescEdits((prev) => ({ ...prev, [acc.id]: acc.description ?? "" }));
    }
  };

  const getAccountGames = (acc: any): string[] => {
    return allGamesList[acc.id] ?? (acc.games ?? []);
  };

  const getSelectedGames = (acc: any): string[] => {
    return gameSelections[acc.id] ?? (acc.games ?? []);
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

  const handleAddGame = (accountId: number) => {
    const gameName = (newGameInput[accountId] ?? "").trim();
    if (!gameName) return;

    setAllGamesList((prev) => {
      const current = prev[accountId] ?? [];
      if (current.includes(gameName)) return prev;
      return { ...prev, [accountId]: [...current, gameName] };
    });

    setGameSelections((prev) => {
      const current = prev[accountId] ?? [];
      if (current.includes(gameName)) return prev;
      return { ...prev, [accountId]: [...current, gameName] };
    });

    setNewGameInput((prev) => ({ ...prev, [accountId]: "" }));
    toast({ title: "Game Added", description: `Added "${gameName}" to review listing.` });
  };

  const handleDeleteGame = (accountId: number, gameName: string) => {
    setAllGamesList((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] ?? []).filter((g) => g !== gameName),
    }));
    setGameSelections((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] ?? []).filter((g) => g !== gameName),
    }));
    toast({ title: "Game Removed", description: `Removed "${gameName}" from listing.` });
  };

  const handleSaveGameRename = (accountId: number, oldIndex: number) => {
    const edit = editingGame[accountId];
    if (!edit || !edit.name.trim()) {
      setEditingGame((prev) => ({ ...prev, [accountId]: null }));
      return;
    }
    const newName = edit.name.trim();
    setAllGamesList((prev) => {
      const list = [...(prev[accountId] ?? [])];
      const oldName = list[oldIndex];
      list[oldIndex] = newName;
      return { ...prev, [accountId]: list };
    });
    setGameSelections((prev) => {
      const list = [...(prev[accountId] ?? [])];
      const oldName = (allGamesList[accountId] ?? [])[oldIndex];
      const updated = list.map((g) => (g === oldName ? newName : g));
      return { ...prev, [accountId]: updated };
    });
    setEditingGame((prev) => ({ ...prev, [accountId]: null }));
    toast({ title: "Game Renamed", description: `Renamed to "${newName}".` });
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
        <h2 className="text-lg font-bold text-foreground">Pending Reviews & Account Moderation</h2>
        <span className="ml-1 bg-amber-500/20 text-amber-600 border border-amber-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
          {pending.length}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Review submitted accounts before publishing. You can adjust the points cost, add or edit games, toggle game visibility, and customize listing details.
      </p>

      {pending.map((acc: any) => {
        const isExpanded = expandedId === acc.id;
        const allGames = getAccountGames(acc);
        const selectedGames = getSelectedGames(acc);
        const currentPrice = priceEdits[acc.id] ?? acc.pointsCost ?? 0;
        const currentTitle = titleEdits[acc.id] ?? acc.title ?? "";
        const currentDesc = descEdits[acc.id] ?? acc.description ?? "";

        return (
          <div key={acc.id} className="bg-card border border-border rounded-xl overflow-hidden transition-all shadow-sm">
            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-4 gap-3 bg-card hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground truncate text-base">{currentTitle || acc.title}</span>
                  <span className="bg-amber-500/15 text-amber-600 border border-amber-500/25 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Pending
                  </span>
                  <span className="bg-primary/10 text-primary font-bold text-xs px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                    <Coins className="h-3 w-3" /> {currentPrice} pts
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  <span>Poster: <strong className="text-foreground">@{acc.posterUsername ?? "Unknown"}</strong></span>
                  <span>·</span>
                  <span>Steam: <code className="font-mono text-foreground font-semibold">{acc.steamUsername}</code></span>
                  <span>·</span>
                  <span>{allGames.length} games</span>
                  <span>·</span>
                  <span>{new Date(acc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExpandedId(isExpanded ? null : acc.id);
                  initAccountState(acc);
                }}
                className="gap-1.5 shrink-0 h-9"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Close
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" /> Edit & Review
                  </>
                )}
              </Button>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-5 py-5 space-y-6 bg-muted/10">
                {/* Title & Description Editor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                      Account Listing Title
                    </label>
                    <Input
                      value={currentTitle}
                      onChange={(e) => setTitleEdits((p) => ({ ...p, [acc.id]: e.target.value }))}
                      placeholder="Listing title..."
                      className="bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                      Description / Notes
                    </label>
                    <Input
                      value={currentDesc}
                      onChange={(e) => setDescEdits((p) => ({ ...p, [acc.id]: e.target.value }))}
                      placeholder="Account description..."
                      className="bg-background"
                    />
                  </div>
                </div>

                {/* Price Adjustment Section */}
                <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-bold text-foreground">Adjust Price (Points Cost)</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Current setting: <strong className="text-primary font-bold text-sm">{currentPrice} pts</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100000}
                        value={currentPrice}
                        onChange={(e) => setPriceEdits((p) => ({ ...p, [acc.id]: Math.max(0, Number(e.target.value)) }))}
                        className="w-32 h-9 font-bold font-mono text-center"
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>

                    {/* Quick delta buttons */}
                    <div className="flex items-center gap-1.5">
                      {[-50, -10, +10, +50, +100].map((delta) => (
                        <Button
                          key={delta}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs px-2"
                          onClick={() => setPriceEdits((p) => ({ ...p, [acc.id]: Math.max(0, (p[acc.id] ?? acc.pointsCost ?? 0) + delta) }))}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </Button>
                      ))}
                    </div>

                    {/* Quick presets */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs text-muted-foreground">Presets:</span>
                      {[
                        { label: "Free (0)", val: 0 },
                        { label: "50 pts", val: 50 },
                        { label: "100 pts", val: 100 },
                        { label: "200 pts", val: 200 },
                        { label: "500 pts", val: 500 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setPriceEdits((p) => ({ ...p, [acc.id]: preset.val }))}
                          className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-all ${
                            currentPrice === preset.val
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-background hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Steam Credentials — for testing */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Steam Credentials — Verification & Testing
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Username */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Username</span>
                      <code className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground select-all">
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
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Password</span>
                      <code className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground select-all">
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
                </div>

                {/* Game Manager (Add Games, Edit Names, Toggle Visibility, Remove) */}
                <div className="bg-background border border-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span>Games List</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {selectedGames.length}/{allGames.length} visible on publish
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add extra games, edit titles, or remove non-working games from this account.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary"
                        onClick={() => setGameSelections((p) => ({ ...p, [acc.id]: [...allGames] }))}
                      >
                        Select all
                      </Button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setGameSelections((p) => ({ ...p, [acc.id]: [] }))}
                      >
                        Clear all
                      </Button>
                    </div>
                  </div>

                  {/* Add Game Form */}
                  <div className="flex items-center gap-2 max-w-md">
                    <Input
                      placeholder="Add game name (e.g. Grand Theft Auto V, Rust)..."
                      value={newGameInput[acc.id] ?? ""}
                      onChange={(e) => setNewGameInput((p) => ({ ...p, [acc.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddGame(acc.id);
                        }
                      }}
                      className="h-9 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddGame(acc.id)}
                      disabled={!(newGameInput[acc.id] ?? "").trim()}
                      className="gap-1 h-9 shrink-0 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Game
                    </Button>
                  </div>

                  {/* Games List Container */}
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 bg-muted/20 border border-border rounded-lg">
                    {allGames.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center w-full">
                        No games listed. Use the field above to add games to this account.
                      </p>
                    ) : (
                      allGames.map((game: string, idx: number) => {
                        const isVisible = selectedGames.includes(game);
                        const isEditingThis = editingGame[acc.id]?.index === idx;

                        if (isEditingThis) {
                          return (
                            <div key={idx} className="flex items-center gap-1.5 bg-background border border-primary rounded-lg px-2 py-1 shadow-sm">
                              <Input
                                value={editingGame[acc.id]?.name ?? ""}
                                onChange={(e) =>
                                  setEditingGame((p) => ({
                                    ...p,
                                    [acc.id]: { index: idx, name: e.target.value },
                                  }))
                                }
                                className="h-7 text-xs w-44"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveGameRename(acc.id, idx);
                                  if (e.key === "Escape") setEditingGame((p) => ({ ...p, [acc.id]: null }));
                                }}
                              />
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSaveGameRename(acc.id, idx)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setEditingGame((p) => ({ ...p, [acc.id]: null }))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              isVisible
                                ? "bg-primary/10 border-primary/30 text-primary shadow-xs"
                                : "bg-muted/50 border-border text-muted-foreground line-through opacity-70"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleGame(acc.id, game)}
                              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                              title={isVisible ? "Click to hide from listing" : "Click to include in listing"}
                            >
                              {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                              <span>{game}</span>
                            </button>

                            {/* Edit game name button */}
                            <button
                              type="button"
                              onClick={() => setEditingGame((p) => ({ ...p, [acc.id]: { index: idx, name: game } }))}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded ml-1"
                              title="Edit game name"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>

                            {/* Delete game button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteGame(acc.id, game)}
                              className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                              title="Delete game from account"
                            >
                              <Trash className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {selectedGames.length === 0 && (
                    <p className="text-xs text-amber-500">⚠ All games are hidden — at least one game must be active to approve.</p>
                  )}
                </div>

                {/* Reject note */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    Rejection Reason (sent to poster if rejected)
                  </label>
                  <Input
                    placeholder="e.g. Invalid credentials, 2FA enabled, spam listing…"
                    value={rejectNote[acc.id] ?? ""}
                    onChange={(e) => setRejectNote((p) => ({ ...p, [acc.id]: e.target.value }))}
                    className="bg-background"
                  />
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={saveEditMutation.isPending}
                    onClick={() =>
                      saveEditMutation.mutate({
                        id: acc.id,
                        games: allGames,
                        pointsCost: currentPrice,
                        title: currentTitle,
                        description: currentDesc,
                      })
                    }
                  >
                    <Save className="h-4 w-4 text-primary" />
                    {saveEditMutation.isPending ? "Saving..." : "Save Draft Changes"}
                  </Button>

                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                    disabled={selectedGames.length === 0 || approveMutation.isPending}
                    onClick={() =>
                      approveMutation.mutate({
                        id: acc.id,
                        games: selectedGames,
                        pointsCost: currentPrice,
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                    {approveMutation.isPending ? "Publishing..." : `Approve & Publish (${currentPrice} pts)`}
                  </Button>

                  <Button
                    variant="destructive"
                    className="gap-2"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ id: acc.id, note: rejectNote[acc.id] ?? "" })}
                  >
                    <XCircle className="h-4 w-4" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject"}
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

// --- IP Bans Tab ---
async function fetchIpBans() {
  const res = await fetch("/api/admin/ip-bans", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load IP bans");
  return res.json() as Promise<Array<{ id: number; ip: string; reason: string | null; bannedByUserId: number | null; createdAt: string }>>;
}

function IpBansTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");

  const { data: bans = [], isLoading } = useQuery({ queryKey: ["admin-ip-bans"], queryFn: fetchIpBans });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ip-bans", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: newIp.trim(), reason: newReason.trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
    },
    onSuccess: () => {
      setNewIp(""); setNewReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-ip-bans"] });
      toast({ title: "IP banned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await fetch(`/api/admin/ip-bans/${encodeURIComponent(ip)}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-ip-bans"] }); toast({ title: "IP unbanned" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2"><Ban className="h-4 w-4 text-red-500" /> Add IP Ban</h3>
        <p className="text-xs text-muted-foreground">Banned IPs cannot register or log in. Banning a user automatically bans their IPs — use this to manually add extra IPs.</p>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="IP address (e.g. 94.227.67.19)"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            className="max-w-xs font-mono text-sm"
          />
          <Input
            placeholder="Reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            className="max-w-xs text-sm"
          />
          <Button
            variant="destructive"
            className="gap-1.5"
            disabled={!newIp.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            <Ban className="h-4 w-4" /> Ban IP
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-bold">Banned IPs ({bans.length})</span>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-mono">IP Address</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Banned At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : bans.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No IP bans.</TableCell></TableRow>
            ) : bans.map((ban) => (
              <TableRow key={ban.id}>
                <TableCell className="font-mono text-sm">{ban.ip}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={ban.reason ?? ""}>{ban.reason ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(ban.createdAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-500/30"
                    onClick={() => removeMutation.mutate(ban.ip)} disabled={removeMutation.isPending}>
                    <CheckCircle className="h-3 w-3" /> Unban
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
