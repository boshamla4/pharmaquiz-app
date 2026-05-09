import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExamAliasPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  redirect(`/attempt/${attemptId}`);
}
