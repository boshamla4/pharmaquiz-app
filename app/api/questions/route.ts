import { NextRequest, NextResponse } from "next/server";
import { getQuestionBank } from "@/lib/questions";
import { requireApiSession } from "@/lib/auth";

function getFileParts(source: string): { folder: string; fileName: string } {
  const normalized = source.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1] ?? source;
  const folder = parts.length > 1 ? parts[parts.length - 2] : "Ungrouped";
  return { folder, fileName };
}

export async function GET(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const meta = request.nextUrl.searchParams.get("meta") === "1";
  const questionBank = getQuestionBank();

  if (!meta) {
    return NextResponse.json({ questions: questionBank });
  }

  const modules = new Set<string>();
  const files = new Set<string>();
  const types = new Set<string>();
  const totalsByFile = new Map<string, number>();

  for (const question of questionBank) {
    modules.add(question.section);
    files.add(question.section);
    types.add(question.type ?? "single");
    totalsByFile.set(question.section, (totalsByFile.get(question.section) ?? 0) + 1);
  }

  const fileRows = [...files].map((file) => {
    const { folder, fileName } = getFileParts(file);
    return {
      source_file: file,
      folder,
      file_name: fileName,
      total_questions: totalsByFile.get(file) ?? 0,
    };
  });

  const grouped = new Map<string, { folder: string; total_questions: number; files: typeof fileRows }>();
  for (const row of fileRows) {
    const group = grouped.get(row.folder) ?? { folder: row.folder, total_questions: 0, files: [] };
    group.total_questions += row.total_questions;
    group.files.push(row);
    grouped.set(row.folder, group);
  }

  return NextResponse.json({
    modules: [...modules],
    files: [...files],
    types: [...types],
    fileGroups: [...grouped.values()].sort((a, b) => a.folder.localeCompare(b.folder)),
  });
}
