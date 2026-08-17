import { Layout } from "@/components/layout";
import { useListBadges, useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Star, Flame, Zap, Crown, Shield, Trophy, Rocket, ArrowLeft } from "lucide-react";

const ICONS = [Shield, Star, Flame, Zap, Crown, Award, Trophy, Rocket];
const COLORS = [
  "text-blue-400",
  "text-yellow-400",
  "text-orange-400",
  "text-purple-400",
  "text-pink-400",
  "text-green-400",
  "text-cyan-400",
  "text-red-400",
];
const GLOW = [
  "shadow-[0_0_20px_rgba(96,165,250,0.25)]",
  "shadow-[0_0_20px_rgba(250,204,21,0.25)]",
  "shadow-[0_0_20px_rgba(251,146,60,0.25)]",
  "shadow-[0_0_20px_rgba(168,85,247,0.25)]",
  "shadow-[0_0_20px_rgba(236,72,153,0.25)]",
  "shadow-[0_0_20px_rgba(74,222,128,0.25)]",
  "shadow-[0_0_20px_rgba(34,211,238,0.25)]",
  "shadow-[0_0_20px_rgba(248,113,113,0.25)]",
];

export default function Badges() {
  const { data: badges, isLoading } = useListBadges();
  const { data: user } = useGetMe();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <button onClick={() => window.history.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-primary to-yellow-400">
            Badges & Ranks
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Earn XP by uploading accounts, engaging with the community, and redeeming promo codes. Each milestone unlocks a new badge.
          </p>
          {user && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Your XP: <strong className="text-primary">{user.xp}</strong></span>
              {user.badgeName && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>Current badge: <strong className="text-yellow-400">{user.badgeName}</strong></span>
                </>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : badges && badges.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {badges.map((badge, i) => {
              const Icon = ICONS[i % ICONS.length];
              const color = COLORS[i % COLORS.length];
              const glow = GLOW[i % GLOW.length];
              const userXp = user?.xp ?? 0;
              const earned = userXp >= badge.xpThreshold;
              const progress = badge.xpThreshold === 0 ? 100 : Math.min(100, Math.round((userXp / badge.xpThreshold) * 100));

              return (
                <Card
                  key={badge.id}
                  className={`bg-card border-border relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${earned ? glow : "opacity-60"}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-muted/40 border border-border ${earned ? "" : "grayscale"}`}>
                        <Icon className={`h-7 w-7 ${earned ? color : "text-muted-foreground"}`} />
                      </div>
                      {earned ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Earned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">{badge.xpThreshold} XP</Badge>
                      )}
                    </div>

                    <h3 className={`font-black text-lg mb-1 ${earned ? color : "text-muted-foreground"}`}>{badge.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{badge.description}</p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${earned ? "bg-primary" : "bg-muted-foreground/30"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No badges configured yet. Check back soon.</p>
          </div>
        )}

        <div className="mt-16 bg-muted/20 border border-border rounded-xl p-8">
          <h2 className="text-xl font-bold mb-4 text-center">How to earn XP</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { icon: Shield, label: "Upload an account", xp: "+50 XP" },
              { icon: Star, label: "Redeem a promo code", xp: "Varies" },
              { icon: Crown, label: "Admin rewards", xp: "Varies" },
            ].map(({ icon: Icon, label, xp }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <Icon className="h-6 w-6 text-primary" />
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-primary font-mono">{xp}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
