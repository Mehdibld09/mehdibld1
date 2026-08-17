import { getGetMeQueryKey, useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function Layout({ children }: { children: React.ReactNode; noFooter?: boolean }) {
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync(undefined);
    } catch {
      // The local session is cleared below even if the request fails.
    }
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="/admin" className="flex items-center gap-3">
            <span className="font-black text-xl tracking-tight text-foreground">Steam Family</span>
          </a>

          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Signed in as <strong className="text-foreground">{user.username}</strong>
              </span>
            )}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user && (
              <button
                onClick={handleLogout}
                disabled={logout.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{logout.isPending ? "Signing out…" : "Sign out"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}