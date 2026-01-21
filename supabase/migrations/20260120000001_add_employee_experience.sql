-- =============================================================================
-- Migration: Add Employee Experience Tracking
-- Description: Adds hire_date and experience_level columns to app_users table
--              for Safety Forecast risk scoring based on crew composition
-- =============================================================================

-- Add experience tracking columns
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS experience_level TEXT 
  CHECK (experience_level IN ('apprentice', 'journeyman', 'expert'));

-- Data quality constraint: hire_date must be set if experience data is present
-- Note: We allow hire_date without experience_level (will be auto-calculated)
-- but experience_level requires hire_date for validation
ALTER TABLE public.app_users
ADD CONSTRAINT check_experience_data_quality 
CHECK (
  (hire_date IS NULL AND experience_level IS NULL) OR
  (hire_date IS NOT NULL)
);

-- Performance indexes for tenure queries and risk calculations
CREATE INDEX IF NOT EXISTS idx_app_users_hire_date ON app_users(hire_date);
CREATE INDEX IF NOT EXISTS idx_app_users_experience_level ON app_users(experience_level);

-- Composite index for common query pattern: find new hires by role
CREATE INDEX IF NOT EXISTS idx_app_users_role_hire_date 
  ON app_users(role, hire_date) 
  WHERE hire_date IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.app_users.hire_date IS 'Employee start date, used for tenure calculation and new hire risk scoring';
COMMENT ON COLUMN public.app_users.experience_level IS 'Skill level: apprentice (<1yr), journeyman (1-5yr), expert (5+yr). Used for crew composition risk scoring.';
