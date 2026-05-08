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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">PharmaQuiz login</h1>
        <p className="mt-3 text-sm text-gray-600">
          Sign in with the access token stored in Supabase to keep tests, sessions, history, and review data synchronized
          across devices.
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
