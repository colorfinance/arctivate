import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Admin-only endpoint: turns a photo of a written/whiteboard workout into a
// structured Workout-of-the-Day (title + prescribed movements) using Gemini.
// Mirrors pages/api/analyze.js, but verifies the caller is an admin first.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

function logUpstreamError(label, error) {
  const status = error?.status ?? error?.response?.status;
  const body = error?.response?.data ?? error?.body ?? error?.error;
  console.error(`${label}:`, {
    message: error?.message,
    status,
    body,
    name: error?.name,
  });
}

const VALID_METRICS = ['weight', 'time', 'reps', 'distance'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Workout scanner not configured. Please add GOOGLE_API_KEY to environment variables.' });
  }

  // --- Verify the caller is an authenticated admin --------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured for admin actions.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .single();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
  } catch (err) {
    console.error('Admin verification error:', err);
    return res.status(500).json({ error: 'Could not verify admin access' });
  }

  // --- Parse the image ------------------------------------------------------
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'No image provided' });
    }
    if (!image.includes(',') || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const base64Data = image.split(',')[1];
    const mimeMatch = image.match(/^data:(image\/[a-z+]+);base64,/);
    if (!base64Data || !mimeMatch) {
      return res.status(400).json({ error: 'Could not parse image data' });
    }
    const mimeType = mimeMatch[1];

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a strength & conditioning coach. The image shows a workout written on a whiteboard, paper, or screen. Extract the workout into structured data.

Return ONLY valid JSON in this exact format, no other text:
{"title": "Workout Name", "description": "Short summary or scheme (e.g. AMRAP 20, For Time)", "exercises": [{"name": "Back Squat", "metric_type": "weight", "sets": 5, "reps": 5, "target": 100, "notes": "tempo 3-1-1"}]}

Rules:
- "title" is a short name for the session. If none is written, infer one (e.g. "Leg Day").
- "description" captures the overall scheme/notes, or "" if none.
- "exercises" is an ordered array of every movement listed.
- "metric_type" MUST be one of: "weight" (lifts in kg), "time" (e.g. runs/holds in minutes), "reps" (bodyweight rep targets), "distance" (e.g. metres/km). Choose the best fit.
- "sets" and "reps" are whole numbers, or null if not specified.
- "target" is the prescribed load/time/distance as a number, or null if not specified (e.g. squat at 100kg -> 100; 5km run -> 5).
- "notes" is any per-exercise note (tempo, rest, RPE), or "" if none.
- If you cannot read any workout, return: {"title": "Unknown", "description": "Could not read workout", "exercises": []}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } },
          ],
        },
      ],
    });

    const text = result.text || '';

    let cleanJson = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];

    let data;
    try {
      data = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message, 'Raw text:', text);
      return res.status(500).json({ error: 'Failed to read the workout. Please try a clearer photo.' });
    }

    if (!data || !Array.isArray(data.exercises)) {
      console.error('Invalid response structure:', data);
      return res.status(500).json({ error: 'Invalid workout response. Please try again.' });
    }

    // Normalise / sanitise the AI output before returning it to the client.
    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const clean = {
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Workout of the Day',
      description: typeof data.description === 'string' ? data.description.trim() : '',
      exercises: data.exercises
        .filter((ex) => ex && typeof ex.name === 'string' && ex.name.trim())
        .slice(0, 30)
        .map((ex) => ({
          name: ex.name.trim().slice(0, 120),
          metric_type: VALID_METRICS.includes(ex.metric_type) ? ex.metric_type : 'weight',
          sets: toNum(ex.sets),
          reps: toNum(ex.reps),
          target: toNum(ex.target),
          notes: typeof ex.notes === 'string' ? ex.notes.trim().slice(0, 240) : '',
        })),
    };

    return res.status(200).json(clean);
  } catch (error) {
    logUpstreamError('Gemini API Error', error);

    const msg = error?.message || '';
    const status = error?.status ?? error?.response?.status;

    if (status === 401 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('PERMISSION_DENIED')) {
      return res.status(500).json({ error: 'AI service rejected the API key (403). Verify GOOGLE_API_KEY and that the Generative Language API is enabled.' });
    }
    if (status === 429 || msg.includes('quota') || msg.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'API rate limit reached. Please try again in a moment.' });
    }
    if (status === 404 || msg.includes('not found')) {
      return res.status(500).json({ error: 'Gemini model not available. Please try again.' });
    }
    if (msg.includes('SAFETY')) {
      return res.status(400).json({ error: 'Image could not be processed. Please try a different photo.' });
    }

    return res.status(500).json({ error: 'Failed to read the workout. Please try again.' });
  }
}
