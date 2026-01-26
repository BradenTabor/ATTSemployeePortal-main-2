/**
 * Import certification questions from CSV.
 *
 * Usage: npx tsx scripts/import-cert-questions.ts <cert-slug> <path-to-csv>
 * Example: npx tsx scripts/import-cert-questions.ts bucket-trimmer ./bucket-trimmer-questions.csv
 *
 * CSV columns: question_number,category,difficulty,question_type,question_text,
 *   option_a,option_b,option_c,option_d,correct_answer,points
 * option_c, option_d can be empty for true_false. correct_answer: A|B|C|D.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'papaparse';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REQUIRED = [
  'question_number',
  'category',
  'difficulty',
  'question_type',
  'question_text',
  'option_a',
  'option_b',
  'correct_answer',
  'points',
];

type Row = Record<string, string>;

function buildOptions(row: Row): Record<string, string> | null {
  const opts: Record<string, string> = {};
  for (const k of ['option_a', 'option_b', 'option_c', 'option_d']) {
    const v = (row[k] ?? '').trim();
    if (v) opts[k.replace('option_', '').toUpperCase()] = v;
  }
  if (Object.keys(opts).length === 0) return null;
  return opts;
}

function validate(row: Row, i: number): string | null {
  for (const c of REQUIRED) {
    if (!(c in row) || String(row[c] ?? '').trim() === '') {
      return `Row ${i + 2}: missing or empty "${c}"`;
    }
  }
  const qt = (row.question_type ?? '').toLowerCase();
  if (qt !== 'multiple_choice' && qt !== 'true_false') {
    return `Row ${i + 2}: question_type must be multiple_choice or true_false`;
  }
  const ca = (row.correct_answer ?? '').trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(ca)) {
    return `Row ${i + 2}: correct_answer must be A, B, C, or D`;
  }
  const opts = buildOptions(row);
  if (!opts || !(ca in opts)) {
    return `Row ${i + 2}: correct_answer "${row.correct_answer}" not in options`;
  }
  const n = parseInt(row.question_number!, 10);
  if (Number.isNaN(n) || n < 1) {
    return `Row ${i + 2}: question_number must be a positive integer`;
  }
  const pts = parseInt(row.points!, 10);
  if (Number.isNaN(pts) || pts < 1) {
    return `Row ${i + 2}: points must be a positive integer`;
  }
  const diff = (row.difficulty ?? '').toLowerCase();
  if (diff && !['easy', 'medium', 'hard'].includes(diff)) {
    return `Row ${i + 2}: difficulty must be easy, medium, or hard`;
  }
  return null;
}

async function main() {
  const certSlug = process.argv[2];
  const csvPath = process.argv[3];
  if (!certSlug || !csvPath) {
    console.error('Usage: npx tsx scripts/import-cert-questions.ts <cert-slug> <path-to-csv>');
    process.exit(1);
  }

  const { data: ct } = await supabase
    .from('certification_types')
    .select('id')
    .eq('slug', certSlug)
    .single();

  if (!ct?.id) {
    console.error(`Certification type not found: ${certSlug}`);
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(csvPath, 'utf-8');
  } catch (e) {
    console.error('Failed to read CSV:', (e as Error).message);
    process.exit(1);
  }

  const parsed = parse<Row>(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data ?? [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const err = validate(rows[i], i);
    if (err) errors.push(err);
  }

  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  let processed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const options = buildOptions(r);
    const payload = {
      certification_type_id: ct.id,
      question_number: parseInt(r.question_number!, 10),
      question_text: (r.question_text ?? '').trim(),
      question_type: (r.question_type ?? '').toLowerCase(),
      options,
      correct_answer: (r.correct_answer ?? '').trim().toUpperCase(),
      points: parseInt(r.points!, 10),
      category: (r.category ?? '').trim() || null,
      difficulty: ((r.difficulty ?? '').trim().toLowerCase() || null) as 'easy' | 'medium' | 'hard' | null,
      is_active: true,
    };

    const { error } = await supabase.from('certification_questions').upsert(payload, {
      onConflict: 'certification_type_id,question_number',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`Row ${i + 2}: ${error.message}`);
      continue;
    }
    processed++;
  }

  console.log(`Done. Processed ${rows.length} rows (upserted: ${processed}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
