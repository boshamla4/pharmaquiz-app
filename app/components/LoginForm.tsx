"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function randomFakeToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function LoginForm() {
  const router = useRouter();
  const placeholder = useMemo(() => randomFakeToken(), []);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Invalid access code. Please try again.");
      setPending(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="token" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Access code
        </label>
        <input
          id="token"
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value.toUpperCase().trim())}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-mono tracking-widest text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || token.trim().length === 0}
        className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
