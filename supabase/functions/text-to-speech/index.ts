// @ts-nocheck
/**
 * Supabase Edge Function: Text-to-Speech via OpenAI TTS API
 *
 * Accepts announcement text and returns natural-sounding MP3 audio.
 * Used by the Safety Briefing "Listen" button.
 *
 * ## Authentication
 * Requires a valid user JWT (any authenticated employee).
 *
 * ## Deploy
 * supabase functions deploy text-to-speech
 *
 * ## Secrets (already set for other functions)
 * OPENAI_API_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { text, voice } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmed = text.slice(0, 4096);

    const ttsVoice = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)
      ? voice
      : 'nova';

    console.log(`[TTS] Generating audio: ${trimmed.length} chars, voice=${ttsVoice}`);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: trimmed,
        voice: ttsVoice,
        response_format: 'mp3',
        speed: 0.95,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[TTS] OpenAI error:', response.status, errorBody);
      return new Response(JSON.stringify({ error: 'TTS generation failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[TTS] Generated ${audioBuffer.byteLength} bytes of audio`);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[TTS] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
