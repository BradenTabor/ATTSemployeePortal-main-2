/*
  # Create Request Time Off (RTO) Requests Table

  1. New Tables
    - `rto_requests`
      - `id` (uuid, primary key) - Unique identifier for each request
      - `full_name` (text, required) - Employee's full name
      - `email` (text, required) - Employee's email address
      - `start_date` (date, required) - First day of time off
      - `end_date` (date, required) - Last day of time off
      - `reason` (text, required) - Reason for time off request
      - `notes` (text, optional) - Additional notes or details
      - `status` (text, default 'Pending') - Request status (Pending/Approved/Denied)
      - `submitted_at` (timestamptz, default now()) - Timestamp when request was submitted

  2. Indexes
    - Index on `submitted_at` for efficient sorting and filtering by submission date

  3. Security
    - Enable RLS on `rto_requests` table
    - Policy: Authenticated users can insert their own requests
    - Policy: Admin users can view all requests for approval/management

  4. Important Notes
    - Status field constrained to: 'Pending', 'Approved', 'Denied'
    - Defaults to 'Pending' for new submissions
    - Submitted timestamp auto-populated
    - All date fields use proper date types for validation
*/

-- Create the rto_requests table
CREATE TABLE IF NOT EXISTS public.rto_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  notes text,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Denied')),
  submitted_at timestamptz DEFAULT now()
);

-- Create index for efficient sorting by submission date
CREATE INDEX IF NOT EXISTS idx_rto_submitted_at ON public.rto_requests (submitted_at DESC);

-- Enable Row Level Security
ALTER TABLE rto_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert requests
CREATE POLICY "Authenticated users can insert time off requests"
  ON rto_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow authenticated users to view their own requests
CREATE POLICY "Users can view own requests"
  ON rto_requests
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- Policy: Allow admin users to view all requests
CREATE POLICY "Admins can view all requests"
  ON rto_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

-- Policy: Allow admin users to update request status
CREATE POLICY "Admins can update request status"
  ON rto_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'admin'
    )
  );
