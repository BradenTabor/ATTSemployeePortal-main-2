-- =============================================================================
-- Seed: Bucket Trimmer certification type, template, sample questions
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
  'Bucket Trimmer',
  'bucket-trimmer',
  'Certification for operating bucket trucks and trimmer equipment.',
  'equipment',
  80,
  12,
  true,
  true,
  37,
  '{"hardware": 0.27, "knots": 0.27, "observation": 0.32}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Practical evaluation template (Bucket Trimmer)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'bucket-trimmer' LIMIT 1;
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
      'hardware_identification',
      1,
      '[
        {"item_id": "hw1", "item_name": "Boom"},
        {"item_id": "hw2", "item_name": "Bucket"},
        {"item_id": "hw3", "item_name": "Upper Controls"},
        {"item_id": "hw4", "item_name": "Lower Controls"},
        {"item_id": "hw5", "item_name": "Outriggers"},
        {"item_id": "hw6", "item_name": "Hydraulic System"},
        {"item_id": "hw7", "item_name": "Insulated Section"},
        {"item_id": "hw8", "item_name": "Load Chart"},
        {"item_id": "hw9", "item_name": "Emergency Descent"},
        {"item_id": "hw10", "item_name": "Safety Harness Points"}
      ]'::jsonb,
      10
    ),
    (
      v_ct_id,
      'knots_and_rigging',
      2,
      '[
        {"item_id": "k1", "item_name": "Bowline"},
        {"item_id": "k2", "item_name": "Clove Hitch"},
        {"item_id": "k3", "item_name": "Half Hitch"},
        {"item_id": "k4", "item_name": "Running Bowline"},
        {"item_id": "k5", "item_name": "Timber Hitch"},
        {"item_id": "k6", "item_name": "Double Sheet Bend"},
        {"item_id": "k7", "item_name": "Figure Eight"},
        {"item_id": "k8", "item_name": "Square Lashing"},
        {"item_id": "k9", "item_name": "Tag Line Attachment"},
        {"item_id": "k10", "item_name": "Sling Inspection"}
      ]'::jsonb,
      10
    ),
    (
      v_ct_id,
      'trimmer_observation',
      3,
      '[
        {"item_id": "o1", "item_name": "Proper PPE"},
        {"item_id": "o2", "item_name": "Safe Work Zone"},
        {"item_id": "o3", "item_name": "Line Clearance"},
        {"item_id": "o4", "item_name": "Communication"},
        {"item_id": "o5", "item_name": "Emergency Procedures"},
        {"item_id": "o6", "item_name": "Pre-Use Inspection"},
        {"item_id": "o7", "item_name": "Load Handling"},
        {"item_id": "o8", "item_name": "Environmental Awareness"},
        {"item_id": "o9", "item_name": "Traffic Control"},
        {"item_id": "o10", "item_name": "Equipment Shutdown"},
        {"item_id": "o11", "item_name": "Documentation"},
        {"item_id": "o12", "item_name": "Housekeeping"}
      ]'::jsonb,
      12
    )
  ON CONFLICT (certification_type_id, category_name) DO NOTHING;
END $$;

-- Sample questions (5)
DO $$
DECLARE
  v_ct_id UUID;
BEGIN
  SELECT id INTO v_ct_id FROM public.certification_types WHERE slug = 'bucket-trimmer' LIMIT 1;
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
    (
      v_ct_id,
      1,
      'What is the main lifting arm of a bucket truck called?',
      'multiple_choice',
      '{"A": "Jib", "B": "Boom", "C": "Bucket", "D": "Turret"}'::jsonb,
      'B',
      1,
      'hardware',
      'easy',
      true
    ),
    (
      v_ct_id,
      2,
      'The bucket is typically rated for two workers.',
      'true_false',
      '{"A": "True", "B": "False"}'::jsonb,
      'B',
      1,
      'hardware',
      'easy',
      true
    ),
    (
      v_ct_id,
      3,
      'Which knot is commonly used to form a fixed loop at the end of a rope?',
      'multiple_choice',
      '{"A": "Clove hitch", "B": "Bowline", "C": "Half hitch", "D": "Timber hitch"}'::jsonb,
      'B',
      1,
      'knots',
      'easy',
      true
    ),
    (
      v_ct_id,
      4,
      'Proper PPE for bucket work includes a full-body harness and hard hat.',
      'true_false',
      '{"A": "True", "B": "False"}'::jsonb,
      'A',
      1,
      'observation',
      'easy',
      true
    ),
    (
      v_ct_id,
      5,
      'Before ascending, the operator should perform a pre-use inspection.',
      'true_false',
      '{"A": "True", "B": "False"}'::jsonb,
      'A',
      1,
      'observation',
      'easy',
      true
    )
  ON CONFLICT (certification_type_id, question_number) DO NOTHING;
END $$;
