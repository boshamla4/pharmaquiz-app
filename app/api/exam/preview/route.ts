import { NextRequest, NextResponse } from "next/server";
import { getAttemptPreview } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean) : [];
}

function getFileParts(sourceFile: string): { folder: string; fileName: string } {
  const normalized = sourceFile.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1] ?? sourceFile;
  const folder = parts.length > 1 ? parts[parts.length - 2] : "Ungrouped";
  return { folder, fileName };
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const preview = await getAttemptPreview(session.profileId, {
      sections: normalizeStringArray(body.files ?? body.sections),
      questionTypes: normalizeStringArray(body.questionTypes).filter(
        (entry): entry is "single" | "multiple" => entry === "single" || entry === "multiple",
      ),
      includeRepeated: body.includeRepeated !== false,
      wrongOnly: body.wrongOnly === true,
      useAllQuestions: Boolean(body.useAllQuestions),
      limit: Math.max(1, Math.min(1000, Number(body.limit) || 20)),
    });

    const fileRows = preview.sectionRows.map((row) => {
      const { folder, fileName } = getFileParts(row.section);
      return {
        source_file: row.section,
        folder,
        file_name: fileName,
        total_questions: row.total_questions,
        available_questions: row.available_questions,
      };
    });

    const grouped = new Map<string, { folder: string; total_questions: number; available_questions: number; files: typeof fileRows }>();
    for (const row of fileRows) {
      const group = grouped.get(row.folder) ?? { folder: row.folder, total_questions: 0, available_questions: 0, files: [] };
      group.total_questions += row.total_questions;
      group.available_questions += row.available_questions;
      group.files.push(row);
      grouped.set(row.folder, group);
    }

    return NextResponse.json({
      totalAvailable: preview.totalAvailable,
      plannedQuestionCount: preview.plannedQuestionCount,
      totalMatchingBeforeHistory: preview.totalMatchingBeforeHistory,
      fileRows,
      fileGroups: [...grouped.values()].sort((a, b) => a.folder.localeCompare(b.folder)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute preview." },
      { status: 500 },
    );
  }
}
