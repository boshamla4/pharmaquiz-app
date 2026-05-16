"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface FinalMockSection {
  subject: string;
  weightPercent: number;
  targetQuestions: number;
}

interface FinalMockConfig {
  program: string;
  totalQuestions: number;
  totalWeightPercent: number;
  sections: FinalMockSection[];
}

export default function FinalMockStarter() {
  const router = useRouter();
  const [config, setConfig] = useState<FinalMockConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      const response = await fetch("/api/attempts/final-mock/start");
      const payload = (await response.json().catch(() => null)) as FinalMockConfig | { error?: string } | null;

      if (!response.ok || !payload || "error" in payload) {
        setError((payload as { error?: string } | null)?.error ?? "Failed to load final mock blueprint.");
        setLoading(false);
        return;
      }

      setConfig(payload as FinalMockConfig);
      setError(null);
      setLoading(false);
    }

    void loadConfig();
  }, []);

  async function startFinalMock() {
    setStarting(true);
    setError(null);

    const response = await fetch("/api/attempts/final-mock/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalQuestions: config?.totalQuestions ?? 100 }),
    });
    const payload = (await response.json().catch(() => null)) as { attemptId?: string; error?: string } | null;

    if (!response.ok || !payload?.attemptId) {
      setError(payload?.error ?? "Failed to start final mock.");
      setStarting(false);
      return;
    }

    router.push(`/attempt/${payload.attemptId}`);
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Loading final mock blueprint…</p>;
  }

  if (!config) {
    return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error ?? "Final mock is unavailable."}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {config.sections.map((section) => (
              <tr key={section.subject}>
                <td className="px-4 py-3">{section.subject}</td>
                <td className="px-4 py-3">{section.weightPercent}%</td>
                <td className="px-4 py-3">{section.targetQuestions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        onClick={() => void startFinalMock()}
        disabled={starting}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {starting ? "Starting…" : `Start ${config.totalQuestions}-question final mock`}
      </button>
    </div>
  );
}
