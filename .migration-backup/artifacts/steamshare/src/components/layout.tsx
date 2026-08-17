import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout, useListGiveaways, getListGiveawaysQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Plus, LogOut, Coins, Trophy, Gift,
  MessageSquare, Menu, X, ChevronRight, Bell, Home,
  LayoutGrid, User, Settings, ShoppingBag, Sun, Moon, ArrowLeft,
  Megaphone, ExternalLink, Mail, Phone, MapPin, Crown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";

async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch("/api/messages/unread/count", { credentials: "include" });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

const SEEN_GIVEAWAYS_KEY = "steamfamily_seen_giveaways";

function getSeenIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_GIVEAWAYS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function markAllSeen(ids: number[]) {
  localStorage.setItem(SEEN_GIVEAWAYS_KEY, JSON.stringify(ids));
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/browse", label: "Browse", icon: LayoutGrid },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/giveaways", label: "Giveaways", icon: Gift },
  { href: "/store", label: "Store", icon: ShoppingBag },
  { href: "/earn", label: "Earn Points", icon: Coins },
  { href: "/premium", label: "Premium", icon: Crown },
];

export function Layout({ children, noFooter }: { children: React.ReactNode; noFooter?: boolean }) {
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: fetchUnreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Giveaway notifications — track unseen active giveaways
  const { data: giveaways = [] } = useListGiveaways({
    query: { queryKey: getListGiveawaysQueryKey(), refetchInterval: 60_000 },
  });
  const activeGiveaways = giveaways.filter((g) => g.isActive);
  const [seenIds, setSeenIds] = useState<number[]>(getSeenIds);
  const newGiveaways = activeGiveaways.filter((g) => !seenIds.includes(g.id));
  const notifCount = newGiveaways.length;

  const openBell = () => {
    setBellOpen((o) => !o);
    if (!bellOpen && newGiveaways.length > 0) {
      const allIds = activeGiveaways.map((g) => g.id);
      markAllSeen(allIds);
      setSeenIds(allIds);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logout.mutateAsync(undefined);
    } catch {
      // ignore
    }
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    setMenuOpen(false);
  };

  const xpProgress = user ? (user.xp % 100) : 0;

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<any[]>;
    },
    staleTime: 60_000,
  });

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupAnn, setPopupAnn] = useState<any>(null);

  useEffect(() => {
    const popupAnns = (announcements as any[]).filter((a: any) => a.isPopup);
    if (popupAnns.length === 0) return;
    const latest = popupAnns.sort((a: any, b: any) => b.id - a.id)[0];
    try {
      const dismissed = localStorage.getItem("dismissed_popup");
      if (dismissed !== String(latest.id)) {
        setPopupAnn(latest);
        setPopupOpen(true);
      }
    } catch {
      setPopupAnn(latest);
      setPopupOpen(true);
    }
  }, [announcements]);

  const dismissPopup = () => {
    if (popupAnn) {
      try { localStorage.setItem("dismissed_popup", String(popupAnn.id)); } catch {}
    }
    setPopupOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Popup Announcement */}
      {popupOpen && popupAnn && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismissPopup} />
          <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <button
              onClick={dismissPopup}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-3 mb-3">
              <Megaphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <h2 className="font-bold text-lg text-foreground leading-tight">{popupAnn.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-5 pl-8">{popupAnn.description}</p>
            {popupAnn.popupButtons && popupAnn.popupButtons.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {popupAnn.popupButtons.map((btn: any, i: number) => (
                  <a
                    key={i}
                    href={btn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismissPopup}
                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                  >
                    {btn.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            ) : (
              <button
                onClick={dismissPopup}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      )}
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 items-center justify-between px-4">

          {/* Left: Logo (hidden on mobile) + Menu button + Back button */}
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden sm:flex items-center">
              <span className="font-black text-xl tracking-tight text-foreground">Steam Family</span>
            </Link>
            <button
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5">
            {/* Dark mode toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <>
                {(user.isAdmin || (user as any).isModerator) && (
                  <Link href="/admin">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
                      <Shield className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{user.isAdmin ? "Admin" : "Mod"}</span>
                    </button>
                  </Link>
                )}

                {/* Post Account */}
                <Link href="/submit">
                  <button className="relative p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title="Post Account">
                    <Plus className="h-5 w-5" />
                  </button>
                </Link>

                {/* Messages */}
                <Link href="/messages">
                  <button className="relative p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title="Messages">
                    <MessageSquare className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </Link>

                {/* Bell / Giveaway notifications */}
                <div className="relative" ref={bellRef}>
                  <button
                    onClick={openBell}
                    className="relative p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {notifCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {notifCount > 9 ? "9+" : notifCount}
                      </span>
                    )}
                  </button>

                  {/* Bell dropdown */}
                  {bellOpen && (
                    <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <span className="text-sm font-bold">Notifications</span>
                        <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {activeGiveaways.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No active giveaways right now
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-border">
                          {activeGiveaways.map((g) => (
                            <Link key={g.id} href="/giveaways">
                              <button
                                onClick={() => setBellOpen(false)}
                                className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Gift className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{g.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">Prize: {g.prize}</p>
                                    <p className="text-xs text-primary mt-0.5">
                                      {g.entriesCount}/{g.maxEntries} entries · Active
                                    </p>
                                  </div>
                                </div>
                              </button>
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="px-4 py-2.5 border-t border-border">
                        <Link href="/giveaways">
                          <button onClick={() => setBellOpen(false)} className="text-xs text-primary hover:underline font-medium">
                            View all giveaways →
                          </button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Avatar + dropdown */}
                <div className="relative ml-1" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen((o) => !o)}
                    className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="relative">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={user.avatarUrl || "/default-avatar.png"} />
                        <AvatarFallback className="text-xs bg-secondary">
                          {(user.username?.substring(0, 2) ?? "").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0 bg-primary text-white text-[8px] font-black rounded px-[3px] leading-tight shadow-sm">
                        {user.level}
                      </div>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${profileOpen ? "" : "rotate-90"}`} />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-11 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                      <div className="px-4 py-2.5 border-b border-border">
                        <p className="text-sm font-semibold truncate">{user.username}</p>
                        <p className="text-xs text-primary">{user.points} pts · Lv {user.level}</p>
                      </div>
                      <Link href={`/profile/${user.id}`}>
                        <button onClick={() => setProfileOpen(false)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors">
                          <User className="h-4 w-4" /> View Profile
                        </button>
                      </Link>
                      <Link href="/edit-profile">
                        <button onClick={() => setProfileOpen(false)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors">
                          <Settings className="h-4 w-4" /> Edit Profile
                        </button>
                      </Link>
                      <div className="border-t border-border mt-1 pt-1">
                        <button onClick={() => { setProfileOpen(false); handleLogout(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                          <LogOut className="h-4 w-4" /> Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* XP bar */}
        {user && (
          <div className="h-0.5 bg-muted">
            <div className="h-0.5 bg-primary transition-all duration-700" style={{ width: `${xpProgress}%` }} />
          </div>
        )}
      </header>

      {/* ── Menu Panel Overlay ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-50 w-72 h-full bg-card border-r border-border flex flex-col overflow-y-auto shadow-2xl menu-panel-enter">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-base font-bold text-foreground">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User info */}
            {user && (
              <div className="px-5 py-4 border-b border-border">
                <Link href={`/profile/${user.id}`} onClick={() => setMenuOpen(false)}>
                  <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={user.avatarUrl || "/default-avatar.png"} />
                      <AvatarFallback className="bg-secondary text-sm">
                        {(user.username?.substring(0, 2) ?? "").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{user.username}</p>
                      <p className="text-xs text-primary">{user.points} pts · Lv {user.level}</p>
                    </div>
                  </div>
                </Link>
                <div className="mt-3">
                  <Progress value={xpProgress} className="h-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">{user.xp % 100}/100 XP to next level</p>
                </div>
              </div>
            )}

            {/* Nav Items */}
            <nav className="flex-1 py-2">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors ${
                      location === item.href
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </button>
                </Link>
              ))}

              <div className="my-2 mx-5 border-t border-border" />

              {user ? (
                <>
                  <Link href="/submit">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Plus className="h-4 w-4" />
                        Submit Account
                      </span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                  <Link href="/messages">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4" />
                        Messages
                        {unreadCount > 0 && (
                          <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                  {(user.isAdmin || (user as any).isModerator) && (
                    <Link href="/admin">
                      <button
                        onClick={() => setMenuOpen(false)}
                        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 border-l-2 border-transparent transition-colors"
                      >
                        <span className="flex items-center gap-3">
                          <Shield className="h-4 w-4" />
                          {user.isAdmin ? "Admin Panel" : "Mod Panel"}
                        </span>
                        <ChevronRight className="h-4 w-4 opacity-40" />
                      </button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href="/login">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <span>Login</span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                  <Link href="/register">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 border-l-2 border-transparent transition-colors"
                    >
                      <span>Register</span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                </>
              )}
            </nav>

            {/* Bottom logout */}
            {user && (
              <div className="p-4 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      {!noFooter && <Footer />}
    </div>
  );
}

async function fetchSiteSettings() {
  const res = await fetch("/api/site-settings");
  if (!res.ok) return { contact: {}, footerLinks: [] };
  return res.json() as Promise<{ contact: Record<string, string>; footerLinks: { id: number; label: string; url: string }[] }>;
}

function Footer() {
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings, staleTime: 60_000 });
  const contact = data?.contact ?? {};
  const footerLinks = data?.footerLinks ?? [];

  const hasContact = contact.contact_email || contact.contact_phone || contact.contact_address || contact.contact_discord || contact.contact_twitter;

  return (
    <footer className="border-t border-border bg-card/50">
      {(hasContact || footerLinks.length > 0) && (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex flex-wrap gap-10 justify-between">
            {hasContact && (
              <div className="min-w-[180px]">
                <h4 className="text-sm font-semibold text-foreground mb-3">Contact Us</h4>
                <ul className="space-y-2">
                  {contact.contact_email && (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <a href={`mailto:${contact.contact_email}`} className="hover:text-foreground transition-colors">{contact.contact_email}</a>
                    </li>
                  )}
                  {contact.contact_phone && (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{contact.contact_phone}</span>
                    </li>
                  )}
                  {contact.contact_address && (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{contact.contact_address}</span>
                    </li>
                  )}
                  {contact.contact_discord && (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg className="h-3.5 w-3.5 shrink-0 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.135 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                      <a href={contact.contact_discord} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
                    </li>
                  )}
                  {contact.contact_twitter && (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg className="h-3.5 w-3.5 shrink-0 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      <a href={contact.contact_twitter} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter / X</a>
                    </li>
                  )}
                </ul>
              </div>
            )}
            {footerLinks.length > 0 && (
              <div className="min-w-[140px]">
                <h4 className="text-sm font-semibold text-foreground mb-3">Links</h4>
                <ul className="space-y-2">
                  {footerLinks.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        target={link.url.startsWith("http") ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Steam Family
      </div>
    </footer>
  );
}
