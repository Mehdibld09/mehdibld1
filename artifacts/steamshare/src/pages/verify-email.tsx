import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { CheckCircle2, XCircle, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/layout";

type State = "loading" | "code" | "success" | "expired" | "invalid";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State>("loading");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { setState("invalid"); return; }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.requiresRegistrationTwoFactor) {
          setUsername(data.username ?? "");
          setState("code");
        } else if (res.ok && data.verified) {
          setUsername(data.username ?? "");
          setState("success");
        } else if (data.error?.includes("expired")) {
          setState("expired");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, []);

  async function handleCodeSubmit() {
    setCodeError("");
    setCodeLoading(true);
    try {
      const res = await fetch("/api/auth/verify-registration", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid verification code.");
      setState("success");
    } catch (e: any) {
      setCodeError(e.message || "Invalid verification code.");
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleResend() {
    if (!resendEmail || resendDone) return;
    setResendLoading(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-xl">

          {/* Loading */}
          {state === "loading" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
              </div>
              <p className="text-lg font-semibold text-foreground">Verifying your email…</p>
            </>
          )}

          {/* Success */}
          {state === "success" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-black text-foreground mb-2">Email verified!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                {username ? (
                  <>Welcome, <span className="text-foreground font-semibold">{username}</span>! Your account is now active.</>
                ) : (
                  "Your email address has been verified. Your account is now active."
                )}
              </p>
              <Button className="w-full h-12 font-bold rounded-xl text-base" onClick={() => setLocation("/login")}>
                Sign in
              </Button>
            </>
          )}

          {/* Registration code */}
          {state === "code" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-black text-foreground mb-2">Enter your code</h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {username ? <>Email confirmed for <span className="text-foreground font-semibold">{username}</span>. </> : ""}
                Enter the 6-digit code from your Steam Family email to activate your account.
              </p>
              {codeError && <p className="text-sm text-destructive mb-3">{codeError}</p>}
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) handleCodeSubmit(); }}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="h-14 text-center text-3xl font-mono tracking-widest mb-4"
                autoFocus
              />
              <Button
                className="w-full h-12 font-bold rounded-xl text-base"
                onClick={handleCodeSubmit}
                disabled={code.length !== 6 || codeLoading}
              >
                {codeLoading ? "Activating..." : "Activate account"}
              </Button>
            </>
          )}

          {/* Expired */}
          {state === "expired" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                <Mail className="h-10 w-10 text-yellow-400" />
              </div>
              <h1 className="text-2xl font-black text-foreground mb-2">Link expired</h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                That verification link has expired (links are valid for 24 hours). Enter your email to get a new one.
              </p>
              <div className="space-y-3 text-left">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-4 rounded-xl bg-secondary/40 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
                />
                {resendDone ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-primary py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    New verification email sent!
                  </div>
                ) : (
                  <Button className="w-full h-11 font-semibold rounded-xl" onClick={handleResend} disabled={resendLoading || !resendEmail}>
                    {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send new link"}
                  </Button>
                )}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                <Link href="/login" className="text-primary font-semibold hover:underline">Back to sign in</Link>
              </p>
            </>
          )}

          {/* Invalid */}
          {state === "invalid" && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-10 w-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-black text-foreground mb-2">Invalid link</h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                This verification link is invalid or has already been used. If you need a new link, sign in and we'll walk you through it.
              </p>
              <Button variant="outline" className="w-full h-12 font-semibold rounded-xl" onClick={() => setLocation("/login")}>
                Go to sign in
              </Button>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
