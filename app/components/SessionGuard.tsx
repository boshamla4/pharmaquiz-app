"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface DisconnectInfo {
  reason: string;
}

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [disconnected, setDisconnected] = useState<DisconnectInfo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't poll on the login page
    if (pathname === "/login") return;

    async function validate() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/auth/validate", { credentials: "include" });
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          const code: string = data?.code ?? "SESSION_INVALID";
          if (code === "SESSION_EXPIRED" || code === "SESSION_HIJACKED") {
            setDisconnected({ reason: code });
            if (intervalRef.current) clearInterval(intervalRef.current);
            dismissTimerRef.current = setTimeout(() => router.push("/login"), 15_000);
          }
        }
      } catch {
        // Network error — don't disconnect
      }
    }

    validate();
    intervalRef.current = setInterval(validate, 45_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [pathname, router]);

  if (disconnected) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="mx-4 w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700">
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            You have been disconnected
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {disconnected.reason === "SESSION_HIJACKED"
              ? "Your account was logged in from another device. Only one active session is allowed."
              : "Your session has expired. Please log in again."}
          </p>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Redirecting to login in about 15 seconds.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
