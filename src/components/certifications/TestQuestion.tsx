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
    <div className="rounded-xl border border-white/10 bg-gray-900 px-5 py-4 shadow-md shadow-black/20">
      <p className="mb-1 text-xs font-medium text-white/60">
        Question {questionIndex + 1} of {totalQuestions}
        {question.category && ` · ${question.category}`}
        {isShortAnswer && (
          <span className="ml-2 inline-block rounded-md bg-blue-500/20 px-1.5 py-0.5 text-xs font-medium text-blue-300">
            Written Response
          </span>
        )}
      </p>
      <p className="mb-4 text-base font-medium text-white">{question.question_text}</p>

      {isShortAnswer ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-white/40 transition-all duration-150 focus-visible:border-emerald-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
        />
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <label
              key={k}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all duration-150 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:ring-offset-2 focus-within:ring-offset-gray-950 ${
                value === k
                  ? "border-emerald-500/40 bg-emerald-500/10 text-white shadow-md shadow-emerald-500/5"
                  : "border-white/10 bg-gray-800/60 text-white/80 hover:border-white/20 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.question_id}`}
                value={k}
                checked={value === k}
                onChange={() => onChange(k)}
                className="h-4 w-4 border-white/20 text-emerald-500 focus-visible:ring-emerald-500/50"
              />
              <span className="font-medium">{options[k]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
