import { redirect } from "next/navigation";
import LoginForm from "@/app/components/LoginForm";
import { getCurrentSession } from "@/lib/auth";
import { hasSupabaseServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!hasSupabaseServerEnv()) {
    redirect("/");
  }

  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PharmaQuiz</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pharmaceutical sciences exam platform</p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Sign in</h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Enter the access code given to you by your instructor.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
