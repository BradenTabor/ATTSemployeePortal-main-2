-- =============================================================================
-- Seed: Skid Steer certification type, practical template, questions
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
  'Skid Steer',
  'skid-steer',
  'Certification for operating skid steer equipment for mulching and grappling.',
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

-- Practical evaluation template (Skid Steer)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'skid-steer' LIMIT 1;
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
      'mulching_grappling_observation',
      2,
      '[
        {"item_id": "m1", "item_name": "Machine positioned correctly"},
        {"item_id": "m2", "item_name": "All safety features being used"},
        {"item_id": "m3", "item_name": "Safe mulching/grappling observed"},
        {"item_id": "m4", "item_name": "Clear communication between Groundman and Operator"},
        {"item_id": "m5", "item_name": "300 feet distance maintained from Groundman"},
        {"item_id": "m6", "item_name": "Line of sight maintained by Groundman and Operator"},
        {"item_id": "m7", "item_name": "10 feet buffer zone maintained from poles and guy wires"},
        {"item_id": "m8", "item_name": "Operator observed in control and comfortable operating skid steer"}
      ]'::jsonb,
      8
    ),
    (
      v_ct_id,
      'machine_shutdown',
      3,
      '[
        {"item_id": "d1", "item_name": "Machine parked in a suitable location"},
        {"item_id": "d2", "item_name": "Machine brought down to idle speed with mowing head disengaged"},
        {"item_id": "d3", "item_name": "Operator allows head to come to a complete stop before opening cab door and exiting"},
        {"item_id": "d4", "item_name": "Machine properly shut down"},
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
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'skid-steer' LIMIT 1;
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
    (v_ct_id, 1, 'What is the required buffer zone you must maintain around poles and guy wires?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 2, 'How far are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "10 feet", "B": "1 span", "C": "2 spans", "D": "100 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 3, 'What should you do if a person(s) enters the 300ft Buffer zone?', 'multiple_choice',
     '{"A": "Notify your groundman to ask them to leave", "B": "Continue mulching", "C": "Mulch in the opposite direction", "D": "Stop immediately"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 4, 'What is the minimum distance you are required to keep from any marked hazards?', 'multiple_choice',
     '{"A": "6 feet", "B": "8 feet", "C": "10 feet", "D": "2 feet"}'::jsonb, 'A', 1, 'safety', 'medium', true),
    
    (v_ct_id, 5, 'Who is responsible for identifying potential hazards?', 'multiple_choice',
     '{"A": "Operator", "B": "Groundman", "C": "Pre-planner", "D": "Operator and Groundman"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 6, 'How often are you required to grease moving parts on the skid steer?', 'multiple_choice',
     '{"A": "Once a day", "B": "Once a week", "C": "Every 8 hours", "D": "Twice a day"}'::jsonb, 'C', 1, 'maintenance', 'medium', true),
    
    (v_ct_id, 7, 'What is the correct distance to stay away from any ledges or drop offs while operating a skid steer?', 'multiple_choice',
     '{"A": "2 feet", "B": "4 feet", "C": "6 feet", "D": "8 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 8, 'What is the maximum degree allowed to operate a skid steer on sideling ground?', 'multiple_choice',
     '{"A": "45 degrees", "B": "35 degrees", "C": "25 degrees", "D": "15 degrees"}'::jsonb, 'C', 1, 'operation', 'medium', true),
    
    (v_ct_id, 9, 'It is never allowed for any other person(s) to ride in or on the skid steer other than the operator.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 10, 'Who is responsible for filling out the daily job safety analysis?', 'multiple_choice',
     '{"A": "The groundman", "B": "The operator", "C": "The general foreman", "D": "Both the groundman and the operator"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 11, 'When ascending or descending the skid steer how many points of contact should you maintain?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    (v_ct_id, 12, 'What is the maximum height you are allowed to carry a load while grappling brush?', 'multiple_choice',
     '{"A": "2 feet", "B": "3 feet", "C": "4 feet", "D": "5 feet"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    (v_ct_id, 13, 'You are only required to wear the seat belt in a skid steer when you are on rough terrain.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 14, 'What is the proper track tension play on the skid steer?', 'multiple_choice',
     '{"A": "2 ½ inches", "B": "½ to 1 inch", "C": "3 inches", "D": "5 inches"}'::jsonb, 'A', 1, 'maintenance', 'hard', true),
    
    (v_ct_id, 15, 'What turning maneuver should you use to prevent disturbing maintained ground such as a yard?', 'multiple_choice',
     '{"A": "2 pt turn", "B": "3 pt turn", "C": "4 pt turn", "D": "5 pt turn"}'::jsonb, 'D', 1, 'operation', 'medium', true),
    
    (v_ct_id, 16, 'When mulching with the skid steer you must never raise the head above _____.', 'multiple_choice',
     '{"A": "2 feet", "B": "3 feet", "C": "4 feet", "D": "5 feet"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    (v_ct_id, 17, 'When going over a steep grade what approach should you take?', 'multiple_choice',
     '{"A": "Angling approach", "B": "Directly forward approach", "C": "Backwards approach", "D": "Whichever the terrain allows"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    (v_ct_id, 18, 'What is a key sign that sprockets need to be replaced on the skid steer?', 'multiple_choice',
     '{"A": "When the paint wears off them", "B": "When the teeth begin to break off", "C": "When the teeth begin to wear in a saw shape pattern", "D": "When there are no more teeth left on the sprockets"}'::jsonb, 'C', 1, 'maintenance', 'hard', true),
    
    (v_ct_id, 19, 'What are the steps you need to take if you find a downed power line?', 'short_answer',
     '{}'::jsonb, 'Back away two spans, notify operator, notify anyone else in the area, notify general foreman and O.C', 1, 'safety', 'hard', true),
    
    (v_ct_id, 20, 'List five safety features on the skid steer.', 'short_answer',
     '{}'::jsonb, 'Windshield, seat belt, horn, backup beeper, backup camera', 1, 'safety', 'medium', true),
    
    (v_ct_id, 21, 'Where is the emergency hydraulic release on the skid steer and what is it for?', 'short_answer',
     '{}'::jsonb, 'Overhead on the cab, it is used to release hydraulic pressure to bring the head down if there is a breakdown', 1, 'operation', 'hard', true),
    
    (v_ct_id, 22, 'Where are the two emergency exits located on the skid steer?', 'short_answer',
     '{}'::jsonb, 'In the front and in the rear back glass', 1, 'safety', 'medium', true)
  ON CONFLICT (certification_type_id, question_number) DO NOTHING;
END $$;
