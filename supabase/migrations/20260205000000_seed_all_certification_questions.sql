-- =============================================================================
-- Comprehensive seed: All certification questions from official PDFs
-- Bucket Trimmer (37), Geo-Boy (22), Groundsman (44), Jarraff (22), Skid Steer (22)
-- =============================================================================

-- First, clear existing questions to avoid duplicates and ensure consistency
-- Then insert all questions from the official PDFs

-- =============================================================================
-- BUCKET TRIMMER CERTIFICATION (37 questions)
-- =============================================================================
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'bucket-trimmer' LIMIT 1;
  IF v_ct_id IS NULL THEN
    RAISE NOTICE 'bucket-trimmer certification type not found, skipping';
    RETURN;
  END IF;

  -- Delete existing questions for this certification to replace with complete set
  DELETE FROM public.certification_questions WHERE certification_type_id = v_ct_id;

  INSERT INTO public.certification_questions (
    certification_type_id, question_number, question_text, question_type, options, correct_answer, points, category, difficulty, is_active
  ) VALUES
    -- Q1: Short answer (PPE)
    (v_ct_id, 1, 'What PPE is required to be worn while trimming from a bucket?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true),
    
    -- Q2: Multiple choice
    (v_ct_id, 2, 'How often are you required to do maintenance on the boom and bucket?', 'multiple_choice', 
     '{"A": "Daily", "B": "Weekly", "C": "Monthly", "D": "Once a year"}'::jsonb, 'A', 1, 'hardware', 'easy', true),
    
    -- Q3: Short answer (hazards)
    (v_ct_id, 3, 'Before beginning trimming a tree what hazards should you look for?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true),
    
    -- Q4: Multiple choice
    (v_ct_id, 4, 'How often are you required to fill out a DVIR form?', 'multiple_choice',
     '{"A": "Daily", "B": "Monthly", "C": "Weekly", "D": "Once a year"}'::jsonb, 'A', 1, 'documentation', 'easy', true),
    
    -- Q5: True/False
    (v_ct_id, 5, 'You are required to perform a tree and job site inspection before trimming each set.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q6: Multiple choice
    (v_ct_id, 6, 'If you are setting up on a highway and need to flag traffic, what are the total number of signs you are required to have out?', 'multiple_choice',
     '{"A": "6", "B": "5", "C": "3", "D": "9"}'::jsonb, 'A', 1, 'traffic_control', 'medium', true),
    
    -- Q7: True/False
    (v_ct_id, 7, 'Anytime you are out of the truck, are you required to wear a reflective vest?', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q8: Short answer (sign placement order)
    (v_ct_id, 8, 'If you are setting up on a highway and a flagger is needed, what order should you place the signs required? Start with the sign farthest from the jobsite and end with the sign nearest to the jobsite.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'traffic_control', 'hard', true),
    
    -- Q9: Short answer (M.A.D)
    (v_ct_id, 9, 'Describe M.A.D and what it means.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true),
    
    -- Q10: Multiple choice
    (v_ct_id, 10, 'What knot will you need to use to secure a limb while using a rope to remove an overhang?', 'multiple_choice',
     '{"A": "Figure 8", "B": "Running bowline", "C": "Sheep bend", "D": "Bowline on a bite"}'::jsonb, 'B', 1, 'knots', 'medium', true),
    
    -- Q11: Multiple choice
    (v_ct_id, 11, 'What is the figure 8 knot used for?', 'multiple_choice',
     '{"A": "Pulley knot", "B": "Ascending and descending", "C": "Roping limbs", "D": "Tying two ropes together"}'::jsonb, 'B', 1, 'knots', 'medium', true),
    
    -- Q12: Multiple choice
    (v_ct_id, 12, 'When is it permitted to drop stop a chainsaw?', 'multiple_choice',
     '{"A": "If you are having trouble starting it", "B": "While working in a bucket", "C": "Anytime you are using a chainsaw on the ground", "D": "If that''s the only way you know how to"}'::jsonb, 'C', 1, 'chainsaw', 'medium', true),
    
    -- Q13: True/False
    (v_ct_id, 13, 'There are some situations where you are permitted to operate a chainsaw without gloves.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q14: Multiple choice
    (v_ct_id, 14, 'When cutting a limb back to a lateral, you should be at least ________ diameter of the limb being cut.', 'multiple_choice',
     '{"A": "1/2", "B": "1/3", "C": "5/8", "D": "1/4"}'::jsonb, 'B', 1, 'trimming', 'medium', true),
    
    -- Q15: Multiple choice
    (v_ct_id, 15, 'A snap cut is used when ____.', 'multiple_choice',
     '{"A": "The branch can fall free", "B": "You need to swing the branch around", "C": "When there is an obstacle under the branch", "D": "Every time you cut a branch"}'::jsonb, 'A', 1, 'trimming', 'medium', true),
    
    -- Q16: Multiple choice
    (v_ct_id, 16, 'A brake cut is used when _________.', 'multiple_choice',
     '{"A": "You want the limb to hinge", "B": "On overhangs only", "C": "For roping only", "D": "You want the limb to fall with no peel"}'::jsonb, 'A', 1, 'trimming', 'medium', true),
    
    -- Q17: Multiple choice
    (v_ct_id, 17, 'Before performing an aerial rescue, the rescuer must first determine?', 'multiple_choice',
     '{"A": "If the person can bring themselves down", "B": "If the paramedics need to be called", "C": "If an electrical hazard exists", "D": "Look at the JSA because it tells you what to do"}'::jsonb, 'C', 1, 'emergency', 'hard', true),
    
    -- Q18: True/False
    (v_ct_id, 18, 'If an employee is within M.A.D, an aerial rescue shall not be performed.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'emergency', 'medium', true),
    
    -- Q19: Short answer (Check, Call, Care)
    (v_ct_id, 19, 'Define check, call, care.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'medium', true),
    
    -- Q20: Multiple choice
    (v_ct_id, 20, 'How many spans are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q21: Multiple choice
    (v_ct_id, 21, 'While walking with a chainsaw, you''re required to ________________.', 'multiple_choice',
     '{"A": "Carry the chainsaw with the bar facing rearward", "B": "Turn off the chainsaw engine", "C": "Engage the chain brake", "D": "All the above"}'::jsonb, 'D', 1, 'chainsaw', 'easy', true),
    
    -- Q22: Short answer (aerial rescue practice importance)
    (v_ct_id, 22, 'Why is it important to practice an aerial rescue?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'medium', true),
    
    -- Q23: True/False
    (v_ct_id, 23, 'In some situations, you are permitted to use a chainsaw one handed.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'chainsaw', 'easy', true),
    
    -- Q24: Multiple choice
    (v_ct_id, 24, 'If you notice a mechanical issue with your truck while filling out the DVIR form, what should you do?', 'multiple_choice',
     '{"A": "Notify your General Foreman immediately", "B": "Fill out the DVIR form and report it", "C": "Shut the truck down if needed", "D": "All the above"}'::jsonb, 'D', 1, 'documentation', 'easy', true),
    
    -- Q25: Multiple choice
    (v_ct_id, 25, 'Which of the following individuals shall be signed on the JSA if they are on the jobsite?', 'multiple_choice',
     '{"A": "Workers", "B": "General Foreman", "C": "OC", "D": "Contractors", "E": "All the above"}'::jsonb, 'E', 1, 'documentation', 'easy', true),
    
    -- Q26: Multiple choice
    (v_ct_id, 26, 'It is NOT permitted to operate a chainsaw above your ___________.', 'multiple_choice',
     '{"A": "Waist", "B": "Chest", "C": "Knees", "D": "Boots"}'::jsonb, 'A', 1, 'chainsaw', 'easy', true),
    
    -- Q27: Short answer (chainsaw safety features)
    (v_ct_id, 27, 'List six safety features on a chainsaw.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'chainsaw', 'hard', true),
    
    -- Q28: Multiple choice
    (v_ct_id, 28, 'How many points of contact are you required to maintain while ascending or descending a bucket truck?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q29: Multiple choice
    (v_ct_id, 29, 'When using the notch method, the notch should be ________ the diameter of the tree being cut.', 'multiple_choice',
     '{"A": "1/2", "B": "1/3", "C": "1/4", "D": "1/8"}'::jsonb, 'B', 1, 'trimming', 'medium', true),
    
    -- Q30: Multiple choice
    (v_ct_id, 30, 'How many feet are you required to stay away from a person operating a chainsaw?', 'multiple_choice',
     '{"A": "5", "B": "10", "C": "15", "D": "20"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q31: Short answer (cone placement areas)
    (v_ct_id, 31, 'While working on a highway, your cones should cover the four areas of the jobsite. List those areas.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'traffic_control', 'hard', true),
    
    -- Q32: Multiple choice
    (v_ct_id, 32, 'How many escape routes are you required to have planned while falling a tree?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    -- Q33: Multiple choice
    (v_ct_id, 33, 'What is the maximum height a tree or Stob can be before a rope is required to aid with the falling?', 'multiple_choice',
     '{"A": "8 feet", "B": "9 feet", "C": "10 feet", "D": "6 feet"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    -- Q34: Multiple choice
    (v_ct_id, 34, 'Employees assisting in the tree falling process are required to be ___________ times the height of the tree away?', 'multiple_choice',
     '{"A": "2", "B": "1", "C": "3", "D": "1 ½"}'::jsonb, 'A', 1, 'safety', 'medium', true),
    
    -- Q35: Short answer (tools and equipment)
    (v_ct_id, 35, 'What tools and equipment shall be out of the truck before work can begin?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true),
    
    -- Q36: Short answer (human performance TOOLS)
    (v_ct_id, 36, 'What are the four TOOLS in human performance?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'human_performance', 'hard', true),
    
    -- Q37: Short answer (human performance TRAPS)
    (v_ct_id, 37, 'What are the four TRAPS in human performance?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'human_performance', 'hard', true);

  RAISE NOTICE 'Inserted 37 Bucket Trimmer questions';
END $$;

-- =============================================================================
-- GEO-BOY CERTIFICATION (22 questions)
-- =============================================================================
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'geoboy' LIMIT 1;
  IF v_ct_id IS NULL THEN
    -- Try alternate slug
    SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'geo-boy' LIMIT 1;
  END IF;
  IF v_ct_id IS NULL THEN
    RAISE NOTICE 'geoboy/geo-boy certification type not found, skipping';
    RETURN;
  END IF;

  -- Delete existing questions for this certification
  DELETE FROM public.certification_questions WHERE certification_type_id = v_ct_id;

  INSERT INTO public.certification_questions (
    certification_type_id, question_number, question_text, question_type, options, correct_answer, points, category, difficulty, is_active
  ) VALUES
    -- Q1: Multiple choice
    (v_ct_id, 1, 'What is the most important part of the workday?', 'multiple_choice',
     '{"A": "Beginning", "B": "Lunch time", "C": "Break time", "D": "End"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q2: Multiple choice
    (v_ct_id, 2, 'What is the minimum distance you are required to keep between the machine and any hazards?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q3: Multiple choice
    (v_ct_id, 3, 'After you are finished working and you have shut off the mowing head how long should you wait until you exit the machine?', 'multiple_choice',
     '{"A": "30 seconds", "B": "Until the head stops rotating", "C": "Until the engine cools down", "D": "As soon as you shut off the mowing head"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q4: Multiple choice
    (v_ct_id, 4, 'How often should you check the teeth on the mowing head?', 'multiple_choice',
     '{"A": "Once a day", "B": "Twice a day", "C": "Three times a day", "D": "Once a week"}'::jsonb, 'A', 1, 'maintenance', 'easy', true),
    
    -- Q5: True/False
    (v_ct_id, 5, 'You are required to maintain 3 points of contact when ascending or descending the machine.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q6: Multiple choice
    (v_ct_id, 6, 'How far are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "300 feet", "B": "1 span", "C": "600 feet", "D": "2 spans"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q7: True/False
    (v_ct_id, 7, 'You must complete an equipment inspection each day before operation of the Geo-Boy.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'documentation', 'easy', true),
    
    -- Q8: Short answer (safety features)
    (v_ct_id, 8, 'What are five safety features on a Geo-Boy and their purposes?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'hard', true),
    
    -- Q9: Multiple choice
    (v_ct_id, 9, 'What is the minimum distance you are required to maintain from poles and guy wires while operating a Geo-Boy?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q10: Multiple choice
    (v_ct_id, 10, 'Who on the crew has "stop work authority"?', 'multiple_choice',
     '{"A": "The operator", "B": "The groundman", "C": "The general foreman", "D": "Every employee"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q11: Multiple choice
    (v_ct_id, 11, 'What is the maximum sideling degree you''re allowed to operate a Geo-Boy?', 'multiple_choice',
     '{"A": "10 degrees", "B": "15 degrees", "C": "20 degrees", "D": "25 degrees"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    -- Q12: Multiple choice
    (v_ct_id, 12, 'When is it acceptable to open the safety flap on the mowing head?', 'multiple_choice',
     '{"A": "When 300 feet from any person(s) or property", "B": "When the weather is clear", "C": "When the brush is thick", "D": "When mowing on sideling ground"}'::jsonb, 'A', 1, 'safety', 'medium', true),
    
    -- Q13: Short answer (PPE)
    (v_ct_id, 13, 'What PPE is required when operating a Geo-Boy?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true),
    
    -- Q14: Multiple choice
    (v_ct_id, 14, 'How often are you required to grease moving parts on a Geo-Boy?', 'multiple_choice',
     '{"A": "Once a day", "B": "Once a week", "C": "Once a month", "D": "Every 8 hours"}'::jsonb, 'D', 1, 'maintenance', 'medium', true),
    
    -- Q15: Multiple choice
    (v_ct_id, 15, 'What do you do if you feel an abnormal vibration in the machine?', 'multiple_choice',
     '{"A": "Stop the machine immediately", "B": "Check for any loose parts or obstructions in the mowing head", "C": "Notify general foreman and stop work until machine is inspected by a mechanic", "D": "All the above are correct"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q16: True/False
    (v_ct_id, 16, 'It is acceptable for other employees to ride on or in the Geo-Boy with the operator.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q17: Multiple choice
    (v_ct_id, 17, 'You are required to maintain a minimum of __________ feet away from drop offs or unstable ground while operating a Geo-Boy?', 'multiple_choice',
     '{"A": "2", "B": "4", "C": "6", "D": "8"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    -- Q18: True/False
    (v_ct_id, 18, 'It is acceptable to leave the mowing head rotating while roading down any roadway.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q19: True/False
    (v_ct_id, 19, 'The groundman is the only person who is responsible for identifying hazards.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q20: Short answer (common accidents)
    (v_ct_id, 20, 'List three of the most common Geo-Boy accidents and how they can be prevented.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'hard', true),
    
    -- Q21: True/False
    (v_ct_id, 21, 'It is ok to mulch brush in ditches and drainages.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'operation', 'easy', true),
    
    -- Q22: Multiple choice
    (v_ct_id, 22, 'When mulching brush within 300 ft of a roadway you should.', 'multiple_choice',
     '{"A": "Mulch with the safety flap open pointing in the direction of the roadway", "B": "Mulch fast to get it done before a vehicle passes by", "C": "Mulch facing away from the roadway in a backwards motion", "D": "Mulch at an angle so only some debris makes it to the roadway"}'::jsonb, 'C', 1, 'safety', 'medium', true);

  RAISE NOTICE 'Inserted 22 Geo-Boy questions';
END $$;

-- =============================================================================
-- GROUNDSMAN CERTIFICATION (44 questions)
-- =============================================================================
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'groundsman' LIMIT 1;
  IF v_ct_id IS NULL THEN
    RAISE NOTICE 'groundsman certification type not found, skipping';
    RETURN;
  END IF;

  -- Delete existing questions for this certification
  DELETE FROM public.certification_questions WHERE certification_type_id = v_ct_id;

  INSERT INTO public.certification_questions (
    certification_type_id, question_number, question_text, question_type, options, correct_answer, points, category, difficulty, is_active
  ) VALUES
    -- Q1: Multiple choice
    (v_ct_id, 1, 'You should fill out a new JSA for all the following except?', 'multiple_choice',
     '{"A": "Prior to the start of work", "B": "For separate tickets", "C": "Before beginning a new circuit", "D": "Each time you take a break"}'::jsonb, 'D', 1, 'documentation', 'easy', true),
    
    -- Q2: Multiple choice
    (v_ct_id, 2, 'Which of the following individuals shall be signed on a JSA, if they are on the job site?', 'multiple_choice',
     '{"A": "General Foreman", "B": "O.C", "C": "Workers", "D": "All the above"}'::jsonb, 'D', 1, 'documentation', 'easy', true),
    
    -- Q3: Multiple choice
    (v_ct_id, 3, 'The DVIR form should be filled out ______?', 'multiple_choice',
     '{"A": "Weekly", "B": "Daily", "C": "Monthly", "D": "Only on Mondays"}'::jsonb, 'B', 1, 'documentation', 'easy', true),
    
    -- Q4: Multiple choice
    (v_ct_id, 4, 'When work requires that traffic be moved from its normal path, and the flow of traffic must be regulated, a __________ will be requested.', 'multiple_choice',
     '{"A": "Flagger", "B": "Barricade", "C": "General Foreman", "D": "Permit"}'::jsonb, 'A', 1, 'traffic_control', 'easy', true),
    
    -- Q5: True/False
    (v_ct_id, 5, 'When work requires complete or partial closure of a traffic lane or a road shoulder, all parts of the traffic control zone shall be used.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic_control', 'easy', true),
    
    -- Q6: True/False
    (v_ct_id, 6, 'While lifting debris, brush, and/or logs, you shall bend at your back to maintain a proper lifting posture.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q7: Multiple choice
    (v_ct_id, 7, 'Why is it mandatory to keep large logs and brush from high traffic work areas?', 'multiple_choice',
     '{"A": "It can slow down an aerial rescue", "B": "It can slow down an emergency rescue", "C": "Slips, trips and fall hazard", "D": "All the above"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q8: Multiple choice
    (v_ct_id, 8, 'If you notice a new problem with your equipment while filling out your DVIR book, you should:', 'multiple_choice',
     '{"A": "Wait until you see the mechanic and give him the tear-off slip", "B": "Turn it into your General Foreman at the end of the month", "C": "Turn it into your General Foreman at the end of the week", "D": "Notify the General Foreman immediately"}'::jsonb, 'D', 1, 'documentation', 'easy', true),
    
    -- Q9: Multiple choice
    (v_ct_id, 9, 'The chipper shall be fed from the ___________________________.', 'multiple_choice',
     '{"A": "Doesn''t matter", "B": "Middle of the chipper", "C": "Curb side", "D": "Traffic side"}'::jsonb, 'C', 1, 'chipper', 'easy', true),
    
    -- Q10: Multiple choice
    (v_ct_id, 10, 'While feeding the chipper, you should use ____________________ when trying to push brush and debris into the feed hopper.', 'multiple_choice',
     '{"A": "Your curb side arm", "B": "Metal end of a rake", "C": "Push stick", "D": "Your upper body while bending at the knees"}'::jsonb, 'C', 1, 'chipper', 'easy', true),
    
    -- Q11: Short answer (chipper PPE)
    (v_ct_id, 11, 'What P.P.E. shall be worn for operating a chipper?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true),
    
    -- Q12: Multiple choice
    (v_ct_id, 12, 'You shall never operate a chainsaw above your ________________________________________.', 'multiple_choice',
     '{"A": "Chest", "B": "Waist", "C": "Knee"}'::jsonb, 'B', 1, 'chainsaw', 'easy', true),
    
    -- Q13: Short answer (chainsaw safety features)
    (v_ct_id, 13, 'Name three safety features on a chainsaw.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'chainsaw', 'medium', true),
    
    -- Q14: True/False
    (v_ct_id, 14, 'You shall wear seat belts anytime the vehicle moves?', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q15: Multiple choice
    (v_ct_id, 15, 'How many points of contact shall you have while mounting and dismounting a vehicle?', 'multiple_choice',
     '{"A": "4", "B": "3", "C": "2", "D": "1"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q16: Multiple choice
    (v_ct_id, 16, 'While driving, you shall maintain a _____________ degree circle of awareness around the vehicle.', 'multiple_choice',
     '{"A": "180", "B": "90", "C": "360", "D": "120"}'::jsonb, 'C', 1, 'driving', 'easy', true),
    
    -- Q17: Multiple choice
    (v_ct_id, 17, 'How many spans are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q18: Multiple choice
    (v_ct_id, 18, 'What is the minimum approach distance to energized conductors for persons not qualified to do line clearance?', 'multiple_choice',
     '{"A": "12 feet", "B": "15 feet", "C": "8 feet", "D": "10 feet"}'::jsonb, 'D', 1, 'safety', 'medium', true),
    
    -- Q19: Multiple choice (duplicate question in PDF - same as Q17)
    (v_ct_id, 19, 'How many spans are you required to stay away from downed power lines? (Reinforcement)', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q20: True/False
    (v_ct_id, 20, 'Is it ok to spray herbicides next to ponds, lakes, rivers or streams?', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'herbicide', 'easy', true),
    
    -- Q21: Short answer (herbicide PPE)
    (v_ct_id, 21, 'What Personal Protective Equipment is required while spraying herbicide?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'herbicide', 'medium', true),
    
    -- Q22: True/False
    (v_ct_id, 22, 'It''s a requirement to wash your skin if you come in contact with herbicide.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'herbicide', 'easy', true),
    
    -- Q23: Multiple choice
    (v_ct_id, 23, 'A verbal warning will be given just before ___________________________.', 'multiple_choice',
     '{"A": "The tree begins to fall", "B": "The cutting of the tree starts", "C": "The chainsaw is started", "D": "All the above"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q24: Multiple choice
    (v_ct_id, 24, 'When falling a tree the notch should be ______________ the diameter of the tree.', 'multiple_choice',
     '{"A": "3/4", "B": "1/4", "C": "1/3", "D": "1/2"}'::jsonb, 'C', 1, 'trimming', 'medium', true),
    
    -- Q25: True/False
    (v_ct_id, 25, 'It is never allowed to position yourself in the kick back zone.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'chainsaw', 'easy', true),
    
    -- Q26: Multiple choice
    (v_ct_id, 26, 'How many feet are you required to stay away from any person running a chainsaw?', 'multiple_choice',
     '{"A": "5", "B": "10", "C": "12", "D": "15"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q27: True/False
    (v_ct_id, 27, 'You are required to wear chainsaw chaps while operating a chainsaw in a bucket.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'medium', true),
    
    -- Q28: Short answer (aerial rescue purpose)
    (v_ct_id, 28, 'What is the purpose for practicing aerial rescue procedures?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'medium', true),
    
    -- Q29: Multiple choice
    (v_ct_id, 29, 'If a person is within Minimum Approach Distance (MAD), what steps are to be taken before attempting an aerial rescue?', 'multiple_choice',
     '{"A": "Call your General Foreman", "B": "Call 911", "C": "Call O.C", "D": "All the above"}'::jsonb, 'D', 1, 'emergency', 'medium', true),
    
    -- Q30: Short answer (Check, Call, Care)
    (v_ct_id, 30, 'Describe the CHECK, CALL, CARE procedures.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'medium', true),
    
    -- Q31: Multiple choice
    (v_ct_id, 31, 'How many feet should you stay away from a Sky trim/Jarraff tree trimmer and brush mulching equipment while they are being operated?', 'multiple_choice',
     '{"A": "200", "B": "300", "C": "400", "D": "500"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q32: Multiple choice
    (v_ct_id, 32, 'What job duties are you required to do while working with a tree trimmer or brush mulching crew as a groundman?', 'multiple_choice',
     '{"A": "Cut a 10-foot buffer zone around poles and guy wires", "B": "Mark obstacles with high visibility flagging tape", "C": "Maintain a 300-foot buffer zone from coworkers and pedestrians", "D": "All the above"}'::jsonb, 'D', 1, 'duties', 'easy', true),
    
    -- Q33: True/False
    (v_ct_id, 33, 'You should avoid backing when possible.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'driving', 'easy', true),
    
    -- Q34: Multiple choice
    (v_ct_id, 34, 'When you are unsure of your surroundings while backing you should.', 'multiple_choice',
     '{"A": "Back up anyways", "B": "Get out and look", "C": "Back up really slow", "D": "Let someone else back up for you"}'::jsonb, 'B', 1, 'driving', 'easy', true),
    
    -- Q35: Short answer (cone spacing)
    (v_ct_id, 35, 'How many feet should you have between each cone while working on or next to a roadway?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'traffic_control', 'medium', true),
    
    -- Q36: True/False
    (v_ct_id, 36, 'You are only required to use a Lane Closed Ahead sign if you are past the white line?', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic_control', 'medium', true),
    
    -- Q37: True/False
    (v_ct_id, 37, 'You are required to use wheel chocks only if you are on an incline.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q38: True/False
    (v_ct_id, 38, 'You are required to use a Utility Work Ahead sign only if you are next to a roadway or residence.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic_control', 'medium', true),
    
    -- Q39: True/False
    (v_ct_id, 39, 'You are required to have cones marking all of the following while working on a highway: Termination Zone, Work Zone, Buffer Zone, and Taper Zone.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic_control', 'medium', true),
    
    -- Q40: Multiple choice
    (v_ct_id, 40, 'If you are trimming a tree while parked in a driveway that is right off the main highway, you should _____________________________.', 'multiple_choice',
     '{"A": "Put a sign in the driveway", "B": "Cone off the driveway", "C": "Put a sign at each end of the highway", "D": "None of the above"}'::jsonb, 'B', 1, 'traffic_control', 'medium', true),
    
    -- Q41: True/False
    (v_ct_id, 41, 'Each truck should be equipped with Utility Work Ahead, Lane Closed Ahead, and a Flagger Ahead signs.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'traffic_control', 'easy', true),
    
    -- Q42: True/False
    (v_ct_id, 42, 'If your crew needs to leave your work zone and help another crew for a few hours, it is okay to leave your signs out on the highway until you return.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic_control', 'easy', true),
    
    -- Q43: True/False
    (v_ct_id, 43, 'You do not have to put signs out while working on a dirt/gravel road.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'traffic_control', 'easy', true),
    
    -- Q44: Short answer (chainsaw PPE)
    (v_ct_id, 44, 'What Personal Protective Equipment is required while operating a chainsaw? (List 5 items)', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'safety', 'medium', true);

  RAISE NOTICE 'Inserted 44 Groundsman questions';
END $$;

-- =============================================================================
-- JARRAFF TRIMMER CERTIFICATION (22 questions)
-- =============================================================================
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'jarraff' LIMIT 1;
  IF v_ct_id IS NULL THEN
    SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'jarraff-trimmer' LIMIT 1;
  END IF;
  IF v_ct_id IS NULL THEN
    RAISE NOTICE 'jarraff certification type not found, skipping';
    RETURN;
  END IF;

  -- Delete existing questions for this certification
  DELETE FROM public.certification_questions WHERE certification_type_id = v_ct_id;

  INSERT INTO public.certification_questions (
    certification_type_id, question_number, question_text, question_type, options, correct_answer, points, category, difficulty, is_active
  ) VALUES
    -- Q1: True/False
    (v_ct_id, 1, 'It is acceptable to operate a tree trimmer with the cab door open in some instances.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q2: Multiple choice
    (v_ct_id, 2, 'What is the correct distance to stay away from any ledges or drop offs while operating a tree trimmer?', 'multiple_choice',
     '{"A": "2 feet", "B": "4 feet", "C": "6 feet", "D": "8 feet"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q3: Multiple choice
    (v_ct_id, 3, 'What is the minimum approach distance with the tree trimmer saw blade?', 'multiple_choice',
     '{"A": "1.5 feet", "B": "2 feet", "C": "2.5 feet", "D": "3 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    -- Q4: True/False
    (v_ct_id, 4, 'It is never allowed for any other person(s) to ride in or on a tree trimmer other than the operator.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q5: Short answer (degree indicators)
    (v_ct_id, 5, 'Where are the degree indicators located on the tree trimmers?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'hardware', 'medium', true),
    
    -- Q6: Multiple choice
    (v_ct_id, 6, 'What is the maximum degree allowed to operate a tree trimmer on sideling ground?', 'multiple_choice',
     '{"A": "45 degrees", "B": "35 degrees", "C": "25 degrees", "D": "15 degrees"}'::jsonb, 'D', 1, 'operation', 'medium', true),
    
    -- Q7: Multiple choice
    (v_ct_id, 7, 'How often are you required to grease moving parts on the tree trimmer?', 'multiple_choice',
     '{"A": "Once a day", "B": "Once a week", "C": "Every 8 hours", "D": "Twice a day"}'::jsonb, 'C', 1, 'maintenance', 'medium', true),
    
    -- Q8: True/False
    (v_ct_id, 8, 'It is permitted to trim trees directly above the tree trimmer.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q9: True/False
    (v_ct_id, 9, 'It is acceptable to trim trees without a clear view of the drop zone.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q10: Multiple choice
    (v_ct_id, 10, 'Who is responsible for identifying potential hazards?', 'multiple_choice',
     '{"A": "Operator", "B": "Groundman", "C": "Pre-planner", "D": "Operator and Groundman"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q11: True/False
    (v_ct_id, 11, 'You have more control over a limb trimming with a sharp blade vs. A dull blade.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'maintenance', 'easy', true),
    
    -- Q12: Multiple choice
    (v_ct_id, 12, 'How often are you required to check the teeth on the saw blade?', 'multiple_choice',
     '{"A": "Everyday", "B": "Once a week", "C": "When installing a new blade", "D": "Once a month"}'::jsonb, 'A', 1, 'maintenance', 'easy', true),
    
    -- Q13: Multiple choice
    (v_ct_id, 13, 'What is the minimum distance you are required to keep from any marked hazards?', 'multiple_choice',
     '{"A": "6 feet", "B": "8 feet", "C": "10 feet", "D": "2 feet"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q14: True/False
    (v_ct_id, 14, 'You are required to let the saw blade completely stop spinning before you open the door and exit the cab.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q15: True/False
    (v_ct_id, 15, 'Your groundman must maintain in sight while operating the tree trimmer.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q16: Multiple choice
    (v_ct_id, 16, 'What is the correct distance for person(s) to maintain away from the tree trimmer while in operation?', 'multiple_choice',
     '{"A": "200 feet", "B": "300 feet", "C": "400 feet", "D": "500 feet"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q17: Multiple choice
    (v_ct_id, 17, 'What should you do if a person(s) enters the 300ft Buffer zone?', 'multiple_choice',
     '{"A": "Notify your groundman to ask them to leave", "B": "Continue trimming", "C": "Trim in the opposite direction", "D": "Stop immediately"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q18: Multiple choice
    (v_ct_id, 18, 'Who is responsible for filling out the daily job safety analysis?', 'multiple_choice',
     '{"A": "The groundman", "B": "The operator", "C": "The general foreman", "D": "Both the groundman and the operator"}'::jsonb, 'D', 1, 'documentation', 'easy', true),
    
    -- Q19: Multiple choice
    (v_ct_id, 19, 'How far are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "10 feet", "B": "1 span", "C": "2 spans", "D": "100 feet"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q20: Short answer (downed power line steps)
    (v_ct_id, 20, 'What are the steps you need to take if you find a downed power line? (List 4 steps)', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'hard', true),
    
    -- Q21: Multiple choice
    (v_ct_id, 21, 'What is the required buffer zone you must maintain around poles and Guy wires?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q22: Short answer (safety features)
    (v_ct_id, 22, 'List five safety features on the tree trimmer.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'hardware', 'hard', true);

  RAISE NOTICE 'Inserted 22 Jarraff questions';
END $$;

-- =============================================================================
-- SKID STEER CERTIFICATION (22 questions)
-- =============================================================================
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'skidsteer' LIMIT 1;
  IF v_ct_id IS NULL THEN
    SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'skid-steer' LIMIT 1;
  END IF;
  IF v_ct_id IS NULL THEN
    RAISE NOTICE 'skidsteer certification type not found, skipping';
    RETURN;
  END IF;

  -- Delete existing questions for this certification
  DELETE FROM public.certification_questions WHERE certification_type_id = v_ct_id;

  INSERT INTO public.certification_questions (
    certification_type_id, question_number, question_text, question_type, options, correct_answer, points, category, difficulty, is_active
  ) VALUES
    -- Q1: Multiple choice
    (v_ct_id, 1, 'What is the required buffer zone you must maintain around poles and Guy wires?', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q2: Multiple choice
    (v_ct_id, 2, 'How far are you required to stay away from downed power lines?', 'multiple_choice',
     '{"A": "10 feet", "B": "1 span", "C": "2 spans", "D": "100 feet"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q3: Multiple choice
    (v_ct_id, 3, 'What should you do if a person(s) enters the 300ft Buffer zone?', 'multiple_choice',
     '{"A": "Notify your groundman to ask them to leave", "B": "Continue mulching", "C": "Mulch in the opposite direction", "D": "Stop immediately"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q4: Multiple choice
    (v_ct_id, 4, 'What is the minimum distance you are required to keep from any marked hazards?', 'multiple_choice',
     '{"A": "6 feet", "B": "8 feet", "C": "10 feet", "D": "2 feet"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q5: Multiple choice
    (v_ct_id, 5, 'Who is responsible for identifying potential hazards?', 'multiple_choice',
     '{"A": "Operator", "B": "Groundman", "C": "Pre-planner", "D": "Operator and Groundman"}'::jsonb, 'D', 1, 'safety', 'easy', true),
    
    -- Q6: Multiple choice
    (v_ct_id, 6, 'How often are you required to grease moving parts on the skid steer?', 'multiple_choice',
     '{"A": "Once a day", "B": "Once a week", "C": "Every 8 hours", "D": "Twice a day"}'::jsonb, 'C', 1, 'maintenance', 'medium', true),
    
    -- Q7: Multiple choice
    (v_ct_id, 7, 'What is the correct distance to stay away from any ledges or drop offs while operating a skid steer?', 'multiple_choice',
     '{"A": "2 feet", "B": "4 feet", "C": "6 feet", "D": "8 feet"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q8: Short answer (downed power line steps)
    (v_ct_id, 8, 'What are the steps you need to take if you find a downed power line? (List 4 steps)', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'hard', true),
    
    -- Q9: Multiple choice
    (v_ct_id, 9, 'What is the maximum degree allowed to operate a skid steer on sideling ground?', 'multiple_choice',
     '{"A": "45 degrees", "B": "35 degrees", "C": "25 degrees", "D": "15 degrees"}'::jsonb, 'D', 1, 'operation', 'medium', true),
    
    -- Q10: Short answer (safety features)
    (v_ct_id, 10, 'List five safety features on the skid steer.', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'hardware', 'hard', true),
    
    -- Q11: True/False
    (v_ct_id, 11, 'It is never allowed for any other person(s) to ride in or on the skid steer other than the operator.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'safety', 'easy', true),
    
    -- Q12: Multiple choice
    (v_ct_id, 12, 'Who is responsible for filling out the daily job safety analysis?', 'multiple_choice',
     '{"A": "The groundman", "B": "The operator", "C": "The general foreman", "D": "Both the groundman and the operator"}'::jsonb, 'D', 1, 'documentation', 'easy', true),
    
    -- Q13: Multiple choice
    (v_ct_id, 13, 'When ascending or descending the skid steer how many points of contact should you maintain?', 'multiple_choice',
     '{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb, 'C', 1, 'safety', 'easy', true),
    
    -- Q14: Multiple choice
    (v_ct_id, 14, 'What is the maximum height you are allowed to carry a load while grappling brush?', 'multiple_choice',
     '{"A": "2 feet", "B": "3 feet", "C": "4 feet", "D": "5 feet"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    -- Q15: True/False
    (v_ct_id, 15, 'You are only required to wear the seat belt in a skid steer when you are on rough terrain.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'B', 1, 'safety', 'easy', true),
    
    -- Q16: Short answer (emergency hydraulic release)
    (v_ct_id, 16, 'Where is the emergency hydraulic release on the skid steer and what is it for?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'medium', true),
    
    -- Q17: Short answer (emergency exits)
    (v_ct_id, 17, 'Where are the two emergency exits located on the skid steer?', 'short_answer', '{}'::jsonb, 'MANUAL_GRADE', 1, 'emergency', 'medium', true),
    
    -- Q18: Multiple choice
    (v_ct_id, 18, 'What is the proper track tension play on the skid steer?', 'multiple_choice',
     '{"A": "2 ½ inches", "B": "½ to 1 inch", "C": "3 inches", "D": "5 inches"}'::jsonb, 'B', 1, 'maintenance', 'medium', true),
    
    -- Q19: Multiple choice
    (v_ct_id, 19, 'What turning maneuver should you use to prevent disturbing maintained ground such as a yard?', 'multiple_choice',
     '{"A": "2 pt turn", "B": "3 pt turn", "C": "4 pt turn", "D": "5 pt turn"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    -- Q20: Multiple choice
    (v_ct_id, 20, 'When mulching with the skid steer you must never raise the head above ____________.', 'multiple_choice',
     '{"A": "2 feet", "B": "3 feet", "C": "4 feet", "D": "5 feet"}'::jsonb, 'C', 1, 'safety', 'medium', true),
    
    -- Q21: Multiple choice
    (v_ct_id, 21, 'When going over a steep grade what approach should you take?', 'multiple_choice',
     '{"A": "Angling approach", "B": "Directly forward approach", "C": "Backwards approach", "D": "Whichever the terrain allows"}'::jsonb, 'B', 1, 'operation', 'medium', true),
    
    -- Q22: Multiple choice
    (v_ct_id, 22, 'What is a key sign that sprockets need to be replaced on the skid steer?', 'multiple_choice',
     '{"A": "When the paint wears off them", "B": "When the teeth begin to break off", "C": "When the teeth begin to wear in a saw shape pattern", "D": "When there are no more teeth left on the sprockets"}'::jsonb, 'C', 1, 'maintenance', 'hard', true);

  RAISE NOTICE 'Inserted 22 Skid Steer questions';
END $$;

-- =============================================================================
-- UPDATE QUESTION COUNTS
-- =============================================================================
UPDATE public.certification_types SET question_count = 37 WHERE slug = 'bucket-trimmer';
UPDATE public.certification_types SET question_count = 22 WHERE slug IN ('geoboy', 'geo-boy');
UPDATE public.certification_types SET question_count = 44 WHERE slug = 'groundsman';
UPDATE public.certification_types SET question_count = 22 WHERE slug IN ('jarraff', 'jarraff-trimmer');
UPDATE public.certification_types SET question_count = 22 WHERE slug IN ('skidsteer', 'skid-steer');

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'All certification questions seeded successfully';
  RAISE NOTICE 'Bucket Trimmer: 37 questions';
  RAISE NOTICE 'Geo-Boy: 22 questions';
  RAISE NOTICE 'Groundsman: 44 questions';
  RAISE NOTICE 'Jarraff: 22 questions';
  RAISE NOTICE 'Skid Steer: 22 questions';
  RAISE NOTICE 'Total: 147 questions';
  RAISE NOTICE '==============================================';
END $$;
