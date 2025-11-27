import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      const lastSyncedAt = announcements && announcements.length > 0
        ? announcements.reduce((latest: string | null, item: any) => {
            if (!item.synced_at) return latest;
            if (!latest) return item.synced_at;
            return new Date(item.synced_at) > new Date(latest) ? item.synced_at : latest;
          }, null)
        : null;

      return new Response(
        JSON.stringify({
          announcements: announcements || [],
          last_synced_at: lastSyncedAt
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== 'Bearer atts_announce_98xzPQ!') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const raw = await req.json();

      if (raw.manualRefresh === true) {
        return new Response(
          JSON.stringify({
            status: 'success',
            message: 'Manual refresh triggered. Please contact admin to sync Make.com data.'
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const incoming = Array.isArray(raw) ? raw : raw.announcements;
      if (!Array.isArray(incoming)) {
        return new Response(
          JSON.stringify({ error: 'Invalid request format' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const normalized = incoming.map((it: any) => {
        if (it && (it.title || it.message || it.category || it.date)) {
          return {
            title: String(it.title ?? ''),
            message: String(it.message ?? ''),
            category: String(it.category ?? ''),
            date: String(it.date ?? '')
          };
        }
        return {
          title: String(it?.['0'] ?? ''),
          message: String(it?.['1'] ?? ''),
          category: String(it?.['2'] ?? ''),
          date: String(it?.['3'] ?? '')
        };
      });

      const cleaned = normalized.filter(row =>
        row.title && row.title.toLowerCase() !== 'title' &&
        row.message && row.message.toLowerCase() !== 'message'
      );

      const syncTimestamp = new Date().toISOString();
      const rows = cleaned.map(a => ({
        title: a.title,
        date: a.date || new Date().toISOString().split('T')[0],
        content: a.message,
        raw_data: { title: a.title, message: a.message, category: a.category, date: a.date },
        synced_at: syncTimestamp,
      }));

      await supabase.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const { error: insertError } = await supabase
        .from('announcements')
        .insert(rows);

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      await supabase
        .from('announcement_metadata')
        .update({
          last_sync: syncTimestamp,
          total_count: rows.length,
          updated_at: syncTimestamp
        })
        .eq('id', (await supabase.from('announcement_metadata').select('id').single()).data?.id);

      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'Announcements updated successfully',
          count: rows.length,
          synced_at: syncTimestamp
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ status: 'error', message: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in announcements function:', error);
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
