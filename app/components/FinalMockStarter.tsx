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
        setError((payload as { error?: string } | null)?.error ?? "Failed to load exam blueprint.");
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
      setError(payload?.error ?? "Failed to start exam.");
      setStarting(false);
      return;
    }

    router.push(`/attempt/${payload.attemptId}`);
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading blueprint…</p>;
  }

  if (!config) {
    return (
      <p className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
        {error ?? "Final mock is unavailable."}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <tr>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3 text-right">Weight</th>
              <th className="px-4 py-3 text-right">Questions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {config.sections.map((section) => (
              <tr key={section.subject} className="text-gray-700 dark:text-gray-300">
                <td className="px-4 py-3">{section.subject}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-400 dark:text-gray-500">
                  {section.weightPercent}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                  {section.targetQuestions}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <tr className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{config.totalWeightPercent}%</td>
              <td className="px-4 py-3 text-right tabular-nums">{config.totalQuestions}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void startFinalMock()}
        disabled={starting}
        className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {starting ? "Starting…" : `Start ${config.totalQuestions}-question exam`}
      </button>
    </div>
  );
}
