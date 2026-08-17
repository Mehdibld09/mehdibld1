import { useRegister } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Eye, EyeOff, Zap, X, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  agreeTerms: z.boolean().refine((v) => v === true, {
    message: "You must agree to the terms to continue",
  }),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const registerUser = useRegister();
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [registrationCode, setRegistrationCode] = useState("");
  const [registrationCodeError, setRegistrationCodeError] = useState("");
  const [registrationCodeLoading, setRegistrationCodeLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "", password: "", agreeTerms: false },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      const result = await registerUser.mutateAsync({
        data: { username: values.username, email: values.email, password: values.password },
      });
      if ((result as any)?.requiresRegistrationTwoFactor || (result as any)?.requiresEmailVerification) {
        setPendingEmail(values.email);
      } else {
        // SMTP not configured — auto-logged-in
        setLocation("/");
      }
    } catch (e: any) {
      setSubmitError(e.message || "Failed to create account. Username or email may already be taken.");
    }
  }

  async function handleVerifyRegistration() {
    setRegistrationCodeError("");
    setRegistrationCodeLoading(true);
    try {
      const res = await fetch("/api/auth/verify-registration", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: registrationCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid verification code.");
      setLocation("/");
    } catch (e: any) {
      setRegistrationCodeError(e.message || "Invalid verification code.");
    } finally {
      setRegistrationCodeLoading(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail || resendLoading) return;
    setResendLoading(true);
    setResendDone(false);
    setRegistrationCodeError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to resend the code.");
      }
      setResendDone(true);
      setRegistrationCode("");
    } catch (e: any) {
      setRegistrationCodeError(e.message || "Unable to resend the code.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — game collage */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="/games-collage-new.png"
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <span className="font-black text-xl text-foreground">Steam Family</span>
          </div>

          {/* ── Registration verification state ── */}
          {pendingEmail ? (
            <div className="flex flex-col items-center gap-6 py-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <div>
                <p className="font-black text-2xl text-foreground">Verify your email</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                  We sent a 6-digit code to{" "}
                  <span className="text-foreground font-semibold">{pendingEmail}</span>. Click it to activate your account.
                </p>
              </div>

              {registrationCodeError && (
                <div className="w-full flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 text-left">
                  <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                  {registrationCodeError}
                </div>
              )}

              <div className="w-full space-y-3 text-left">
                <label className="text-sm font-semibold text-foreground">Verification code</label>
                <Input
                  value={registrationCode}
                  onChange={(e) => setRegistrationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === "Enter" && registrationCode.length === 6) handleVerifyRegistration(); }}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  className="h-14 text-center text-3xl font-mono tracking-widest bg-secondary/40 border-border focus:border-primary/60 rounded-xl"
                  autoFocus
                />
                <Button
                  className="w-full h-12 font-bold rounded-xl"
                  onClick={handleVerifyRegistration}
                  disabled={registrationCode.length !== 6 || registrationCodeLoading}
                >
                  {registrationCodeLoading ? "Verifying…" : "Verify email & create account"}
                </Button>
              </div>

              {resendDone ? (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  New verification code sent!
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Resend verification code
                </Button>
              )}

              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-black text-foreground">Create account</h2>
                <p className="text-muted-foreground mt-2">Join the network and start trading today.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {submitError && (
                    <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                      <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Pick a username"
                            className="h-12 bg-secondary/40 border-border focus:border-primary/60 rounded-xl"
                            {...field}
                            data-testid="input-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            className="h-12 bg-secondary/40 border-border focus:border-primary/60 rounded-xl"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-12 bg-secondary/40 border-border focus:border-primary/60 rounded-xl pr-12"
                              {...field}
                              data-testid="input-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="agreeTerms"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/20 border border-border">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-terms"
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              I agree to the{" "}
                              <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
                              {" "}and{" "}
                              <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
                              I understand that sharing accounts may violate Steam's ToS and accept full responsibility.
                            </p>
                            <FormMessage className="mt-1" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 font-bold rounded-xl text-base"
                    disabled={registerUser.isPending}
                    data-testid="button-register-submit"
                  >
                    {registerUser.isPending ? "Creating account…" : "Create Account"}
                  </Button>
                </form>
              </Form>
            </>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
