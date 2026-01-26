/*
  ============================================================================
  SECURITY FIX: Server-Side File Upload Validation (SEC-003)
  ============================================================================
  
  MEDIUM PRIORITY SECURITY FIX: Add server-side validation for file uploads
  to prevent malicious file uploads even if client-side validation is bypassed.
  
  Problem:
  - Client-side validation can be bypassed
  - No server-side validation for file type and size
  - Malicious users could upload executable files, oversized files, or wrong file types
  
  Solution:
  - Create a trigger function that validates file uploads on storage.objects INSERT
  - Validates file type (MIME type) and file size
  - Rejects uploads that don't meet security requirements
  - Applies to all storage buckets used for user uploads
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: CREATE VALIDATION FUNCTION
-- ============================================================================
-- Function validates file type and size before allowing storage insert

CREATE OR REPLACE FUNCTION storage.validate_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket_id text;
  v_file_name text;
  v_file_size bigint;
  v_mime_type text;
  v_file_extension text;
  v_max_size_bytes bigint := 10 * 1024 * 1024; -- 10MB default
  v_allowed_types text[] := ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
BEGIN
  v_bucket_id := NEW.bucket_id;
  v_file_name := NEW.name;
  
  -- Extract metadata (may be null at INSERT time, but we check if present)
  v_file_size := (NEW.metadata->>'size')::bigint;
  v_mime_type := NEW.metadata->>'mimetype';
  
  -- Extract file extension from filename
  v_file_extension := lower(reverse(split_part(reverse(v_file_name), '.', 1)));
  
  -- Skip validation for service role (bypasses RLS)
  -- This allows admin operations and system uploads
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Validate file size (if metadata includes size at INSERT time)
  IF v_file_size IS NOT NULL AND v_file_size > v_max_size_bytes THEN
    RAISE EXCEPTION 'File size exceeds maximum allowed size of 10MB. File size: % bytes', v_file_size;
  END IF;
  
  -- Validate file type for image buckets
  IF v_bucket_id IN ('dvir-photos', 'equipment-inspection-photos', 'avatars') THEN
    -- Check MIME type
    IF v_mime_type IS NOT NULL AND NOT (v_mime_type = ANY(v_allowed_types)) THEN
      RAISE EXCEPTION 'Invalid file type: %. Allowed types: JPEG, PNG, WebP, GIF', v_mime_type;
    END IF;
    
    -- Check file extension as backup validation
    IF v_file_extension NOT IN ('jpg', 'jpeg', 'png', 'webp', 'gif') THEN
      RAISE EXCEPTION 'Invalid file extension: .%. Allowed extensions: .jpg, .jpeg, .png, .webp, .gif', v_file_extension;
    END IF;
  END IF;
  
  -- Additional validation: prevent executable files
  IF v_file_extension IN ('exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'app', 'deb', 'rpm', 'dmg', 'pkg') THEN
    RAISE EXCEPTION 'Executable files are not allowed. File extension: .%', v_file_extension;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'File upload validation failed: %', SQLERRM;
    -- Re-raise the exception to prevent the upload
    RAISE;
END;
$$;

COMMENT ON FUNCTION storage.validate_file_upload() IS 
  'Validates file uploads to storage buckets. Checks file type, size, and prevents executable files. SEC-003 security fix.';

-- ============================================================================
-- STEP 2: CREATE TRIGGER
-- ============================================================================
-- Trigger runs before INSERT on storage.objects to validate uploads

DROP TRIGGER IF EXISTS validate_file_upload_trigger ON storage.objects;

CREATE TRIGGER validate_file_upload_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.validate_file_upload();

COMMENT ON TRIGGER validate_file_upload_trigger ON storage.objects IS 
  'Validates file uploads before they are stored. SEC-003 security fix.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After migration, test:
-- 
-- 1. Valid image upload should succeed:
--    -- Upload JPEG/PNG/WebP/GIF under 10MB
--    -- Should succeed
--
-- 2. Invalid file type should fail:
--    -- Upload PDF, EXE, or other non-image file
--    -- Should fail with "Invalid file type" error
--
-- 3. Oversized file should fail:
--    -- Upload file larger than 10MB
--    -- Should fail with "File size exceeds maximum" error
--
-- 4. Executable file should fail:
--    -- Upload .exe, .bat, .js, etc.
--    -- Should fail with "Executable files are not allowed" error
--
-- 5. Service role should bypass validation:
--    -- Service role uploads should succeed regardless
--    -- (for admin operations and system uploads)

-- ============================================================================
-- NOTES
-- ============================================================================
-- - Validation applies to all storage buckets
-- - Service role bypasses validation (for admin/system operations)
-- - File size limit: 10MB (configurable in function)
-- - Allowed types: JPEG, PNG, WebP, GIF (for image buckets)
-- - Executable files are blocked for all buckets
-- - MIME type and file extension are both checked for defense in depth
