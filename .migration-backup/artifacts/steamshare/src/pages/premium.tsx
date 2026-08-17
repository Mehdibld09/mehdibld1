import { Layout } from "@/components/layout";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Coins, Crown, Star, Zap, Palette, Shield, ThumbsUp, MessageSquare, CheckCircle2, Gift } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Pricing {
  premiumPointsPrice: number;
  premiumUsdCents: number;
  proUsdCents: number;
  discountPercent: number;
  basicColors: string[];
  proContactUrl: string;
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Premium() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [buying, setBuying] = useState(false);

  const { data: pricing } = useQuery<Pricing>({
    queryKey: ["/api/premium/pricing"],
    queryFn: async () => {
      const res = await fetch("/api/premium/pricing");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/premium/status"],
    queryFn: async () => {
      const res = await fetch("/api/premium/status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!me,
  });

  const handleBuyWithPoints = async () => {
    if (!me) return;
    setBuying(true);
    try {
      const res = await fetch("/api/premium/buy-points", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Purchase failed");
      }
      toast({ title: "Premium activated!", description: "Your Premium subscription is now active for 30 days." });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      refetchStatus();
    } catch (e: any) {
      toast({ title: "Purchase failed", description: e.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const discount = pricing?.discountPercent ?? 0;

  function OriginalPrice({ cents }: { cents: number }) {
    if (!discount || discount <= 0) return null;
    const original = Math.round(cents / (1 - discount / 100));
    return (
      <span className="text-red-500 line-through text-sm mr-1">{formatUsd(original)}</span>
    );
  }

  const tierActive = status?.isActive ? status.tier : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="h-8 w-8 text-yellow-400" />
            <h1 className="text-3xl font-black">Premium Membership</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Unlock exclusive perks, stand out with custom name colors and badges, and enjoy an enhanced experience.
          </p>
          {discount > 0 && (
            <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-sm px-3 py-1">
              🎉 {discount}% OFF — Limited Time Discount!
            </Badge>
          )}
        </div>

        {/* Current Status */}
        {me && status?.isActive && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-yellow-400 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-300">
                {tierActive === "pro" ? "Pro" : "Premium"} Active
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : "—"}
              </p>
            </div>
            <Link href="/edit-profile" className="ml-auto">
              <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10">
                Customize
              </Button>
            </Link>
          </div>
        )}

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Premium Card */}
          <div className={`bg-card border rounded-2xl p-6 space-y-5 ${tierActive === "premium" ? "border-yellow-500/50" : "border-border"}`}>
            <div className="flex items-center gap-3">
              <img src="/badge-gold.png" alt="Premium" className="w-10 h-10" />
              <div>
                <h2 className="text-xl font-black">Premium</h2>
                <p className="text-xs text-muted-foreground">Buy with points or USD</p>
              </div>
              {tierActive === "premium" && (
                <Badge className="ml-auto bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Active</Badge>
              )}
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              {pricing ? (
                <>
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-primary text-lg">{pricing.premiumPointsPrice} pts</span>
                    <span className="text-xs text-muted-foreground">/ month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">or</span>
                    <OriginalPrice cents={pricing.premiumUsdCents} />
                    <span className="font-bold text-lg">{formatUsd(pricing.premiumUsdCents)}</span>
                    <span className="text-xs text-muted-foreground">/ month</span>
                  </div>
                </>
              ) : (
                <div className="h-12 bg-secondary animate-pulse rounded" />
              )}
            </div>

            {/* Features */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What you get</p>
              <ul className="space-y-2">
                <FeatureItem icon={<img src="/badge-gold.png" className="w-4 h-4" />} text="Gold badge next to your name" />
                <FeatureItem icon={<Palette className="h-4 w-4 text-pink-400" />} text="Custom name color (6 colors)" />
                <FeatureItem icon={<Star className="h-4 w-4 text-yellow-400" />} text="Name color shown on all posts & comments" />
                <FeatureItem icon={<Crown className="h-4 w-4 text-yellow-400" />} text="Stand out on the leaderboard" />
              </ul>
            </div>

            {/* CTA */}
            {me ? (
              tierActive === "premium" || tierActive === "pro" ? (
                <Button disabled className="w-full" variant="outline">
                  Already Active
                </Button>
              ) : (
                <Button
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  onClick={handleBuyWithPoints}
                  disabled={buying || !pricing || (me as any).points < (pricing?.premiumPointsPrice ?? 9999)}
                >
                  {buying ? "Processing..." : `Buy with ${pricing?.premiumPointsPrice ?? "..."} pts`}
                </Button>
              )
            ) : (
              <Link href="/login">
                <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                  Login to Subscribe
                </Button>
              </Link>
            )}
            {me && pricing && (me as any).points < pricing.premiumPointsPrice && !tierActive && (
              <p className="text-xs text-center text-muted-foreground">
                You need {pricing.premiumPointsPrice - (me as any).points} more points.{" "}
                <Link href="/earn" className="text-primary hover:underline">Earn points</Link>
              </p>
            )}
          </div>

          {/* Pro Card */}
          <div className={`bg-card border rounded-2xl p-6 space-y-5 relative overflow-hidden ${tierActive === "pro" ? "border-blue-500/50" : "border-border"}`}>
            <div className="absolute top-3 right-3">
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs">USD only</Badge>
            </div>

            <div className="flex items-center gap-3">
              <img src="/badge-vip.png" alt="Pro VIP" className="w-10 h-10" />
              <div>
                <h2 className="text-xl font-black">Pro</h2>
                <p className="text-xs text-muted-foreground">All Premium features + more</p>
              </div>
              {tierActive === "pro" && (
                <Badge className="ml-auto bg-blue-600/20 text-blue-400 border-blue-600/30">Active</Badge>
              )}
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              {pricing ? (
                <div className="flex items-center gap-2">
                  <OriginalPrice cents={pricing.proUsdCents} />
                  <span className="font-bold text-lg">{formatUsd(pricing.proUsdCents)}</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
              ) : (
                <div className="h-8 bg-secondary animate-pulse rounded" />
              )}
            </div>

            {/* Features */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Everything in Premium, plus</p>
              <ul className="space-y-2">
                <FeatureItem icon={<img src="/badge-vip.png" className="w-4 h-4" />} text="VIP badge (choose gold or VIP)" />
                <FeatureItem icon={<ThumbsUp className="h-4 w-4 text-blue-400" />} text="Bypass like restrictions" />
                <FeatureItem icon={<MessageSquare className="h-4 w-4 text-blue-400" />} text="Bypass reply restrictions" />
                <FeatureItem icon={<Shield className="h-4 w-4 text-blue-400" />} text="Priority support" />
                <FeatureItem icon={<Zap className="h-4 w-4 text-blue-400" />} text="Early access to new features" />
              </ul>
            </div>

            {/* CTA */}
            {me ? (
              tierActive === "pro" ? (
                <Button disabled className="w-full" variant="outline">Already Active</Button>
              ) : (
                <div className="space-y-2">
                  {pricing?.proContactUrl?.startsWith("http") ? (
                    <a href={pricing.proContactUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                        Buy Pro
                      </Button>
                    </a>
                  ) : (
                    <Link href={pricing?.proContactUrl ?? "/messages"}>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                        Buy Pro
                      </Button>
                    </Link>
                  )}
                  <p className="text-xs text-center text-muted-foreground">Pro subscriptions are processed manually.</p>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <Link href="/login">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    Login to Buy Pro
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground">Pro subscriptions are processed manually.</p>
              </div>
            )}
          </div>
        </div>

        {/* Redeem Code */}
        <RedeemCodeBox me={me} status={status} onSuccess={() => { queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }); refetchStatus(); }} />

        {/* Feature comparison note */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-bold text-sm">How badges & colors work</h3>
          <p className="text-sm text-muted-foreground">
            Once subscribed, go to <Link href="/edit-profile" className="text-primary hover:underline">Edit Profile</Link> to pick your name color and badge.
            Your badge and name color will appear next to your name on all account posts, comments, and your profile page.
          </p>
          <p className="text-sm text-muted-foreground">
            Subscriptions are <strong className="text-foreground">monthly</strong> and must be renewed each month. If your subscription expires, your name color and badge will be hidden until you renew.
          </p>
        </div>
      </div>
    </Layout>
  );
}

function RedeemCodeBox({ me, status, onSuccess }: { me: any; status: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/premium/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to redeem");
      toast({ title: "🎉 Code redeemed!", description: data.message });
      setCode("");
      onSuccess();
    } catch (e: any) {
      toast({ title: "Redeem failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = () => {
    if (!code.trim()) return;
    if (status?.isActive) {
      setConfirmOpen(true);
    } else {
      doRedeem();
    }
  };

  const currentTierLabel = status?.tier === "pro" ? "Pro" : "Premium";
  const expiryLabel = status?.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : "";

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active <strong>{currentTierLabel}</strong> subscription
              {expiryLabel ? ` (expires ${expiryLabel})` : ""}. Redeeming a new code will
              replace your current subscription — any remaining days on a different tier will be
              lost. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); doRedeem(); }}>
              Yes, redeem anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-black">Redeem a Code</h2>
            <p className="text-xs text-muted-foreground">Have a premium code? Enter it below to activate your subscription.</p>
          </div>
        </div>
        {me ? (
          <div className="flex gap-2">
            <Input
              placeholder="Enter code (e.g. XXXX-XXXX-XXXX)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
            />
            <Button onClick={handleRedeem} disabled={loading || !code.trim()} className="shrink-0">
              {loading ? "Redeeming..." : "Redeem"}
            </Button>
          </div>
        ) : (
          <Link href="/login">
            <Button variant="outline" className="w-full">Log in to redeem a code</Button>
          </Link>
        )}
      </div>
    </>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </li>
  );
}
