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
    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-200">
      Active users now: {snapshot?.activeUsers ?? "…"}
      {snapshot?.windowMinutes ? ` (last ${snapshot.windowMinutes} min)` : ""}
    </span>
  );
}
