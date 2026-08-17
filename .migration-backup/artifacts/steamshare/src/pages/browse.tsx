import { Layout } from "@/components/layout";
import { AccountCard } from "@/components/account-card";
import { AdBanner } from "@/components/ad-banner";
import { useListAccounts, useListGames } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { Search, Filter, ArrowLeft, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Pin } from "lucide-react";

async function fetchAnnouncements() {
  const res = await fetch("/api/announcements", { credentials: "include" });
  if (!res.ok) return [];
  return res.json() as Promise<any[]>;
}

export default function Browse() {
  // Initialise from URL so browser-back restores filters
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [selectedGame, setSelectedGame] = useState<string>(params.get("game") ?? "all");
  const [sort, setSort] = useState<"recent"|"popular"|"free"|"points">((params.get("sort") as any) ?? "recent");
  const [page, setPage] = useState(Number(params.get("page") ?? "1"));
  const [allAccounts, setAllAccounts] = useState<any[]>([]);

  const { data: gamesData, isLoading: gamesLoading } = useListGames();
  const { data: accountsData, isLoading: accountsLoading } = useListAccounts({
    game: selectedGame !== "all" ? selectedGame : undefined,
    sort,
    page,
    limit: 50,
  });
  const { data: announcements = [] } = useQuery({ queryKey: ["announcements"], queryFn: fetchAnnouncements });

  // Keep URL in sync with filters (replaceState = no extra history entries)
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (selectedGame !== "all") p.set("game", selectedGame);
    if (sort !== "recent") p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `/browse?${qs}` : "/browse");
  }, [search, selectedGame, sort, page]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
    setAllAccounts([]);
  }, [selectedGame, sort]);

  // Accumulate accounts as pages load
  useEffect(() => {
    if (accountsData?.accounts) {
      if (page === 1) {
        setAllAccounts(accountsData.accounts);
      } else {
        setAllAccounts((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          const newOnes = accountsData.accounts.filter((a: any) => !seen.has(a.id));
          return [...prev, ...newOnes];
        });
      }
    }
  }, [accountsData, page]);

  // Restore scroll position after accounts load (coming back via browser back).
  // Reads from the same "scroll:/browse" key that ScrollToTop saves to, so we
  // wait until data is rendered (page is tall enough) before restoring.
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (scrollRestored.current || accountsLoading || allAccounts.length === 0) return;
    const saved = sessionStorage.getItem("scroll:/browse");
    if (saved && Number(saved) > 0) {
      scrollRestored.current = true;
      requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
    }
  }, [accountsLoading, allAccounts.length]);

  const filteredAccounts = allAccounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      (a.games && a.games.some((g: string) => g.toLowerCase().includes(q)))
    );
  });

  const hasMore = accountsData ? accountsData.total > allAccounts.length : false;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-4">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <div className="flex flex-col gap-2">
            {(announcements as any[]).map((a: any) => (
              <div key={a.id} className="relative bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 overflow-hidden flex items-start gap-3">
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
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => setSelectedGame("all")}>Clear</Button>
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
                    gamesData?.map(game => (
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
              {filteredAccounts?.length || 0} results
            </span>
          </div>

          <AdBanner placement="browse" />

          {accountsLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredAccounts && filteredAccounts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
              {hasMore && !search && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={accountsLoading}
                    className="gap-2"
                  >
                    {accountsLoading ? "Loading..." : "Load More"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center bg-card rounded-xl border border-dashed border-border">
              <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-1">No accounts found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setSelectedGame("all"); }}>
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
