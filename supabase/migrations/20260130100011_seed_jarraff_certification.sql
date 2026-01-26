-- =============================================================================
-- Seed: Jarraff Trimmer certification type, practical template, questions
-- =============================================================================

INSERT INTO public.certification_types (
  name,
  slug,
  description,
  category,
  passing_score,
  validity_months,
  has_written_test,
  has_practical_eval,
  question_count,
  question_categories,
  is_active
) VALUES (
  'Jarraff Trimmer',
  'jarraff-trimmer',
  'Certification for operating Jarraff tree trimmer equipment.',
  'equipment',
  80,
  12,
  true,
  true,
  22,
  '{"safety": 0.40, "operation": 0.35, "maintenance": 0.25}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Practical evaluation template (Jarraff Trimmer)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'jarraff-trimmer' LIMIT 1;
  IF v_ct_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.practical_evaluation_templates (
    certification_type_id,
    category_name,
    category_order,
    items,
    items_count
  ) VALUES
    (
      v_ct_id,
      'machine_startup',
      1,
      '[
        {"item_id": "s1", "item_name": "Equipment inspection completed correctly"},
        {"item_id": "s2", "item_name": "JSA completed correctly"},
        {"item_id": "s3", "item_name": "Proper PPE being worn"},
        {"item_id": "s4", "item_name": "Fueling completed correctly"},
        {"item_id": "s5", "item_name": "Start up and warm up time completed correctly"},
        {"item_id": "s6", "item_name": "Equipment function test completed correctly"}
      ]'::jsonb,
      6
    ),
    (
      v_ct_id,
      'trimming_observation',
      2,
      '[
        {"item_id": "t1", "item_name": "Machine positioned correctly"},
        {"item_id": "t2", "item_name": "All safety features being used"},
        {"item_id": "t3", "item_name": "Safe trimming observed"},
        {"item_id": "t4", "item_name": "Clear communication between Groundman and Operator"},
        {"item_id": "t5", "item_name": "300 feet distance maintained from Groundman"},
        {"item_id": "t6", "item_name": "Line of sight maintained by Groundman and Operator"},
        {"item_id": "t7", "item_name": "10 feet buffer zone maintained from poles and guy wires"},
        {"item_id": "t8", "item_name": "Operator observed in control and comfortable operating trimmer"}
      ]'::jsonb,
      8
    ),
    (
      v_ct_id,
      'machine_shutdown',
      3,
      '[
        {"item_id": "d1", "item_name": "Machine parked in a suitable location"},
        {"item_id": "d2", "item_name": "Machine brought down to idle speed with blade disengaged"},
        {"item_id": "d3", "item_name": "Operator allows blade to come to a complete stop before opening cab door and exiting"},
        {"item_id": "d4", "item_name": "Machine properly shut down with boom cradled"},
        {"item_id": "d5", "item_name": "All debris and fire hazards removed from machine"},
        {"item_id": "d6", "item_name": "Shut down maintenance completed properly"}
      ]'::jsonb,
      6
    )
  ON CONFLICT (certification_type_id, category_name) DO NOTHING;
END $$;

-- Questions (22)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'jarraff-trimmer' LIMIT 1;
  IF v_ct_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.certification_questions (
    certification_type_id,
    question_number,
    question_text,
    question_type,
    options,
    correct_answer,
    points,
    category,
    difficulty,
    is_active
  ) VALUES
    (v_ct_id, 1, 'It is acceptable to operate a tree trimmer with the cab door open in some instances.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 2, 'What is the correct distance to stay away from any ledges or drop offs while operating a tree trimmer?', 'multiple_choice',
     '{"A": "2 feet", "B": "4 feet", "C": "6 feet", "D": "8 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 3, 'What is the minimum approach distance with the tree trimmer saw blade?', 'multiple_choice',
     '{"A": "1.5 feet", "B": "2 feet", "C": "2.5 feet", "D": "3 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 4, 'It is never allowed for any other person(s) to ride in or on a tree trimmer other than the operator.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 5, 'What is the maximum degree allowed to operate a tree trimmer on sideling ground?', 'multiple_choice',
     '{"A": "45 degrees", "B": "35 degrees", "C": "25 degrees", "D": "15 degrees"}'::jsonb, 'C', 1, 'operation', 'medium', true),
    
    (v_ct_id, 6, 'How often are you required to grease moving parts on the tree trimmer?', 'multiple_choice',
     '{"A": "Once a day", "B": "Once a week", "C": "Every 8 hours", "D": "Twice a day"}'::jsonb, 'C', 1, 'maintenance', 'medium', true),
    
    (v_ct_id, 7, 'It is permitted to trim trees directly above the tree trimmer.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 8, 'It is acceptable to trim trees without a clear view of the drop zone.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 9, 'Who is responsible for identifying potential hazards?', 'multiple_choice',
     '{"A": "Operator", "B": "Groundman", "C": "Pre-planner", "D": "Operator and Groundman"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 10, 'You have more control over a limb trimming with a sharp blade vs. a dull blade.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'operation', 'easy', true),
    
    (v_ct_id, 11, 'How often are you required to check the teeth on the saw blade?', 'multiple_choice',
     '{"A": "Everyday", "B": "Once a week", "C": "When installing a new blade", "D": "Once a month"}'::jsonb, 'A', 1, 'maintenance', 'easy', true),
    
    (v_ct_id, 12, 'What is the minimum distance you are required to keep from any marked hazards?', 'multiple_choice',
     '{"A": "6 feet", "B": "8 feet", "C": "10 feet", "D": "2 feet"}'::jsonb, 'A', 1, 'safety', 'medium', true),
    
    (v_ct_id, 13, 'You are required to let the saw blade completely stop spinning before you open the door and exit the cab.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 14, 'Your groundman must maintain line of sight while operating the tree trimmer.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 15, 'What is the correct distance for person(s) to maintain away from the tree trimmer while in operation?', 'multiple_choice',
     '{"A": "200 feet", "B": "300 feet", "C": "400 feet", "D": "500 feet"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 16, 'What should you do if a person(s) enters the 300ft Buffer zone?', 'multiple_choice',
     '{"A": "Notify your groundman to ask them to leave", "B": "Continue trimming", "C": "Trim in the opposite direction", "D": "Stop immediately"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 17, 'Who is responsible for filling out the daily job safety analysis?', 'multiple_choice',
     '{"A": "The groundman", "B": "The operator", "C": "The general foreman", "D": "Both the groundman and the operator"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 18, 'How far are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "10 feet", "B": "1 span", "C": "2 spans", "D": "100 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 19, 'What is the required buffer zone you must maintain around poles and guy wires?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 20, 'Where are the degree indicators located on the tree trimmers?', 'short_answer',
     '{}'::jsonb, 'Inside the cab, on the boom cradle', 1, 'operation', 'medium', true),
    
    (v_ct_id, 21, 'What are the steps you need to take if you find a downed power line?', 'short_answer',
     '{}'::jsonb, 'Back away two spans, notify the machine operator, notify anyone else in the area, call General Foreman and O.C', 1, 'safety', 'hard', true),
    
    (v_ct_id, 22, 'List five safety features on the tree trimmer.', 'short_answer',
     '{}'::jsonb, 'Door, grab handles, backup beeper, backup camera, saw guard', 1, 'safety', 'medium', true)
  ON CONFLICT (certification_type_id, question_number) DO NOTHING;
END $$;
