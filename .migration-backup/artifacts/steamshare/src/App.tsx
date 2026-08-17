import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Browse from "./pages/browse";
import Leaderboard from "./pages/leaderboard";
import AccountDetail from "./pages/account-detail";
import Profile from "./pages/profile";
import Submit from "./pages/submit";
import Admin from "./pages/admin";
import Earn from "./pages/earn";
import Login from "./pages/login";
import Register from "./pages/register";
import Giveaways from "./pages/giveaways";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import Banned from "./pages/banned";
import Messages from "./pages/messages";
import EditProfile from "./pages/edit-profile";
import Store from "./pages/store";
import ProductDetail from "./pages/product-detail";
import Premium from "./pages/premium";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  const isPopState = useRef(false);

  // Intercept pushState once so we capture the scroll position AT the moment
  // the user navigates away — more reliable than a debounced scroll listener.
  useEffect(() => {
    history.scrollRestoration = "manual";

    const orig = history.pushState.bind(history);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (history as any).pushState = function (state: any, title: string, url?: string | URL | null) {
      sessionStorage.setItem(`scroll:${window.location.pathname}`, String(window.scrollY));
      return orig(state, title, url);
    };

    const onPop = () => { isPopState.current = true; };
    window.addEventListener("popstate", onPop);

    return () => {
      (history as any).pushState = orig;
      window.removeEventListener("popstate", onPop);
      history.scrollRestoration = "auto";
    };
  }, []); // intentionally run once

  // On route change: restore scroll for back/forward, or jump to top for fresh nav.
  // /browse handles its own restoration after data finishes loading.
  const DATA_RESTORE_PATHS = ["/browse"];
  useEffect(() => {
    if (isPopState.current) {
      isPopState.current = false;
      if (DATA_RESTORE_PATHS.includes(location)) return;
      const saved = Number(sessionStorage.getItem(`scroll:${location}`) ?? 0);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)));
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  return null;
}

function BannedGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 30_000,
  });

  // If banned and not already on the banned page, redirect there
  if (user?.isBanned && location !== "/banned") {
    window.location.replace("/banned");
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/browse" component={Browse} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/accounts/:id" component={AccountDetail} />
      <Route path="/profile/:id" component={Profile} />
      <Route path="/submit" component={Submit} />
      <Route path="/admin" component={Admin} />
      <Route path="/earn" component={Earn} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/giveaways" component={Giveaways} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/banned" component={Banned} />
      <Route path="/store" component={Store} />
      <Route path="/store/:id" component={ProductDetail} />
      <Route path="/messages" component={Messages} />
      <Route path="/edit-profile" component={EditProfile} />
      <Route path="/premium" component={Premium} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base="">
            <BannedGuard>
              <ScrollToTop />
              <Router />
            </BannedGuard>
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
