import { Layout } from "@/components/layout";
import { AccountCard } from "@/components/account-card";
import { AdBanner } from "@/components/ad-banner";
import { useListAccounts, useListGames, useGetMe, getListAccountsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { Search, Filter, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin } from "lucide-react";

const LIMIT = 50;

async function fetchAnnouncements() {
  const res = await fetch("/api/announcements", { credentials: "include" });
  if (!res.ok) return [];
  return res.json() as Promise<any[]>;
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

/** Build the page-number list with ellipsis gaps. */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

async function pinAccount(accountId: number, pinned: boolean) {
  const res = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPinned: pinned }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

export default function Browse() {
  const params = getParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [selectedGame, setSelectedGame] = useState<string>(params.get("game") ?? "all");
  const [sort, setSort] = useState<"recent" | "popular" | "free" | "points">(
    (params.get("sort") as any) ?? "recent"
  );
  const [page, setPage] = useState(Math.max(1, Number(params.get("page") ?? "1")));
  // Skip the first render so filter effects don't wipe the page from the URL on back-navigation.
  const mounted = useRef(false);

  const { data: gamesData, isLoading: gamesLoading } = useListGames();
  const { data: accountsData, isLoading: accountsLoading } = useListAccounts({
    game: selectedGame !== "all" ? selectedGame : undefined,
    search: search.trim() || undefined,
    sort,
    page,
    limit: LIMIT,
  } as any);
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements,
  });
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const browseQueryKey = getListAccountsQueryKey({
    game: selectedGame !== "all" ? selectedGame : undefined,
    search: search.trim() || undefined,
    sort,
    page,
    limit: LIMIT,
  } as any);

  const handlePin = async (accountId: number) => {
    await pinAccount(accountId, true);
    queryClient.invalidateQueries({ queryKey: browseQueryKey });
  };
  const handleUnpin = async (accountId: number) => {
    await pinAccount(accountId, false);
    queryClient.invalidateQueries({ queryKey: browseQueryKey });
  };

  const accounts = accountsData?.accounts ?? [];
  const total = accountsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Sync URL — replaceState keeps filters in URL without piling up history.
  // Page changes use pushState so browser-back/forward work correctly.
  function buildQS(p: number) {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (selectedGame !== "all") q.set("game", selectedGame);
    if (sort !== "recent") q.set("sort", sort);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/browse?${qs}` : "/browse";
  }

  // When filters change (not page), replace history so page resets cleanly.
  // Skip the very first run so back-navigation preserves the page from the URL.
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setPage(1);
    window.history.replaceState(null, "", buildQS(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame, sort]);

  // When search changes, reset to page 1 and update URL.
  useEffect(() => {
    if (!mounted.current) return;
    setPage(1);
    window.history.replaceState(null, "", buildQS(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function goToPage(p: number) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped === page) return;
    window.history.pushState(null, "", buildQS(clamped));
    // Clear the scroll key saved by App.tsx's pushState intercept so the
    // restoration effect doesn't scroll back down when the new page loads.
    sessionStorage.removeItem("scroll:/browse");
    setPage(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Handle browser back/forward — read page from URL when popstate fires.
  useEffect(() => {
    function onPop() {
      const p = getParams();
      setSearch(p.get("search") ?? "");
      setSelectedGame(p.get("game") ?? "all");
      setSort((p.get("sort") as any) ?? "recent");
      setPage(Math.max(1, Number(p.get("page") ?? "1")));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Restore scroll position when returning from an account detail page.
  // App.tsx saves "scroll:/browse" on every pushState and skips auto-scroll-to-top
  // for /browse on popstate, so we just need to apply it once data is ready.
  useEffect(() => {
    if (accountsLoading) return;
    const saved = sessionStorage.getItem("scroll:/browse");
    if (saved) {
      sessionStorage.removeItem("scroll:/browse");
      const y = Number(saved);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" })));
    }
  }, [accountsLoading]);

  const filteredAccounts = accounts;

  const pageList = buildPageList(page, totalPages);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-4">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <div className="flex flex-col gap-2">
            {(announcements as any[]).map((a: any) => (
              <div
                key={a.id}
                className="relative bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 overflow-hidden flex items-start gap-3"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
                {a.pinned && <Pin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0 rotate-45" />}
                <Megaphone className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="relative z-10 min-w-0">
                  <span className="font-bold text-sm text-foreground">{a.title}</span>
                  <span className="text-muted-foreground text-sm"> — {a.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full md:w-64 shrink-0 space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> Filters
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search titles or games..."
                      className="pl-9 bg-card border-card-border"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Sort By</label>
                  <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                    <SelectTrigger className="bg-card border-card-border" data-testid="select-sort">
                      <SelectValue placeholder="Sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                      <SelectItem value="free">Free Accounts</SelectItem>
                      <SelectItem value="points">Lowest Points</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Games Directory — desktop only */}
                <div className="hidden md:block space-y-2 pt-4">
                  <label className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                    Games Directory
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setSelectedGame("all")}
                    >
                      Clear
                    </Button>
                  </label>

                  <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <Button
                      variant={selectedGame === "all" ? "secondary" : "ghost"}
                      className="justify-start h-8 text-sm"
                      onClick={() => setSelectedGame("all")}
                      data-testid="button-game-all"
                    >
                      All Games
                    </Button>

                    {gamesLoading ? (
                      <div className="space-y-2 mt-2">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                      </div>
                    ) : (
                      gamesData?.map((game) => (
                        <Button
                          key={game.game}
                          variant={selectedGame === game.game ? "secondary" : "ghost"}
                          className="justify-between h-8 text-sm group"
                          onClick={() => setSelectedGame(game.game)}
                          data-testid={`button-game-${game.game}`}
                        >
                          <span className="truncate pr-2">{game.game}</span>
                          <span className="text-[10px] text-muted-foreground bg-background px-1.5 rounded-full group-hover:bg-card">
                            {game.count}
                          </span>
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {selectedGame === "all" ? "All Accounts" : `${selectedGame} Accounts`}
              </h2>
              <span className="text-sm text-muted-foreground">
                {total > 0
                  ? `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total}`
                  : "0 results"}
              </span>
            </div>

            <AdBanner placement="browse" />

            {accountsLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredAccounts.length > 0 ? (
              <>
                <div className="flex flex-col gap-3">
                  {filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      onClick={() => sessionStorage.setItem("browse-scroll", String(window.scrollY))}
                    >
                      <AccountCard
                        account={account}
                        isAdmin={(me as any)?.isAdmin}
                        onPin={handlePin}
                        onUnpin={handleUnpin}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {!search && totalPages > 1 && (
                  <nav className="flex items-center justify-center gap-1 pt-8 flex-wrap" aria-label="Pagination">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {pageList.map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground select-none">
                          …
                        </span>
                      ) : (
                        <Button
                          key={p}
                          variant={p === page ? "default" : "outline"}
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => goToPage(p)}
                          aria-label={`Page ${p}`}
                          aria-current={p === page ? "page" : undefined}
                        >
                          {p}
                        </Button>
                      )
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => goToPage(page + 1)}
                      disabled={page === totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                )}
              </>
            ) : (
              <div className="py-20 text-center flex flex-col items-center bg-card rounded-xl border border-dashed border-border">
                <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-1">No accounts found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearch("");
                    setSelectedGame("all");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
