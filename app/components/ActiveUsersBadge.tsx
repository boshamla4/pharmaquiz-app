"use client";

import { useEffect, useState } from "react";

interface ActiveUsersSnapshot {
  activeUsers: number;
  windowMinutes: number;
}

export default function ActiveUsersBadge() {
  const [snapshot, setSnapshot] = useState<ActiveUsersSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const response = await fetch("/api/users/active");
      const payload = (await response.json().catch(() => null)) as Partial<ActiveUsersSnapshot> | null;
      if (!mounted || !response.ok || !payload) return;

      setSnapshot({
        activeUsers: Number(payload.activeUsers ?? 0),
        windowMinutes: Number(payload.windowMinutes ?? 5),
      });
    }

    void load();
    const interval = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
      {snapshot?.activeUsers ?? "…"} online
    </span>
  );
}
