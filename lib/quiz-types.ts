export interface ParsedOption {
  id: string;
  text: string;
  images?: string[];
}

export interface ParsedQuestion {
  id: string;
  question_number: number;
  question_text: string;
  images?: string[];
  options: ParsedOption[];
  correct_answers: string[];
  type?: "single" | "multiple";
  source_page?: number;
}

export interface ParsedSection {
  file: string;
  questions: ParsedQuestion[];
}

export interface ParsedQuestionsFile {
  files: ParsedSection[];
}

export interface QuestionSnapshot extends ParsedQuestion {
  section: string;
  source_order: number;
}

export interface AttemptQuestionRecord {
  id: string;
  attempt_id: string;
  position: number;
  question_id: string | null;
  question_snapshot: QuestionSnapshot;
  selected_answer_ids: string[];
  is_correct: boolean | null;
  score_weight: number | null;
}

export interface QuizAttemptRecord {
  id: string;
  profile_id: string;
  status: "in_progress" | "submitted";
  mode: "ordered" | "random";
  timer_seconds: number | null;
  current_index: number;
  answered_questions: number;
  total_questions: number;
  score: number | null;
  settings: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  submitted_at: string | null;
}
