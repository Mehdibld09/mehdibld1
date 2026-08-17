import { Layout } from "@/components/layout";
import { useCreateAccount, useGetMe, useVerifyCredentials } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoIcon, CheckCircle2, XCircle, Loader2, Clock, HourglassIcon, ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MarkdownEditor } from "@/components/markdown-editor";

const formSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000),
  gamesList: z.string().min(1, "At least one game is required"),
  pointsCost: z.coerce.number().min(0),
  steamUsername: z.string().min(1, "Steam username is required"),
  steamPassword: z.string().min(1, "Steam password is required"),
  unlockMethod: z.enum(["login", "like", "comment"]).default("login"),
  customButtonEnabled: z.boolean().default(false),
  customButtonLabel: z.string().max(60).optional(),
  customButtonUrl: z.string().max(500).optional(),
});

type VerifyStatus = "idle" | "checking" | "valid" | "invalid" | "2fa" | "rate_limited" | "error";

export default function Submit() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe();
  const createAccount = useCreateAccount();
  const verifyCredentials = useVerifyCredentials();
  const [submitError, setSubmitError] = useState("");
  const [pendingReview, setPendingReview] = useState(false);
  const [isFamilyShare, setIsFamilyShare] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [dupStatus, setDupStatus] = useState<"idle" | "checking" | "exists" | "free">("idle");
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      gamesList: "",
      pointsCost: 0,
      steamUsername: "",
      steamPassword: "",
      unlockMethod: "login",
      customButtonEnabled: false,
      customButtonLabel: "",
      customButtonUrl: "",
    },
  });

  // Watch fields — must be declared before effects that depend on them
  const watchUsername = form.watch("steamUsername");
  const watchPassword = form.watch("steamPassword");

  // Tick elapsed timer while checking
  useEffect(() => {
    if (verifyStatus !== "checking") { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [verifyStatus]);

  // Debounced duplicate credentials check (username + password must both match)
  useEffect(() => {
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    if (!watchUsername || watchUsername.trim().length < 2 || !watchPassword || watchPassword.trim().length < 1) {
      setDupStatus("idle");
      return;
    }
    setDupStatus("checking");
    dupTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          username: watchUsername.trim(),
          password: watchPassword.trim(),
        });
        const res = await fetch(`/api/accounts/check-credentials?${params}`);
        const data = await res.json();
        setDupStatus(data.exists ? "exists" : "free");
      } catch {
        setDupStatus("idle");
      }
    }, 600);
    return () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); };
  }, [watchUsername, watchPassword]);

  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }

  const handleVerify = async () => {
    const values = form.getValues();
    if (!values.steamUsername || !values.steamPassword) {
      form.trigger(["steamUsername", "steamPassword"]);
      return;
    }
    setVerifyStatus("checking");
    setVerifyMessage("");
    try {
      const result = await verifyCredentials.mutateAsync({
        data: { steamUsername: values.steamUsername, steamPassword: values.steamPassword },
      });
      setVerifyStatus(result.status as VerifyStatus);
      setVerifyMessage(result.message);

      if (result.status === "valid") {
        // Use the API's isFamilyShare flag — set by IFamilyGroupsService/GetFamilyGroupForUser
        setIsFamilyShare(!!(result as any).isFamilyShare);

        // Auto-fill games list if Steam returned owned games
        const hasGames = result.games && result.games.length > 0;
        if (hasGames) {
          const currentGames = form.getValues("gamesList");
          if (!currentGames || currentGames.trim() === "") {
            form.setValue("gamesList", result.games!.join(", "), { shouldValidate: true });
          }
        }
      } else {
        setIsFamilyShare(false);
        // Clear games list on failure so stale data isn't submitted
        form.setValue("gamesList", "");
      }
    } catch (e: any) {
      setVerifyStatus("error");
      setVerifyMessage(e.message || "Could not reach Steam servers");
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");

    // Must be verified before posting
    if (verifyStatus !== "valid") {
      setSubmitError("You must verify your Steam credentials before posting. Click 'Check Account' first.");
      return;
    }

    try {
      const games = values.gamesList.split(",").map((s) => s.trim()).filter(Boolean);
      if (games.length === 0) {
        form.setError("gamesList", { message: "Please provide valid game names separated by commas" });
        return;
      }

      const res = await createAccount.mutateAsync({
        data: {
          title: values.title,
          description: values.description,
          games,
          pointsCost: values.pointsCost,
          steamUsername: values.steamUsername,
          steamPassword: values.steamPassword,
          unlockMethod: values.unlockMethod,
          isFamilyShare,
          ...(user?.isAdmin && values.customButtonEnabled ? {
            customButtonEnabled: true,
            customButtonLabel: values.customButtonLabel || "",
            customButtonUrl: values.customButtonUrl || "",
          } : {}),
        } as any,
      });

      if ((res as any).pendingReview) {
        setPendingReview(true);
        return;
      }
      setLocation(`/accounts/${res.id}`);
    } catch (e: any) {
      setSubmitError(e.message || "Submission failed. Please try again.");
    }
  }

  const hasCredentials = !!watchUsername && !!watchPassword;
  const canSubmit = verifyStatus === "valid" && dupStatus !== "exists" && dupStatus !== "checking";

  const verifyIcon = verifyStatus === "checking"
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : verifyStatus === "valid"
      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
      : verifyStatus === "invalid"
        ? <XCircle className="h-4 w-4 text-red-400" />
        : null;

  if (pendingReview) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 max-w-lg text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <HourglassIcon className="h-10 w-10 text-amber-500" />
            </div>
          </div>
          <h1 className="text-3xl font-black mb-3">Submitted for Review</h1>
          <p className="text-muted-foreground mb-6 text-base leading-relaxed">
            Your family share account listing is <strong className="text-foreground">pending admin review</strong>. Since the game list couldn't be exported automatically, an admin will verify and approve it. You'll earn <strong className="text-foreground">50 XP</strong> when it goes live.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 text-sm text-amber-600 text-left space-y-1 mb-8">
            <p className="font-semibold">What happens next?</p>
            <p>• An admin will review your listing soon</p>
            <p>• They can adjust which games are shown</p>
            <p>• Once approved, your listing goes live instantly</p>
          </div>
          <Button className="w-full" onClick={() => setLocation("/")}>Back to Home</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <button onClick={() => window.history.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="mb-8">
          <h1 className="text-3xl font-black">Upload Account</h1>
          <p className="text-muted-foreground mt-2">Share your Steam account and earn XP. You must verify the credentials before posting.</p>
        </div>

        <Alert className="mb-8 bg-blue-500/10 border-blue-500/20 text-blue-600">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Earn Rewards</AlertTitle>
          <AlertDescription>
            You will earn <strong>50 XP</strong> automatically when this account is published. If you set a Points Cost, you receive those points when someone claims it.
          </AlertDescription>
        </Alert>

        <Card className="bg-card border-border shadow-xl">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Fill in all fields. You must check the account is working before you can post.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
                {/* Hidden dummy fields to prevent browser save-password prompt */}
                <input type="text" name="fakeusernameremembered" autoComplete="username" style={{ display: "none" }} aria-hidden="true" readOnly />
                <input type="password" name="fakepasswordremembered" autoComplete="new-password" style={{ display: "none" }} aria-hidden="true" readOnly />
                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 flex items-center gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    {submitError}
                  </div>
                )}

                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Listing Title</FormLabel>
                    <FormControl><Input placeholder="e.g. CS:GO Prime + Rust + Terraria" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <MarkdownEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Describe the account, games included, any notes..."
                      rows={4}
                    />
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="gamesList" render={({ field }) => {
                  const isVerifiedNotFamilyShare = verifyStatus === "valid" && !isFamilyShare;
                  return (
                    <FormItem>
                      <FormLabel>Games (comma-separated)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={isFamilyShare ? "CS:GO, Rust, Terraria, GTA V" : "Only available for Family Share accounts"}
                          {...field}
                          readOnly={isVerifiedNotFamilyShare}
                          disabled={!isFamilyShare}
                          className={!isFamilyShare ? "bg-muted/50 cursor-not-allowed text-muted-foreground" : ""}
                        />
                      </FormControl>
                      {isVerifiedNotFamilyShare ? (
                        <FormDescription className="text-amber-500">
                          Games are auto-filled from Steam and cannot be edited.
                        </FormDescription>
                      ) : isFamilyShare ? (
                        <FormDescription>
                          Family Share detected — enter the games manually, separated by commas.
                        </FormDescription>
                      ) : (
                        <FormDescription className="text-muted-foreground/70">
                          Games can only be entered for Family Share accounts. Verify your account first.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }} />

                <FormField control={form.control} name="pointsCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points Cost (0 = Free)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormDescription>Set to 0 to offer the account for free.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="unlockMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unlock Requirement</FormLabel>
                    <FormControl>
                      <select
                        className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm"
                        value={field.value}
                        onChange={field.onChange}
                      >
                        <option value="login">Login only — anyone logged in can claim</option>
                        <option value="like">Must Like — viewer must like the post first</option>
                        <option value="comment">Must Comment — viewer must comment first</option>
                      </select>
                    </FormControl>
                    <FormDescription>Choose what action a viewer must complete before they can see the credentials.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Steam Credentials + Verify */}
                <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Steam Credentials</h3>

                  <FormField control={form.control} name="steamUsername" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Steam Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your_steam_username"
                          autoComplete="off"
                          {...field}
                          onChange={(e) => { field.onChange(e); setVerifyStatus("idle"); setDupStatus("idle"); setIsFamilyShare(false); }}
                        />
                      </FormControl>
                      <FormMessage />
                      {dupStatus === "checking" && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking if this account is already listed…
                        </p>
                      )}
                      {dupStatus === "exists" && (
                        <div className="flex items-start gap-2 mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 text-sm text-amber-600">
                          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">Account already listed</p>
                            <p className="text-xs opacity-80 mt-0.5">This Steam username has already been submitted by someone. Duplicate listings are not allowed.</p>
                          </div>
                        </div>
                      )}
                      {dupStatus === "free" && watchUsername.trim().length >= 2 && (
                        <p className="flex items-center gap-1.5 text-xs text-green-600 mt-1">
                          <CheckCircle2 className="h-3 w-3" /> This username is not yet listed — good to go.
                        </p>
                      )}
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="steamPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Steam Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••••"
                          autoComplete="new-password"
                          {...field}
                          onChange={(e) => { field.onChange(e); setVerifyStatus("idle"); setIsFamilyShare(false); }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Verify Button + Status */}
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant={verifyStatus === "valid" ? "outline" : "default"}
                      onClick={handleVerify}
                      disabled={!hasCredentials || verifyStatus === "checking"}
                      className="gap-2 w-full"
                    >
                      {verifyIcon}
                      {verifyStatus === "checking"
                        ? `Checking... ${elapsed}s (est. 15-20s)`
                        : verifyStatus === "valid"
                          ? "✓ Account Verified — Re-check"
                          : "Check Account"}
                    </Button>

                    {verifyStatus === "checking" && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-600 flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">Contacting Steam servers…</p>
                          <p className="text-xs opacity-80 mt-0.5">Estimated wait: 15–20 seconds. Please don't close this tab.</p>
                        </div>
                      </div>
                    )}

                    {verifyStatus === "valid" && !isFamilyShare && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {verifyMessage || "Credentials verified — account is valid!"}
                      </div>
                    )}

                    {verifyStatus === "valid" && isFamilyShare && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-600 space-y-1">
                        <div className="flex items-center gap-2 font-semibold">
                          <HourglassIcon className="h-4 w-4 shrink-0" />
                          Family Share account detected
                        </div>
                        <p className="text-xs opacity-90">
                          Steam couldn't export a game list — this is typical for family share accounts. You can enter the games manually below. Your listing will go to <strong>admin review</strong> before going live.
                        </p>
                      </div>
                    )}

                    {verifyStatus === "invalid" && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 flex items-center gap-2">
                        <XCircle className="h-4 w-4 shrink-0" />
                        Wrong password.
                      </div>
                    )}

                    {verifyStatus === "2fa" && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 flex items-start gap-2">
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">2FA is enabled on this account</p>
                          <p className="text-xs opacity-80 mt-0.5">Only accounts without Steam Guard / 2FA can be posted.</p>
                        </div>
                      </div>
                    )}

                    {(verifyStatus === "error" || verifyStatus === "rate_limited") && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 flex items-center gap-2">
                        <XCircle className="h-4 w-4 shrink-0" />
                        {verifyMessage || "Could not verify credentials. Please check them and try again."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin: custom button */}
                {user?.isAdmin && (
                  <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Admin: Custom Button</h3>
                    <FormField control={form.control} name="customButtonEnabled" render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">Show a custom button on the published account page</FormLabel>
                      </FormItem>
                    )} />
                    {form.watch("customButtonEnabled") && (
                      <div className="space-y-3 pt-1">
                        <FormField control={form.control} name="customButtonLabel" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Button Label</FormLabel>
                            <FormControl><Input placeholder="e.g. Join Discord" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="customButtonUrl" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Button URL</FormLabel>
                            <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full font-bold h-12"
                  disabled={!canSubmit || createAccount.isPending}
                  title={!canSubmit ? "You must verify the account first" : ""}
                >
                  {createAccount.isPending
                    ? (isFamilyShare ? "Submitting for Review..." : "Publishing...")
                    : canSubmit
                      ? (isFamilyShare ? "Submit for Admin Review" : "Publish Account")
                      : "Verify Account First to Publish"}
                </Button>

                {!canSubmit && verifyStatus === "idle" && (
                  <p className="text-xs text-center text-muted-foreground">
                    Use the "Check Account" button above to verify your credentials before posting.
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
