export type CourseLesson = {
  slug: string;
  number: number;
  title: string;
  subtitle: string;
  duration: number;
  goal: string;
  learn: { title: string; body: string; example: string }[];
  scenario: {
    setting: string;
    prompt: string;
    options: { text: string; feedback: string }[];
  };
  rewrite: { prompt: string; template: string; checks: string[] };
  quiz: { question: string; options: string[]; correct: number; explanation: string }[];
  practice: { title: string; body: string };
  card: string[];
  sources: { title: string; url: string }[];
  reviewStatus: "draft";
};

export type CourseSummary = Pick<CourseLesson, "slug" | "number" | "title" | "subtitle" | "duration" | "goal">;
