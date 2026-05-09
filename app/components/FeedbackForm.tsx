"use client";

import { useState } from "react";

export default function FeedbackForm() {
  const [comment, setComment] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment, whatsapp }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setStatus(payload?.error ?? "Failed to submit feedback.");
      setPending(false);
      return;
    }

    setComment("");
    setWhatsapp("");
    setStatus("Thanks. Your feedback has been received.");
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Tell us what worked, what felt slow, or what should be improved next."
        rows={4}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        required
      />
      <input
        type="text"
        value={whatsapp}
        onChange={(event) => setWhatsapp(event.target.value)}
        placeholder="WhatsApp (optional)"
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Your feedback is attached to your account for follow-up.</p>
        <button
          type="submit"
          disabled={pending || comment.trim().length < 5}
          className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send feedback"}
        </button>
      </div>
      {status ? (
        <p className={`text-sm ${status.startsWith("Thanks") ? "text-emerald-700" : "text-red-700"}`}>{status}</p>
      ) : null}
    </form>
  );
}
