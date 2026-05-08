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
