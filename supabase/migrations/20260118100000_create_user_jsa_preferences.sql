-- =============================================================================
-- Migration: User-Specific JSA Preferences & Templates
-- Description: Creates tables for storing user-specific form preferences,
--              contact templates, signatures, saved locations, and JSA templates
-- =============================================================================

-- 1. User Preferences (UI settings, feature flags)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- UI Preferences
  smart_defaults_expanded BOOLEAN DEFAULT true,
  auto_detect_location BOOLEAN DEFAULT true,
  auto_detect_weather BOOLEAN DEFAULT true,
  
  -- Form Behavior
  auto_save_enabled BOOLEAN DEFAULT true,
  auto_save_interval_seconds INTEGER DEFAULT 30,
  show_completion_celebrations BOOLEAN DEFAULT true,
  
  -- Accessibility
  large_touch_targets BOOLEAN DEFAULT false,
  high_contrast_mode BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Saved Contact Templates (per-user emergency contact sets)
CREATE TABLE IF NOT EXISTS public.user_contact_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  
  -- Contact fields (matching JSA form)
  oc_contact VARCHAR(255),
  doc_contact VARCHAR(255),
  gf_contact VARCHAR(255),
  safety_contact VARCHAR(255),
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, name)
);

-- 3. Saved Signatures (per-user digital signatures)
CREATE TABLE IF NOT EXISTS public.user_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Signature data (base64 encoded PNG or SVG path data)
  signature_data TEXT NOT NULL,
  signature_type VARCHAR(20) DEFAULT 'canvas' CHECK (signature_type IN ('canvas', 'typed')),
  
  -- Typed signature fallback
  typed_name VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. User Saved Locations (frequently used work sites)
CREATE TABLE IF NOT EXISTS public.user_saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  address VARCHAR(500) NOT NULL,
  
  -- GPS coordinates (optional)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Associated facility info (auto-fills on selection)
  nearest_hospital VARCHAR(255),
  nearest_clinic VARCHAR(255),
  circuit_number VARCHAR(100),
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, name)
);

-- 5. JSA Templates (per-user saved form templates)
CREATE TABLE IF NOT EXISTS public.user_jsa_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pre-filled form data (JSON structure matching DailyJsaFormState)
  template_data JSONB NOT NULL DEFAULT '{}',
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, name)
);

-- 6. User Hazard Presets (frequently used hazard descriptions for spans)
CREATE TABLE IF NOT EXISTS public.user_hazard_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  category VARCHAR(50) NOT NULL CHECK (category IN ('electrical', 'traffic', 'environmental', 'equipment', 'other')),
  label VARCHAR(100) NOT NULL,
  description TEXT,
  default_mitigation TEXT,
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, label)
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contact_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jsa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hazard_presets ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own contact templates"
  ON public.user_contact_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own signatures"
  ON public.user_signatures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved locations"
  ON public.user_saved_locations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own JSA templates"
  ON public.user_jsa_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own hazard presets"
  ON public.user_hazard_presets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_contact_templates_user_id 
  ON public.user_contact_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_user_contact_templates_default 
  ON public.user_contact_templates(user_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_user_saved_locations_user_id 
  ON public.user_saved_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_saved_locations_usage 
  ON public.user_saved_locations(user_id, use_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_jsa_templates_user_id 
  ON public.user_jsa_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_user_hazard_presets_user_category 
  ON public.user_hazard_presets(user_id, category);

-- =============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DO $$ 
BEGIN
  -- user_preferences
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
    CREATE TRIGGER update_user_preferences_updated_at
      BEFORE UPDATE ON public.user_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_contact_templates
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_contact_templates_updated_at') THEN
    CREATE TRIGGER update_user_contact_templates_updated_at
      BEFORE UPDATE ON public.user_contact_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_signatures
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_signatures_updated_at') THEN
    CREATE TRIGGER update_user_signatures_updated_at
      BEFORE UPDATE ON public.user_signatures
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_jsa_templates
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_jsa_templates_updated_at') THEN
    CREATE TRIGGER update_user_jsa_templates_updated_at
      BEFORE UPDATE ON public.user_jsa_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- FUNCTION: Ensure only one default contact template per user
-- =============================================================================

CREATE OR REPLACE FUNCTION ensure_single_default_contact_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_contact_templates
    SET is_default = false
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_contact ON public.user_contact_templates;
CREATE TRIGGER ensure_single_default_contact
  BEFORE INSERT OR UPDATE ON public.user_contact_templates
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_contact_template();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.user_preferences IS 'User-specific UI preferences and form settings';
COMMENT ON TABLE public.user_contact_templates IS 'Saved emergency contact sets for quick-fill in JSA forms';
COMMENT ON TABLE public.user_signatures IS 'Digital signatures saved for reuse across forms';
COMMENT ON TABLE public.user_saved_locations IS 'Frequently used work locations with associated facility info';
COMMENT ON TABLE public.user_jsa_templates IS 'Saved JSA form templates for common job types';
COMMENT ON TABLE public.user_hazard_presets IS 'User-defined hazard descriptions for span entries';
