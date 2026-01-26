-- =============================================================================
-- Fix: Set question_categories to NULL so all questions are returned
-- The previous category-based sampling was causing only a few questions to show
-- =============================================================================

-- Set question_categories to NULL for all certifications
-- This makes get_certification_test_questions return ALL questions up to question_count
UPDATE public.certification_types 
SET question_categories = NULL
WHERE slug IN ('bucket-trimmer', 'geoboy', 'geo-boy', 'groundsman', 'jarraff', 'jarraff-trimmer', 'skidsteer', 'skid-steer');

-- Verify the question counts match what we expect
DO $$
DECLARE
  v_rec RECORD;
  v_actual_count INTEGER;
BEGIN
  FOR v_rec IN 
    SELECT ct.id, ct.slug, ct.name, ct.question_count
    FROM public.certification_types ct
    WHERE ct.slug IN ('bucket-trimmer', 'geoboy', 'geo-boy', 'groundsman', 'jarraff', 'jarraff-trimmer', 'skidsteer', 'skid-steer')
  LOOP
    SELECT COUNT(*) INTO v_actual_count
    FROM public.certification_questions cq
    WHERE cq.certification_type_id = v_rec.id AND cq.is_active = true;
    
    RAISE NOTICE 'Certification: % | Expected: % | Actual questions: %', 
      v_rec.name, v_rec.question_count, v_actual_count;
  END LOOP;
END $$;
