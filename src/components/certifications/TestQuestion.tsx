import type { CertificationQuestion } from "../../types/certifications";

interface TestQuestionProps {
  question: CertificationQuestion;
  questionIndex: number;
  totalQuestions: number;
  value: string;
  onChange: (answer: string) => void;
}

export function TestQuestion({
  question,
  questionIndex,
  totalQuestions,
  value,
  onChange,
}: TestQuestionProps) {
  const options = question.options ?? {};
  const keys = Object.keys(options).sort();
  const isShortAnswer = question.question_type === "short_answer";

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-4 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-emerald-100/90">
        Question {questionIndex + 1} of {totalQuestions}
        {question.category && ` · ${question.category}`}
        {isShortAnswer && (
          <span className="ml-2 rounded bg-blue-500/30 px-1.5 py-0.5 text-blue-200 font-medium">
            Written Response
          </span>
        )}
      </p>
      <p className="mb-4 text-base font-semibold text-white">{question.question_text}</p>
      
      {isShortAnswer ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={4}
          className="w-full rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2.5 text-sm text-white placeholder-emerald-200/50 focus:border-emerald-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
        />
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <label
              key={k}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:ring-offset-2 ${
                value === k
                  ? "border-emerald-500/60 bg-emerald-500/30 shadow-md"
                  : "border-emerald-500/20 bg-emerald-950/30 hover:border-emerald-500/40 hover:bg-emerald-950/40"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.question_id}`}
                value={k}
                checked={value === k}
                onChange={() => onChange(k)}
                className="h-4 w-4 border-emerald-500/40 text-emerald-500 focus:ring-emerald-500/50"
              />
              <span className="text-sm font-medium text-white">{options[k]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
