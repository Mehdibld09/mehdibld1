import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, ArrowLeft, Bot, MoreVertical, Trash2, Flag, Ban, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function renderBotMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-black/20 rounded px-0.5 font-mono text-xs">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline">$1</a>')
    .replace(/\n/g, "<br/>");
}

interface Conversation {
  partner_id: number;
  partner_username: string;
  partner_avatar_url: string | null;
  partner_is_admin: boolean;
  partner_is_moderator: boolean;
  content: string;
  created_at: string;
  unread_count: number;
  sender_id: number;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/messages/conversations", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

async function fetchMessages(userId: number): Promise<Message[]> {
  const res = await fetch(`/api/messages/${userId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

async function sendMessage(receiverId: number, content: string): Promise<Message> {
  const res = await fetch("/api/messages", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiverId, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to send message");
  }
  return res.json();
}

async function deleteMessage(messageId: number): Promise<void> {
  const res = await fetch(`/api/messages/${messageId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete message");
}

async function reportUser(targetId: number, reason: string, details: string): Promise<void> {
  const res = await fetch("/api/reports", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType: "user", targetId, reason, details }),
  });
  if (!res.ok) throw new Error("Failed to submit report");
}

function RoleBadge({ isAdmin, isModerator }: { isAdmin?: boolean; isModerator?: boolean }) {
  if (isAdmin) {
    return (
      <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
        Admin
      </span>
    );
  }
  if (isModerator) {
    return (
      <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
        Mod
      </span>
    );
  }
  return null;
}

interface ReportModalProps {
  targetId: number;
  targetUsername: string;
  onClose: () => void;
}

function ReportModal({ targetId, targetUsername, onClose }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) { setError("Please describe the reason."); return; }
    if (!proof.trim()) { setError("Please provide proof or details."); return; }
    setLoading(true);
    setError("");
    try {
      await reportUser(targetId, reason.trim(), proof.trim());
      setSubmitted(true);
    } catch {
      setError("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-400" />
            <h3 className="font-bold text-foreground">Report {targetUsername}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Flag className="h-5 w-5 text-green-400" />
            </div>
            <p className="font-semibold text-foreground">Report submitted</p>
            <p className="text-sm text-muted-foreground mt-1">Our team will review it shortly.</p>
            <Button className="mt-5 w-full" variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1.5">Reason</label>
              <Input
                placeholder="e.g. Spam, harassment, scam..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-secondary/40 border-border rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1.5">
                Proof / Details <span className="text-red-400">*</span>
              </label>
              <Textarea
                placeholder="Describe what happened and provide any relevant evidence (screenshots, links, message content, etc.)"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                rows={4}
                className="bg-secondary/40 border-border rounded-xl resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Proof is required to process your report.</p>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                {loading ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Header 3-dot menu: Block + Report only (no delete)
function HeaderMenu({ targetId, targetUsername }: { targetId: number; targetUsername: string }) {
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [blockDone, setBlockDone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function handleBlock() {
    setOpen(false);
    await reportUser(targetId, "block", `User blocked by conversation partner`);
    setBlockDone(true);
  }

  return (
    <>
      <div className="relative ml-auto shrink-0" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute right-0 z-20 bg-popover border border-border rounded-xl shadow-xl py-1 w-36 text-sm top-full mt-1">
            <button
              onClick={() => { setOpen(false); setShowReport(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-foreground hover:text-primary transition-colors"
            >
              <Flag className="h-3.5 w-3.5" /> Report
            </button>
            <button
              onClick={handleBlock}
              disabled={blockDone}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-foreground hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" /> {blockDone ? "Blocked" : "Block"}
            </button>
          </div>
        )}
      </div>
      {showReport && (
        <ReportModal
          targetId={targetId}
          targetUsername={targetUsername}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}

export default function Messages() {
  const { data: me } = useGetMe();
  const [location, navigate] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
  const [selectedIsAdmin, setSelectedIsAdmin] = useState(false);
  const [selectedIsMod, setSelectedIsMod] = useState(false);
  const [draft, setDraft] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = parseInt(params.get("user") || "0", 10);
    const username = params.get("username") || "";
    if (userId && username) {
      setSelectedUserId(userId);
      setSelectedUsername(decodeURIComponent(username));
      setMobileView("chat");
    }
  }, [location]);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    refetchInterval: 5000,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", selectedUserId],
    queryFn: () => fetchMessages(selectedUserId!),
    enabled: !!selectedUserId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ receiverId, content }: { receiverId: number; content: string }) =>
      sendMessage(receiverId, content),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });


  const handleSend = () => {
    if (!draft.trim() || !selectedUserId) return;
    sendMutation.mutate({ receiverId: selectedUserId, content: draft.trim() });
  };

  const selectUser = (conv: Conversation) => {
    setSelectedUserId(conv.partner_id);
    setSelectedUsername(conv.partner_username);
    setSelectedAvatarUrl(conv.partner_avatar_url ?? null);
    setSelectedIsAdmin(!!conv.partner_is_admin);
    setSelectedIsMod(!!conv.partner_is_moderator);
    setMobileView("chat");
  };

  // Derive avatar when conversation is opened via URL param (no selectUser call)
  const derivedAvatarUrl = selectedAvatarUrl ?? conversations?.find(c => c.partner_id === selectedUserId)?.partner_avatar_url ?? null;

  if (!me) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Please <Link href="/login" className="text-primary hover:underline">log in</Link> to use messages.</p>
        </div>
      </Layout>
    );
  }

  const isBot = selectedUsername === "Admin Bot";

  return (
    <Layout noFooter>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <button
          onClick={() => { const prev = window.location.pathname; window.history.back(); setTimeout(() => { if (window.location.pathname === prev) navigate("/"); }, 80); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group w-fit"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Messages
        </h1>

        <div className="bg-card border border-border rounded-xl overflow-hidden flex h-[600px]">
          {/* Sidebar */}
          <div className={`w-full md:w-72 border-r border-border flex flex-col shrink-0 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!conversations || conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No conversations yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Visit a user's profile to start a chat.</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.partner_id}
                    onClick={() => selectUser(conv)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left ${selectedUserId === conv.partner_id ? "bg-primary/10 border-r-2 border-primary" : ""}`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={conv.partner_avatar_url || undefined} />
                      <AvatarFallback>{(conv.partner_username?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-sm truncate">{conv.partner_username}</span>
                          <RoleBadge isAdmin={conv.partner_is_admin} isModerator={conv.partner_is_moderator} />
                        </div>
                        {Number(conv.unread_count) > 0 && (
                          <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.content}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
            {!selectedUserId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Or visit a user's profile to start a new one.</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="p-3 border-b border-border flex items-center gap-3">
                  <button className="md:hidden mr-1" onClick={() => setMobileView("list")}>
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  {isBot ? (
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={derivedAvatarUrl || undefined} />
                      <AvatarFallback>{(selectedUsername?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isBot ? (
                      <span className="font-semibold">{selectedUsername}</span>
                    ) : (
                      <Link href={`/profile/${selectedUserId}`} className="font-semibold hover:text-primary truncate">
                        {selectedUsername}
                      </Link>
                    )}
                    {isBot && (
                      <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        System
                      </span>
                    )}
                    {!isBot && <RoleBadge isAdmin={selectedIsAdmin} isModerator={selectedIsMod} />}
                    {!isBot && (
                      <HeaderMenu targetId={selectedUserId!} targetUsername={selectedUsername} />
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
                  {[...(messages ?? [])].reverse().map((msg) => {
                    const isMe = msg.senderId === me.id;
                    const isBotMsg = !isMe && isBot;
                    return (
                      <div key={msg.id} className={`flex group items-end gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                        {isBotMsg && (
                          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mr-1 shrink-0">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}

                        <div
                          className={`max-w-[70%] min-w-0 rounded-2xl px-4 py-2 text-sm ${
                            isMe
                              ? "bg-primary text-white rounded-br-sm"
                              : isBotMsg
                                ? "bg-primary/10 border border-primary/20 text-foreground rounded-bl-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {isBotMsg || msg.content.includes('**') || msg.content.includes('\n') ? (
                            <p
                              className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                              dangerouslySetInnerHTML={{ __html: renderBotMarkdown(msg.content) }}
                            />
                          ) : (
                            <p className="break-words [overflow-wrap:anywhere]">{msg.content}</p>
                          )}
                          <p className={`text-[10px] mt-0.5 ${isMe ? "text-white/70 text-right" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(msg.createdAt))} ago
                          </p>
                        </div>

                        {isMe && (
                          <button
                            onClick={async () => { await deleteMessage(msg.id); refetchMessages(); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isBot ? (
                  <div className="p-3 border-t border-border flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/20">
                    <Bot className="h-4 w-4 text-primary/60" />
                    This is an automated notification channel — replies are disabled
                  </div>
                ) : (
                  <div className="p-3 border-t border-border flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      className="flex-1"
                    />
                    <Button size="icon" onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
