-- =============================================================================
-- Seed: Geo-Boy certification type, practical template, questions
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
  'Geo-Boy',
  'geo-boy',
  'Certification for operating Geo-Boy brush mulching equipment.',
  'equipment',
  80,
  12,
  true,
  true,
  22,
  '{"safety": 0.35, "operation": 0.35, "maintenance": 0.30}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Practical evaluation template (Geo-Boy)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'geo-boy' LIMIT 1;
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
      'mulching_observation',
      2,
      '[
        {"item_id": "m1", "item_name": "Machine positioned correctly"},
        {"item_id": "m2", "item_name": "All safety features being used"},
        {"item_id": "m3", "item_name": "Safe mulching observed"},
        {"item_id": "m4", "item_name": "Clear communication between Groundman and Operator"},
        {"item_id": "m5", "item_name": "300 feet distance maintained from Groundman"},
        {"item_id": "m6", "item_name": "Line of sight maintained by Groundman and Operator"},
        {"item_id": "m7", "item_name": "10 feet buffer zone maintained from poles and guy wires"},
        {"item_id": "m8", "item_name": "Operator observed in control and comfortable operating Geo-Boy"}
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
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'geo-boy' LIMIT 1;
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
    (v_ct_id, 1, 'What is the most important part of the workday?', 'multiple_choice',
     '{"A": "Beginning", "B": "Lunch time", "C": "Break time", "D": "End"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 2, 'What is the minimum distance you are required to keep between the machine and any hazards?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 3, 'After you are finished working and you have shut off the mowing head how long should you wait until you exit the machine?', 'multiple_choice',
     '{"A": "30 seconds", "B": "Until the head stops rotating", "C": "Until the engine cools down", "D": "As soon as you shut off the mowing head"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    (v_ct_id, 4, 'How often should you check the teeth on the mowing head?', 'multiple_choice',
     '{"A": "Once a day", "B": "Twice a day", "C": "Three times a day", "D": "Once a week"}'::jsonb, 'B', 1, 'maintenance', 'medium', true),
    
    (v_ct_id, 5, 'You are required to maintain 3pts of contact when ascending or descending the machine.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 6, 'How far are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "300 feet", "B": "1 span", "C": "600 feet", "D": "2 spans"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    (v_ct_id, 7, 'You must complete an equipment inspection each day before operation of the Geo-Boy.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'maintenance', 'easy', true),
    
    (v_ct_id, 8, 'What is the minimum distance you are required to maintain from poles and guy wires while operating a Geo-Boy?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 9, 'Who on the crew has "stop work authority"?', 'multiple_choice',
     '{"A": "The operator", "B": "The groundman", "C": "The general foreman", "D": "Every employee"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    (v_ct_id, 10, 'What is the maximum sideling degree you''re allowed to operate a Geo-Boy?', 'multiple_choice',
     '{"A": "10 degrees", "B": "15 degrees", "C": "20 degrees", "D": "25 degrees"}'::jsonb, 'D', 1, 'operation', 'medium', true),
    
    (v_ct_id, 11, 'When is it acceptable to open the safety flap on the mowing head?', 'multiple_choice',
     '{"A": "When 300 feet from any person(s) or property", "B": "When the weather is clear", "C": "When the brush is thick", "D": "When mowing on sideling ground"}'::jsonb, 'A', 1, 'safety', 'medium', true),
    
    (v_ct_id, 12, 'How often are you required to grease moving parts on a Geo-Boy?', 'multiple_choice',
     '{"A": "Once a day", "B": "Once a week", "C": "Once a month", "D": "Every 8 hours"}'::jsonb, 'D', 1, 'maintenance', 'medium', true),
    
    (v_ct_id, 13, 'What do you do if you feel an abnormal vibration in the machine?', 'multiple_choice',
     '{"A": "Stop the machine immediately", "B": "Check for any loose parts or obstructions in the mowing head", "C": "Notify general foreman and stop work until machine is inspected by a mechanic", "D": "All the above are correct"}'::jsonb, 'D', 1, 'operation', 'medium', true),
    
    (v_ct_id, 14, 'It is acceptable for other employees to ride on or in the Geo-Boy with the operator.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 15, 'You are required to maintain a minimum of _____ feet away from drop offs or unstable ground while operating a Geo-Boy?', 'multiple_choice',
     '{"A": "2", "B": "4", "C": "6", "D": "8"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 16, 'It is acceptable to leave the mowing head rotating while roading down any roadway.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'operation', 'easy', true),
    
    (v_ct_id, 17, 'The groundman is the only person who is responsible for identifying hazards.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 18, 'It is ok to mulch brush in ditches and drainages.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'operation', 'easy', true),
    
    (v_ct_id, 19, 'When mulching brush within 300 ft of a roadway you should:', 'multiple_choice',
     '{"A": "Mulch with the safety flap open pointing in the direction of the roadway", "B": "Mulch fast to get it done before a vehicle passes by", "C": "Mulch facing away from the roadway in a backwards motion", "D": "Mulch at an angle so only some debris makes it to the roadway"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 20, 'What PPE is required when operating a Geo-Boy?', 'short_answer',
     '{}'::jsonb, 'Ear plugs', 1, 'safety', 'easy', true),
    
    (v_ct_id, 21, 'What are five safety features on a Geo-Boy and their purposes?', 'short_answer',
     '{}'::jsonb, 'Windshield, backup beeper, backup camera, grab handle, flashing lights', 1, 'safety', 'hard', true),
    
    (v_ct_id, 22, 'List three of the most common Geo-Boy accidents and how they can be prevented.', 'short_answer',
     '{}'::jsonb, 'Flying debris (keep flap closed), roll overs (stay within 25 degrees), falls (maintain 3 pts contact)', 1, 'safety', 'hard', true)
  ON CONFLICT (certification_type_id, question_number) DO NOTHING;
END $$;
