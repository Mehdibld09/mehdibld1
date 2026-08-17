import { Layout } from "@/components/layout";
import {
  useListGiveaways,
  useCreateGiveaway,
  useDeleteGiveaway,
  useEnterGiveaway,
  useDrawGiveaway,
  useGetMe,
  getListGiveawaysQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Gift, Trophy, Users, Clock, CheckCircle2, Plus, Trash2, Zap, Link2, ArrowLeft, Check, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeUntil(d: string): string {
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

async function fetchEntries(giveawayId: number) {
  const res = await fetch(`/api/giveaways/${giveawayId}/entries`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load entries");
  return res.json() as Promise<{
    id: number; userId: number; username: string; taskProof: string | null;
    isApproved: boolean; isRejected: boolean; createdAt: string; ipAddress: string | null;
  }[]>;
}

async function approveEntry(giveawayId: number, entryId: number) {
  const res = await fetch(`/api/giveaways/${giveawayId}/entries/${entryId}/approve`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function rejectEntry(giveawayId: number, entryId: number) {
  const res = await fetch(`/api/giveaways/${giveawayId}/entries/${entryId}/reject`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function Toggle({ enabled, onToggle, label, description }: { enabled: boolean; onToggle: () => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${enabled ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border"}`}
    >
      <div className="text-left">
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {enabled
        ? <ToggleRight className="h-6 w-6 text-primary shrink-0" />
        : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />
      }
    </button>
  );
}

function EntryRow({ entry, giveawayId, onUpdate }: {
  entry: { id: number; username: string; taskProof: string | null; isApproved: boolean; isRejected: boolean; createdAt: string };
  giveawayId: number; onUpdate: () => void;
}) {
  const approve = useMutation({ mutationFn: () => approveEntry(giveawayId, entry.id), onSuccess: onUpdate });
  const reject = useMutation({ mutationFn: () => rejectEntry(giveawayId, entry.id), onSuccess: onUpdate });
  const isImage = entry.taskProof && entry.taskProof.startsWith("http") && /\.(png|jpg|jpeg|gif|webp)/i.test(entry.taskProof);

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${entry.isApproved ? "border-green-500/30 bg-green-500/5" : entry.isRejected ? "border-red-500/30 bg-red-500/5" : "border-border bg-muted/20"}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm truncate">{entry.username}</span>
          {entry.isApproved && <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs py-0 shrink-0">Approved</Badge>}
          {entry.isRejected && <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs py-0 shrink-0">Rejected</Badge>}
          {!entry.isApproved && !entry.isRejected && <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs py-0 shrink-0">Pending</Badge>}
        </div>
        <div className="flex gap-1.5 shrink-0">
          {!entry.isApproved && (
            <Button size="sm" className="h-7 px-2 bg-green-600 hover:bg-green-500 text-white gap-1 text-xs" onClick={() => approve.mutate()} disabled={approve.isPending}>
              <Check className="h-3 w-3" /> Approve
            </Button>
          )}
          {!entry.isRejected && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:bg-red-500/10 gap-1 text-xs" onClick={() => reject.mutate()} disabled={reject.isPending}>
              <X className="h-3 w-3" /> Reject
            </Button>
          )}
        </div>
      </div>
      {entry.taskProof && (
        <div className="text-xs text-muted-foreground break-all">
          <span className="font-semibold text-foreground/70">Proof: </span>
          {isImage ? (
            <a href={entry.taskProof} target="_blank" rel="noopener noreferrer">
              <img src={entry.taskProof} alt="Proof" className="mt-1.5 max-h-36 rounded-lg border border-border object-contain" />
            </a>
          ) : (
            <a href={entry.taskProof.startsWith("http") ? entry.taskProof : undefined} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {entry.taskProof}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function EntriesPanel({ giveawayId, autoApprove }: { giveawayId: number; autoApprove: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: entries, refetch, isLoading } = useQuery({
    queryKey: ["giveaway-entries", giveawayId],
    queryFn: () => fetchEntries(giveawayId),
    enabled: open,
  });

  const pending = entries?.filter((e) => !e.isApproved && !e.isRejected) ?? [];
  const approved = entries?.filter((e) => e.isApproved) ?? [];
  const rejected = entries?.filter((e) => e.isRejected) ?? [];
  const total = entries?.length ?? 0;

  return (
    <div className="border-t border-border mt-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Entries {entries && `(${total})`}
          {autoApprove && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Auto-Approve</Badge>}
          {!autoApprove && pending.length > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">{pending.length} pending</Badge>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 sm:px-6 pb-5 space-y-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading entries...</p>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No entries yet.</p>
          ) : (
            <>
              {!autoApprove && pending.length > 0 && (
                <section>
                  <p className="text-xs font-bold uppercase text-yellow-500 mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pending ({pending.length})</p>
                  <div className="space-y-2">{pending.map((e) => <EntryRow key={e.id} entry={e} giveawayId={giveawayId} onUpdate={refetch} />)}</div>
                </section>
              )}
              {approved.length > 0 && (
                <section>
                  <p className="text-xs font-bold uppercase text-green-500 mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Approved ({approved.length})</p>
                  <div className="space-y-2">{approved.map((e) => <EntryRow key={e.id} entry={e} giveawayId={giveawayId} onUpdate={refetch} />)}</div>
                </section>
              )}
              {rejected.length > 0 && (
                <section>
                  <p className="text-xs font-bold uppercase text-red-500 mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Rejected ({rejected.length})</p>
                  <div className="space-y-2">{rejected.map((e) => <EntryRow key={e.id} entry={e} giveawayId={giveawayId} onUpdate={refetch} />)}</div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Giveaways() {
  const { data: giveaways, isLoading } = useListGiveaways();
  const { data: user } = useGetMe();
  const createGiveaway = useCreateGiveaway();
  const deleteGiveaway = useDeleteGiveaway();
  const enterGiveaway = useEnterGiveaway();
  const drawGiveaway = useDrawGiveaway();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", prize: "", taskDescription: "",
    taskLink: "", taskCode: "", maxEntries: "100", endDate: "",
    autoApprove: false,
    showTaskLink: false,
    requireProof: true,
  });
  const [formError, setFormError] = useState("");

  const [enterProofs, setEnterProofs] = useState<Record<number, string>>({});
  const [enterCodes, setEnterCodes] = useState<Record<number, string>>({});
  const [enterErrors, setEnterErrors] = useState<Record<number, string>>({});
  const [enterSuccess, setEnterSuccess] = useState<Record<number, boolean>>({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListGiveawaysQueryKey() });

  const toggle = (key: "autoApprove" | "showTaskLink" | "requireProof") =>
    setForm((f) => ({ ...f, [key]: !f[key] }));

  const handleCreate = async () => {
    setFormError("");
    if (!form.title || !form.description || !form.prize || !form.taskDescription || !form.endDate) {
      setFormError("All required fields must be filled.");
      return;
    }
    try {
      await createGiveaway.mutateAsync({
        data: {
          title: form.title,
          description: form.description,
          prize: form.prize,
          taskDescription: form.taskDescription,
          taskLink: form.showTaskLink && form.taskLink ? form.taskLink : undefined,
          taskCode: form.taskCode || undefined,
          maxEntries: parseInt(form.maxEntries) || 100,
          endDate: new Date(form.endDate).toISOString(),
          autoApprove: form.autoApprove,
        } as any,
      });
      setCreateOpen(false);
      setForm({ title: "", description: "", prize: "", taskDescription: "", taskLink: "", taskCode: "", maxEntries: "100", endDate: "", autoApprove: false, showTaskLink: false, requireProof: true });
      refresh();
    } catch (e: any) {
      setFormError(e.message || "Failed to create giveaway");
    }
  };

  const handleEnter = async (giveawayId: number, requireProof: boolean) => {
    setEnterErrors((prev) => ({ ...prev, [giveawayId]: "" }));
    if (requireProof && !enterProofs[giveawayId]?.trim()) {
      setEnterErrors((prev) => ({ ...prev, [giveawayId]: "Please provide proof of task completion." }));
      return;
    }
    try {
      await enterGiveaway.mutateAsync({
        giveawayId,
        data: {
          taskProof: enterProofs[giveawayId] || "",
          code: enterCodes[giveawayId] || undefined,
        } as any,
      });
      setEnterSuccess((prev) => ({ ...prev, [giveawayId]: true }));
      refresh();
    } catch (e: any) {
      setEnterErrors((prev) => ({ ...prev, [giveawayId]: e.message || "Failed to enter" }));
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-5xl">
        <button onClick={() => window.history.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/20">
              <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">Giveaways</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Complete tasks to enter and win prizes.</p>
            </div>
          </div>

          {user?.isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> New</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Giveaway</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  {formError && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>}

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Title *</label>
                    <Input placeholder="e.g. Steam Gift Card Giveaway" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Description *</label>
                    <Textarea placeholder="Tell people about this giveaway..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Prize *</label>
                    <Input placeholder="e.g. $20 Steam Gift Card" value={form.prize} onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Task Description *</label>
                    <Textarea placeholder="What must users do to enter?" value={form.taskDescription} onChange={(e) => setForm((f) => ({ ...f, taskDescription: e.target.value }))} />
                  </div>

                  {/* Task link toggle */}
                  <Toggle
                    enabled={form.showTaskLink}
                    onToggle={() => toggle("showTaskLink")}
                    label="Add Task Link"
                    description="Include a URL users must visit to complete the task"
                  />
                  {form.showTaskLink && (
                    <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                      <Input placeholder="https://..." value={form.taskLink} onChange={(e) => setForm((f) => ({ ...f, taskLink: e.target.value }))} />
                    </div>
                  )}

                  {/* Secret code */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Secret Code <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Input placeholder="e.g. STEAM2024" value={form.taskCode} onChange={(e) => setForm((f) => ({ ...f, taskCode: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Entries with correct code are auto-approved.</p>
                  </div>

                  {/* Require proof toggle */}
                  <Toggle
                    enabled={form.requireProof}
                    onToggle={() => toggle("requireProof")}
                    label="Require Proof Screenshot"
                    description="Users must submit a link or screenshot to prove task completion"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Max Entries</label>
                      <Input type="number" min="1" value={form.maxEntries} onChange={(e) => setForm((f) => ({ ...f, maxEntries: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">End Date *</label>
                      <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>

                  {/* Auto-approve toggle */}
                  <Toggle
                    enabled={form.autoApprove}
                    onToggle={() => toggle("autoApprove")}
                    label="Auto-Approve Entries"
                    description="All entries are approved instantly without manual review"
                  />

                  <Button className="w-full" onClick={handleCreate} disabled={createGiveaway.isPending}>
                    {createGiveaway.isPending ? "Creating..." : "Create Giveaway"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Giveaway list */}
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : !giveaways || giveaways.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Gift className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No giveaways right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {giveaways.map((giveaway) => {
              const ended = !giveaway.isActive || new Date(giveaway.endDate) < new Date();
              const hasWinner = !!giveaway.winnerUsername;
              const hasCode = !!(giveaway as any).taskCode;
              const autoApprove = !!(giveaway as any).autoApprove;
              const hasTaskLink = !!(giveaway as any).taskLink;

              return (
                <Card key={giveaway.id} className={`bg-card border-border overflow-hidden ${!ended ? "shadow-[0_0_25px_rgba(var(--primary),0.06)]" : ""}`}>
                  <CardContent className="p-0">

                    {/* Card header */}
                    <div className={`px-4 sm:px-6 py-4 border-b border-border ${ended ? "bg-muted/10" : "bg-primary/5"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="text-lg sm:text-xl font-black truncate">{giveaway.title}</h2>
                            {ended
                              ? <Badge variant="outline" className="text-muted-foreground shrink-0">Ended</Badge>
                              : <Badge className="bg-green-500/20 text-green-500 border-green-500/30 shrink-0">Live</Badge>
                            }
                            {autoApprove && !ended && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs shrink-0">Auto-Approve</Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm line-clamp-2">{giveaway.description}</p>
                        </div>

                        {/* Admin controls */}
                        {user?.isAdmin && (
                          <div className="flex gap-1.5 shrink-0">
                            {!ended && (
                              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs gap-1" onClick={async () => { await drawGiveaway.mutateAsync({ giveawayId: giveaway.id }); refresh(); }} disabled={drawGiveaway.isPending}>
                                <Trophy className="h-3.5 w-3.5" /> Draw
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={async () => { await deleteGiveaway.mutateAsync({ giveawayId: giveaway.id }); refresh(); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats row — mobile friendly */}
                    <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                      <div className="flex flex-col items-center py-3 px-2 text-center">
                        <Gift className="h-4 w-4 text-primary mb-1" />
                        <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Prize</p>
                        <p className="font-bold text-xs sm:text-sm truncate w-full text-center px-1">{giveaway.prize}</p>
                      </div>
                      <div className="flex flex-col items-center py-3 px-2 text-center">
                        <Users className="h-4 w-4 text-blue-400 mb-1" />
                        <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Entries</p>
                        <p className="font-bold text-xs sm:text-sm">{giveaway.entriesCount}/{giveaway.maxEntries}</p>
                      </div>
                      <div className="flex flex-col items-center py-3 px-2 text-center">
                        <Clock className="h-4 w-4 text-orange-400 mb-1" />
                        <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Ends</p>
                        <p className="font-bold text-xs sm:text-sm">{ended ? formatDate(giveaway.endDate) : timeUntil(giveaway.endDate)}</p>
                      </div>
                    </div>

                    {/* Task + entry section */}
                    <div className="px-4 sm:px-6 py-4 space-y-3">
                      {/* Task info */}
                      <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                        <div className="text-xs uppercase text-muted-foreground font-semibold flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Task to Enter
                        </div>
                        <p className="text-sm">{giveaway.taskDescription}</p>
                        {hasTaskLink && (
                          <a href={(giveaway as any).taskLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 w-fit">
                            <Link2 className="h-3.5 w-3.5" /> Go to task →
                          </a>
                        )}
                        {hasCode && (
                          <p className="text-xs text-muted-foreground italic">A secret code is required to enter.</p>
                        )}
                      </div>

                      {/* Winner */}
                      {hasWinner && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-3">
                          <Trophy className="h-5 w-5 text-yellow-400 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-yellow-500">Winner: {giveaway.winnerUsername}</p>
                            <p className="text-xs text-muted-foreground">Congratulations!</p>
                          </div>
                        </div>
                      )}

                      {/* Entry form */}
                      {!ended && !hasWinner && (
                        <div>
                          {giveaway.userHasEntered || enterSuccess[giveaway.id] ? (
                            <div className="flex items-center gap-2 text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>{autoApprove ? "You're in! Auto-approved. Good luck!" : "You're entered! Waiting for approval."}</span>
                            </div>
                          ) : user ? (
                            <div className="space-y-2">
                              <Input
                                placeholder="Proof link or screenshot URL…"
                                value={enterProofs[giveaway.id] || ""}
                                onChange={(e) => setEnterProofs((p) => ({ ...p, [giveaway.id]: e.target.value }))}
                              />
                              {hasCode && (
                                <Input
                                  placeholder="Enter secret code…"
                                  value={enterCodes[giveaway.id] || ""}
                                  onChange={(e) => setEnterCodes((p) => ({ ...p, [giveaway.id]: e.target.value }))}
                                  className="border-primary/30"
                                />
                              )}
                              {enterErrors[giveaway.id] && (
                                <p className="text-sm text-red-500">{enterErrors[giveaway.id]}</p>
                              )}
                              <Button className="w-full" onClick={() => handleEnter(giveaway.id, false)} disabled={enterGiveaway.isPending}>
                                {enterGiveaway.isPending ? "Entering…" : "Enter Giveaway"}
                              </Button>
                            </div>
                          ) : (
                            <a href="/login">
                              <Button variant="outline" className="w-full">Login to Enter</Button>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline entries panel (admin only) */}
                    {user?.isAdmin && <EntriesPanel giveawayId={giveaway.id} autoApprove={autoApprove} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
