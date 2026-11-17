"use client";
import { useState } from "react";
import { useStore, setState } from "@/lib/store";
import { sendMessage } from "@/lib/store/actions";
import { now } from "./Page";
import { fmtDate } from "./ui";
// Threaded messages on a request, quote or order. Ops mediates until an order exists, so contact details stay private.
export default function Thread({ thread }: { thread: string }) {
  const s = useStore(); const [text, setText] = useState(""); const isOrder = thread.startsWith("ORD");
  const msgs = s.messages.filter((m) => m.thread === thread && (isOrder || s.role === "ops" || m.from === s.role || m.from === "ops"));
  return (<div>
    <div className="chat" aria-live="polite">{msgs.length === 0 && <span className="small">No messages yet.</span>}
      {msgs.map((m) => <div key={m.id} className={`msg ${m.from === s.role ? "me" : ""}`}><small>{m.from === "ops" ? "CharLink Ops" : m.from} · {fmtDate(m.at)}</small>{m.text}</div>)}</div>
    <form className="row" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; setState((x) => sendMessage(x, thread, x.role, text.trim(), now())); setText(""); }}>
      <label htmlFor={`msg-${thread}`} style={{ position: "absolute", left: -9999 }}>Message</label>
      <input id={`msg-${thread}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message as ${s.role === "ops" ? "CharLink Ops" : s.role}`} style={{ flex: 1, minWidth: 180 }} />
      <button className="btn" type="submit">Send</button>
    </form>
    {!isOrder && <p className="small" style={{ marginTop: 6 }}>CharLink mediates messages before an order: buyers and producers do not see each other's contact details.</p>}
  </div>);
}
