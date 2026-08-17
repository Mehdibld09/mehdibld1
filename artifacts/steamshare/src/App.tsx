import { Redirect, Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryCache, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { Layout } from "@/components/layout";
import { Spinner } from "@/components/ui/spinner";
import Login from "./pages/login";

// Keep the admin console and the authentication screens as the only web surface.
const Admin = lazy(() => import("./pages/admin"));
const AccountDetail = lazy(() => import("./pages/account-detail"));
const ForgotPassword = lazy(() => import("./pages/forgot-password"));
const ResetPassword = lazy(() => import("./pages/reset-password"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const status = (error as any)?.status;
      if (typeof status === "number" && status >= 400 && status < 500) return;
      console.error(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // treat cached data as fresh for 1 min — prevents refetch on every mount/focus
      refetchOnWindowFocus: false, // don't refetch on tab-switch — saves Vercel function invocations
      retry: (failureCount, error) => {
        const status = (error as any)?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

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
  useEffect(() => {
    if (isPopState.current) {
      isPopState.current = false;
      const saved = Number(sessionStorage.getItem(`scroll:${location}`) ?? 0);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)));
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={() => <Redirect to="/login" />} />
        <Route path="/admin" component={Admin} />
        <Route path="/accounts/:id" component={AccountDetail} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={() => <Redirect to="/login" />} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base="">
            <ScrollToTop />
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
