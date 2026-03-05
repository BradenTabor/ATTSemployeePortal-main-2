-- =============================================================================
-- Seed: Electrical Qualification (1910.269) written test and practical template
-- =============================================================================
-- Enables written test (30 questions from 35-question pool), 80% passing,
-- stratified categories. All questions multiple_choice or true_false (auto-graded).
-- Regulatory source: OSHA 29 CFR 1910.269(r), (a)(2)(ii), 1910.333(c)(3), ANSI Z133.
-- Question selection: CEIL per category then ORDER BY random() LIMIT 30 (which
-- category loses one question is random each attempt).
-- =============================================================================

-- Enable written test and practical eval; set passing score and stratified categories
UPDATE public.certification_types
SET
  has_written_test = true,
  has_practical_eval = true,
  passing_score = 80,
  question_count = 30,
  question_categories = '{"electrical_hazards": 0.35, "ppe_equipment": 0.20, "work_practices": 0.25, "equipment_safety": 0.20}'::jsonb
WHERE slug = 'electrical-qualification';

-- Practical evaluation template (3 categories)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'electrical-qualification' LIMIT 1;
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
      'pre_work_assessment',
      1,
      '[
        {"item_id": "p1", "item_name": "Voltage of lines determined or assumed at maximum before work"},
        {"item_id": "p2", "item_name": "Job briefing completed before starting"},
        {"item_id": "p3", "item_name": "PPE and insulating equipment inspected and correct for task"},
        {"item_id": "p4", "item_name": "Minimum approach distances identified for voltage present"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'field_operations',
      2,
      '[
        {"item_id": "f1", "item_name": "Body and equipment kept outside MAD from energized parts"},
        {"item_id": "f2", "item_name": "Insulating tools used for branches in contact or within MAD"},
        {"item_id": "f3", "item_name": "Second line-clearance trimmer within voice when required (>750V, roping, etc.)"},
        {"item_id": "f4", "item_name": "No work in adverse weather unless de-energized or storm-restoration trained"}
      ]'::jsonb,
      4
    ),
    (
      v_ct_id,
      'emergency_response',
      3,
      '[
        {"item_id": "e1", "item_name": "Downed line response: maintain distance, notify, no approach"},
        {"item_id": "e2", "item_name": "First aid and emergency procedures understood"},
        {"item_id": "e3", "item_name": "Unanticipated hazards reported to host/contract employer as required"}
      ]'::jsonb,
      3
    )
  ON CONFLICT (certification_type_id, category_name) DO NOTHING;
END $$;

-- Questions (35 total: 12 electrical_hazards, 7 ppe_equipment, 9 work_practices, 7 equipment_safety)
-- All multiple_choice or true_false. Values per OSHA 1910.269(r), (a)(2)(ii), 1910.333(c)(3).
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'electrical-qualification' LIMIT 1;
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
    -- electrical_hazards (1–12)
    (v_ct_id, 1, 'Before an employee climbs, enters, or works around any tree, what must be determined per 1910.269(r)(1)(i)?', 'multiple_choice',
     '{"A": "Only the species of tree", "B": "The nominal voltage of electric power lines posing a hazard, or all lines considered at maximum voltage", "C": "The age of the power lines", "D": "Whether the lines are insulated"}'::jsonb, 'B', 1, 'electrical_hazards', 'medium', true),
    (v_ct_id, 2, 'For unqualified employees (not line-clearance tree trimmers), the minimum approach distance from overhead power lines for systems 50 kV and below is:', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'electrical_hazards', 'medium', true),
    (v_ct_id, 3, 'Line-clearance tree trimmers must maintain minimum approach distances from energized conductors as given in OSHA Tables R-5, R-6, R-7, and R-8.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'electrical_hazards', 'easy', true),
    (v_ct_id, 4, 'A second line-clearance tree trimmer must be within normal voice communication when the trimmer will approach more closely than 10 feet to any conductor energized at more than:', 'multiple_choice',
     '{"A": "120 volts", "B": "480 volts", "C": "750 volts", "D": "5,000 volts"}'::jsonb, 'C', 1, 'electrical_hazards', 'medium', true),
    (v_ct_id, 5, 'OSHA recognizes three qualification levels for work near electric power lines. Which of the following is one of them?', 'multiple_choice',
     '{"A": "Apprentice", "B": "Line-clearance tree trimmer", "C": "Groundman only", "D": "Foreman"}'::jsonb, 'B', 1, 'electrical_hazards', 'easy', true),
    (v_ct_id, 6, 'For unqualified workers, minimum approach distances increase by how much for every 10 kV over 50 kV?', 'multiple_choice',
     '{"A": "2 inches", "B": "4 inches", "C": "6 inches", "D": "12 inches"}'::jsonb, 'B', 1, 'electrical_hazards', 'hard', true),
    (v_ct_id, 7, 'Paragraph 1910.269(r)(1) applies to line-clearance tree trimmers who are not qualified employees. It does not apply to 269-qualified employees.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'electrical_hazards', 'medium', true),
    (v_ct_id, 8, '269-qualified employees performing line-clearance tree trimming must follow:', 'multiple_choice',
     '{"A": "Only paragraph (r)(1)", "B": "All of 1910.269 except paragraph (r)(1)", "C": "Only 1910.333", "D": "No specific electrical requirements"}'::jsonb, 'B', 1, 'electrical_hazards', 'medium', true),
    (v_ct_id, 9, 'Line-clearance tree trimming is work that is near (within _____ of) energized power lines.', 'multiple_choice',
     '{"A": "5 feet", "B": "10 feet", "C": "15 feet", "D": "20 feet"}'::jsonb, 'B', 1, 'electrical_hazards', 'easy', true),
    (v_ct_id, 10, 'Ladders, platforms, and aerial devices may not be brought closer to an energized part than the distances in Tables R-5 through R-8.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'electrical_hazards', 'easy', true),
    (v_ct_id, 11, 'Who must determine the voltage of lines that may pose a hazard before work begins, or assume all lines operate at the highest voltage?', 'multiple_choice',
     '{"A": "Only the foreman", "B": "The utility host employer only", "C": "The line-clearance tree trimmer / employer", "D": "No one; voltage need not be determined"}'::jsonb, 'C', 1, 'electrical_hazards', 'medium', true),
    (v_ct_id, 12, 'Qualified employees under 1910.269(a)(2)(ii) must know the minimum approach distances for the maximum voltage within the area and the skills to maintain those distances.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'electrical_hazards', 'easy', true),

    -- ppe_equipment (13–19)
    (v_ct_id, 13, 'Branches that are in contact with exposed energized conductors or within the MAD may be removed only through the use of:', 'multiple_choice',
     '{"A": "Any hand tools", "B": "Insulating equipment", "C": "Metal saws only", "D": "Rope only"}'::jsonb, 'B', 1, 'ppe_equipment', 'medium', true),
    (v_ct_id, 14, 'A tool constructed of a material with insulating qualities per 1910.269(j)(1) is considered insulated under (r)(1)(iv) if the tool is:', 'multiple_choice',
     '{"A": "Clean and dry", "B": "New", "C": "Approved by the foreman", "D": "Made of wood only"}'::jsonb, 'A', 1, 'ppe_equipment', 'medium', true),
    (v_ct_id, 15, 'Climbing rope that is wet, contaminated so its insulating capacity is impaired, or otherwise not insulated for the voltage involved may not be used near exposed energized lines.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'ppe_equipment', 'easy', true),
    (v_ct_id, 16, 'Climbing ropes used by employees working aloft in trees must have a minimum diameter of:', 'multiple_choice',
     '{"A": "1/4 inch", "B": "3/8 inch", "C": "0.5 inch (12 mm)", "D": "5/8 inch"}'::jsonb, 'C', 1, 'ppe_equipment', 'medium', true),
    (v_ct_id, 17, 'Climbing ropes must have a minimum breaking strength of:', 'multiple_choice',
     '{"A": "1,500 pounds", "B": "2,300 pounds (10.2 kN)", "C": "3,000 pounds", "D": "4,000 pounds"}'::jsonb, 'B', 1, 'ppe_equipment', 'medium', true),
    (v_ct_id, 18, 'Synthetic climbing rope shall have elasticity of not more than 7 percent.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'ppe_equipment', 'medium', true),
    (v_ct_id, 19, 'Line-clearance tree trimmers must be provided with and properly wear approved PPE, including fall protection equipment, when needed.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'ppe_equipment', 'easy', true),

    -- work_practices (20–28)
    (v_ct_id, 20, 'Line-clearance tree trimming may not be performed when adverse weather conditions make the work hazardous despite the work practices required by the standard.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'easy', true),
    (v_ct_id, 21, 'Examples of adverse weather that are presumed to make line-clearance tree trimming too hazardous include:', 'multiple_choice',
     '{"A": "Only heavy rain", "B": "Thunderstorms in the immediate vicinity, high winds, snow storms, ice storms", "C": "Only fog", "D": "Only heat over 95°F"}'::jsonb, 'B', 1, 'work_practices', 'medium', true),
    (v_ct_id, 22, 'Employees performing line-clearance tree trimming in the aftermath of a storm or under similar emergency conditions must be trained in the special hazards related to this type of work.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'easy', true),
    (v_ct_id, 23, 'Line-clearance tree trimmers must be trained and certified in, and observed at least annually to be complying with, safety-related work practices and procedures including emergency procedures.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'easy', true),
    (v_ct_id, 24, 'A job briefing must be provided before starting a job or if expected conditions change.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'easy', true),
    (v_ct_id, 25, 'If lines and circuits in the area have been de-energized per 1910.269(m), line-clearance tree trimming may be performed in any type of weather.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'medium', true),
    (v_ct_id, 26, 'A second line-clearance tree trimmer must be within voice communication when roping is necessary to remove branches or limbs from conductors or apparatus energized at more than 750 volts.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'medium', true),
    (v_ct_id, 27, 'Qualified employees under 1910.269(a)(2)(ii) must be trained to recognize electrical hazards and the skills and techniques necessary to control or avoid those hazards.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'easy', true),
    (v_ct_id, 28, 'Until qualified employees have demonstrated proficiency in the work practices involved, they are considered to be in on-the-job training and must be under the direct supervision of a qualified employee.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'medium', true),
    (v_ct_id, 29, 'Line-clearance tree trimmers must follow the medical and first aid provisions of 1910.269(b).', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'work_practices', 'easy', true),

    -- equipment_safety (30–35)
    (v_ct_id, 30, 'Brush chippers must be equipped with a locking device in the ignition system.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'equipment_safety', 'easy', true),
    (v_ct_id, 31, 'Access panels for maintenance and adjustment of chipper blades and associated drive train must be in place and secure during operation.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'equipment_safety', 'easy', true),
    (v_ct_id, 32, 'Each power saw weighing more than 6.8 kg (15 pounds, service weight) that is used in trees must be supported by a separate line, except when work is from an aerial lift or during topping/removing with no supporting limb.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'equipment_safety', 'medium', true),
    (v_ct_id, 33, 'Each power saw must be equipped with a clutch adjusted so that the clutch will not engage the chain drive at idling speed.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'equipment_safety', 'medium', true),
    (v_ct_id, 34, 'A power saw may not be running when the saw is being carried up into a tree by an employee.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'equipment_safety', 'easy', true),
    (v_ct_id, 35, 'Each employee must be tied in with a climbing rope and safety saddle when working above the ground in a tree, unless he or she is ascending into the tree.', 'true_false',
     '{"A": "True", "B": "False"}'::jsonb, 'A', 1, 'equipment_safety', 'easy', true)
  ON CONFLICT (certification_type_id, question_number) DO NOTHING;
END $$;
