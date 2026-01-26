-- =============================================================================
-- Seed: Groundsman certification type, practical template, questions
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
  'Groundsman',
  'groundsman',
  'Certification for groundsman duties including chipper operation, traffic control, and safety procedures.',
  'skill',
  80,
  12,
  true,
  true,
  44,
  '{"safety": 0.35, "chipper": 0.25, "traffic": 0.25, "procedures": 0.15}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Practical evaluation template (Groundsman)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'groundsman' LIMIT 1;
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
      'job_site_setup',
      1,
      '[
        {"item_id": "j1", "item_name": "Wheel chocks placed correctly"},
        {"item_id": "j2", "item_name": "Cone placement correct"},
        {"item_id": "j3", "item_name": "Sign placement correct"},
        {"item_id": "j4", "item_name": "Drop zone cone placement correct"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'spotting_observation',
      2,
      '[
        {"item_id": "sp1", "item_name": "Stand in safe location with clear visual of trimmer and boom"},
        {"item_id": "sp2", "item_name": "Use verbal communication as well as hand signals with trimmer"},
        {"item_id": "sp3", "item_name": "Keep work zone clear of civilians and employees who have not signed JSA"},
        {"item_id": "sp4", "item_name": "Make sure trimmer maintains MAD and uses safe trimming practices"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'chipper_startup',
      3,
      '[
        {"item_id": "cs1", "item_name": "Reverse feed wheels on chipper"},
        {"item_id": "cs2", "item_name": "Make sure clutch is disengaged before starting"},
        {"item_id": "cs3", "item_name": "Allow chipper to warm before engaging clutch"},
        {"item_id": "cs4", "item_name": "Engage clutch and idle up chipper and put feed wheels in forward"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'chipping_practices',
      4,
      '[
        {"item_id": "cp1", "item_name": "Pull brush on the curb side of the chipper"},
        {"item_id": "cp2", "item_name": "Feed a manageable amount of brush into chipper"},
        {"item_id": "cp3", "item_name": "Allow chipper to fully chip brush before adding more"},
        {"item_id": "cp4", "item_name": "If needed use push stick"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'chipper_shutdown',
      5,
      '[
        {"item_id": "cd1", "item_name": "Reverse feed wheels"},
        {"item_id": "cd2", "item_name": "Idle down engine"},
        {"item_id": "cd3", "item_name": "Disengage clutch"},
        {"item_id": "cd4", "item_name": "Shut off engine and remove keys"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'job_site_cleanup',
      6,
      '[
        {"item_id": "jc1", "item_name": "Rake up leaves and debris"},
        {"item_id": "jc2", "item_name": "Pick up any water bottles or trash"},
        {"item_id": "jc3", "item_name": "Pull any limbs left hanging (hangers)"},
        {"item_id": "jc4", "item_name": "Check for any damage to property"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'job_site_pickup',
      7,
      '[
        {"item_id": "jp1", "item_name": "Pick up drop zone cones"},
        {"item_id": "jp2", "item_name": "Pick up work zone cones"},
        {"item_id": "jp3", "item_name": "Pick up wheel chocks"},
        {"item_id": "jp4", "item_name": "Pick up signs"}
      ]'::jsonb,
      4
    )
  ON CONFLICT (certification_type_id, category_name) DO NOTHING;
END $$;

-- Questions (44)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'groundsman' LIMIT 1;
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
    (v_ct_id, 1, 'You should fill out a new JSA for all the following except?', 'multiple_choice',
     '{"A": "Prior to the start of work", "B": "For separate tickets", "C": "Before beginning a new circuit", "D": "Each time you take a break"}'::jsonb, 'D', 1, 'procedures', 'easy', true),
    
    (v_ct_id, 2, 'Which of the following individuals shall be signed on a JSA, if they are on the job site?', 'multiple_choice',
     '{"A": "General Foreman", "B": "O.C", "C": "Workers", "D": "All the above"}'::jsonb, 'D', 1, 'procedures', 'easy', true),
    
    (v_ct_id, 3, 'The DVIR form should be filled out ______?', 'multiple_choice',
     '{"A": "Weekly", "B": "Daily", "C": "Monthly", "D": "Only on Mondays"}'::jsonb, 'B', 1, 'procedures', 'easy', true),
    
    (v_ct_id, 4, 'When work requires that traffic be moved from its normal path, and the flow of traffic must be regulated, a __________ will be requested.', 'multiple_choice',
     '{"A": "Flagger", "B": "Barricade", "C": "General Foreman", "D": "Permit"}'::jsonb, 'A', 1, 'traffic', 'medium', true),
    
    (v_ct_id, 5, 'When work requires complete or partial closure of a traffic lane or a road shoulder, all parts of the traffic control zone shall be used.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic', 'easy', true),
    
    (v_ct_id, 6, 'While lifting debris, brush, and/or logs, you shall bend at your back to maintain a proper lifting posture.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 7, 'Why is it mandatory to keep large logs and brush from high traffic work areas?', 'multiple_choice',
     '{"A": "It can slow down an arial rescue", "B": "It can slow down an emergency rescue", "C": "Slips, trips and fall hazard", "D": "All the above"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    (v_ct_id, 8, 'If you notice a new problem with your equipment while filling out your DVIR book, you should:', 'multiple_choice',
     '{"A": "Wait until you see the mechanic and give him the tear-off slip", "B": "Turn it into your General Foreman at the end of the month", "C": "Turn it into your General Foreman at the end of the week", "D": "Notify the General Foreman immediately"}'::jsonb, 'D', 1, 'procedures', 'easy', true),
    
    (v_ct_id, 9, 'The chipper shall be fed from the _____?', 'multiple_choice',
     '{"A": "Doesn''t matter", "B": "Middle of the chipper", "C": "Curb side", "D": "Traffic side"}'::jsonb, 'C', 1, 'chipper', 'medium', true),
    
    (v_ct_id, 10, 'While feeding the chipper, you should use _____ when trying to push brush and debris into the feed hopper.', 'multiple_choice',
     '{"A": "Your curb side arm", "B": "Metal end of a rake", "C": "Push stick", "D": "Your upper body while bending at the knees"}'::jsonb, 'C', 1, 'chipper', 'medium', true),
    
    (v_ct_id, 11, 'You shall never operate a chainsaw above your _____.', 'multiple_choice',
     '{"A": "Chest", "B": "Waist", "C": "Knee"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 12, 'You shall wear seat belts anytime the vehicle moves.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 13, 'How many points of contact shall you have while mounting and dismounting a vehicle?', 'multiple_choice',
     '{"A": "4", "B": "3", "C": "2", "D": "1"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 14, 'While driving, you shall maintain a _____ degree circle of awareness around the vehicle.', 'multiple_choice',
     '{"A": "180", "B": "90", "C": "360", "D": "120"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    (v_ct_id, 15, 'How many spans are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 16, 'What is the minimum approach distance to energized conductors for persons not qualified to do line clearance?', 'multiple_choice',
     '{"A": "12 feet", "B": "15 feet", "C": "8 feet", "D": "10 feet"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    (v_ct_id, 17, 'Is it ok to spray herbicides next to ponds, lakes, rivers or streams?', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 18, 'It''s a requirement to wash your skin if you come in contact with herbicide.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 19, 'A verbal warning will be given just before _____.', 'multiple_choice',
     '{"A": "The tree begins to fall", "B": "The cutting of the tree starts", "C": "The chainsaw is started", "D": "All the above"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    (v_ct_id, 20, 'When falling a tree the notch should be _____ the diameter of the tree.', 'multiple_choice',
     '{"A": "3/4", "B": "1/4", "C": "1/3", "D": "1/2"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    (v_ct_id, 21, 'It is never allowed to position yourself in the kick back zone.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 22, 'How many feet are you required to stay away from any person running a chainsaw?', 'multiple_choice',
     '{"A": "5", "B": "10", "C": "12", "D": "15"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 23, 'You are required to wear chainsaw chaps while operating a chainsaw in a bucket.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 24, 'If a person is within Minimum Approach Distance (MAD), what steps are to be taken before attempting an aerial rescue?', 'multiple_choice',
     '{"A": "Call your General Foreman", "B": "Call 911", "C": "Call O.C", "D": "All the above"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    (v_ct_id, 25, 'How many feet should you stay away from a Sky trim/Jarraff tree trimmer and brush mulching equipment while they are being operated?', 'multiple_choice',
     '{"A": "200", "B": "300", "C": "400", "D": "500"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    (v_ct_id, 26, 'What job duties are you required to do while working with a tree trimmer or brush mulching crew as a groundman?', 'multiple_choice',
     '{"A": "Cut a 10-foot buffer zone around poles and guy wires", "B": "Mark obstacles with high visibility flagging tape", "C": "Maintain a 300-foot buffer zone from coworkers and pedestrians", "D": "All the above"}'::jsonb, 'D', 1, 'procedures', 'medium', true),
    
    (v_ct_id, 27, 'You should avoid backing when possible.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    (v_ct_id, 28, 'When you are unsure of your surroundings while backing you should:', 'multiple_choice',
     '{"A": "Back up anyways", "B": "Get out and look", "C": "Back up really slow", "D": "Let someone else back up for you"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    (v_ct_id, 29, 'You are only required to use a Lane Closed Ahead sign if you are past the white line.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic', 'medium', true),
    
    (v_ct_id, 30, 'You are required to use wheel chocks only if you are on an incline.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'medium', true),
    
    (v_ct_id, 31, 'You are required to use a Utility Work Ahead sign only if you are next to a roadway or residence.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic', 'medium', true),
    
    (v_ct_id, 32, 'You are required to have cones marking all of the following while working on a highway: Termination Zone, Work Zone, Buffer Zone, and Taper Zone.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic', 'easy', true),
    
    (v_ct_id, 33, 'If you are trimming a tree while parked in a driveway that is right off the main highway, you should:', 'multiple_choice',
     '{"A": "Put a sign in the driveway", "B": "Cone off the driveway", "C": "Put a sign at each end of the highway", "D": "None of the above"}'::jsonb, 'B', 1, 'traffic', 'medium', true),
    
    (v_ct_id, 34, 'Each truck should be equipped with Utility Work Ahead, Lane Closed Ahead, and a Flagger Ahead signs.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic', 'easy', true),
    
    (v_ct_id, 35, 'If your crew needs to leave your work zone and help another crew for a few hours, it is okay to leave your signs out on the highway until you return.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic', 'easy', true),
    
    (v_ct_id, 36, 'You do not have to put signs out while working on a dirt/gravel road.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic', 'easy', true),
    
    (v_ct_id, 37, 'What is the purpose for practicing aerial rescue procedures?', 'short_answer',
     '{}'::jsonb, 'To be prepared in a stressful situation to be able to complete the rescue safely and quickly', 1, 'safety', 'medium', true),
    
    (v_ct_id, 38, 'Describe the CHECK, CALL, CARE procedures.', 'short_answer',
     '{}'::jsonb, 'Check the area for hazards, call 911 or general foreman, care for person injured', 1, 'safety', 'medium', true),
    
    (v_ct_id, 39, 'What PPE shall be worn for operating a chipper?', 'short_answer',
     '{}'::jsonb, 'Hard hat, glasses, ear protection, safety glasses, gloves, safety vest', 1, 'chipper', 'easy', true),
    
    (v_ct_id, 40, 'Name three safety features on a chainsaw.', 'short_answer',
     '{}'::jsonb, 'Chain catch, muffler, chain brake', 1, 'safety', 'medium', true),
    
    (v_ct_id, 41, 'What Personal Protective Equipment is required while spraying herbicide?', 'short_answer',
     '{}'::jsonb, 'Safety glasses, safety vest, gloves, mask, hard hat, long sleeve shirt', 1, 'safety', 'medium', true),
    
    (v_ct_id, 42, 'How many feet should you have between each cone while working on or next to a roadway?', 'short_answer',
     '{}'::jsonb, '10 ft and one additional foot for every 5 MPH over 45 mph', 1, 'traffic', 'hard', true),
    
    (v_ct_id, 43, 'What Personal Protective Equipment is required while operating a chainsaw?', 'short_answer',
     '{}'::jsonb, 'Hard hat, ear plugs, gloves, safety glasses, chainsaw chaps', 1, 'safety', 'easy', true),
    
    (v_ct_id, 44, 'What PPE is required to be worn while trimming from a bucket?', 'short_answer',
     '{}'::jsonb, 'Hard hat, safety glasses, gloves, ear protection, full body harness', 1, 'safety', 'easy', true)
  ON CONFLICT (certification_type_id, question_number) DO NOTHING;
END $$;
