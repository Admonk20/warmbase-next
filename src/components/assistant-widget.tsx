import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { chat } from "@/lib/assistant.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hey — I can help with your pipeline, draft emails, or answer cold-email questions. What's up?" }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatFn = useServerFn(chat);

  const send = useMutation({
    mutationFn: async () => {
      const next = [...msgs, { role: "user" as const, content: input.trim() }];
      setMsgs(next);
      setInput("");
      const res = await chatFn({ data: { messages: next, includeContext: true } });
      return res.reply;
    },
    onSuccess: (reply) => setMsgs((p) => [...p, { role: "assistant", content: reply }]),
    onError: (e: any) => setMsgs((p) => [...p, { role: "assistant", content: `Error: ${e?.message ?? "unknown"}` }]),
  });

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [msgs, send.isPending]);

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-5 right-5 size-12 rounded-full shadow-lg z-40"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open assistant"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
      {open && (
        <Card className="fixed bottom-20 right-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-7rem)] flex flex-col shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="text-sm font-semibold">ColdBase Assistant</div>
            <div className="text-xs text-muted-foreground">Has live access to your pipeline.</div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {m.content}
                </div>
              </div>
            ))}
            {send.isPending && <div className="flex justify-start"><div className="bg-muted rounded-2xl px-3 py-2 text-sm"><Loader2 className="size-4 animate-spin" /></div></div>}
          </div>
          <form
            className="p-2 border-t flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (input.trim() && !send.isPending) send.mutate(); }}
          >
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" autoFocus />
            <Button type="submit" size="icon" disabled={!input.trim() || send.isPending}><Send className="size-4" /></Button>
          </form>
        </Card>
      )}
    </>
  );
}
