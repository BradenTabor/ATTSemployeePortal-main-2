/*
  # Enable Realtime for Announcements

  1. Changes
    - Enable realtime replication for announcements table
    - Allows frontend to subscribe to live updates

  2. Features
    - Live updates when new announcements are inserted
    - Automatic UI refresh without manual page reload
    - Real-time collaboration experience

  3. Important Notes
    - Realtime works with RLS policies
    - Clients can only see what RLS allows
    - Efficient for instant notifications
*/

-- Enable realtime for announcements table
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
