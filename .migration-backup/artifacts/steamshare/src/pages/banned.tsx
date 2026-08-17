import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Ban, Clock, MessageCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

function timeRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Permanent ban";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Lifting soon...";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h ${mins}m remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings", { credentials: "include" });
      if (!res.ok) return { contact: {} };
      return res.json() as Promise<{ contact: Record<string, string> }>;
    },
  });
}

export default function Banned() {
  const { data: user } = useGetMe();
  const { data: settings } = useSiteSettings();
  const supportEmail = settings?.contact?.contact_email || "support@steamfamily.gg";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">

        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive/20 mx-auto">
          <Ban className="h-10 w-10 text-destructive" />
        </div>

        <div>
          <h1 className="text-3xl font-black text-foreground mb-2">Account Suspended</h1>
          <p className="text-muted-foreground">
            Your account has been suspended from Steam Family.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 text-left space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold mb-1">Reason</p>
              <p className="text-sm text-muted-foreground">
                {user?.banReason || "Violation of community guidelines"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold mb-1">Duration</p>
              <p className="text-sm text-muted-foreground">
                {user?.banExpiresAt
                  ? <>Expires {new Date(user.banExpiresAt).toLocaleString()} — <strong className="text-foreground">{timeRemaining(user.banExpiresAt)}</strong></>
                  : "Permanent"
                }
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, please contact our support team.
          </p>
          <Button asChild className="w-full gap-2">
            <a href={`mailto:${supportEmail}`}>
              <MessageCircle className="h-4 w-4" />
              Contact Support
            </a>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
