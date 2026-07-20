import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Member endpoint: turns a photo of a written/whiteboard workout into a
// PERSONAL workout loaded onto the caller's account (owner_id = caller), which
// they then log against in Train — reusing the daily_workouts machinery.

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

const VALID_METRICS = ['weight', 'time', 'reps', 'distance', 'distance_m'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Workout scanner not configured.' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured.' });
  }

  // --- Authenticate the caller (any logged-in member) -----------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  let userId;
  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });
    userId = userData.user.id;
  } catch {
    return res.status(500).json({ error: 'Could not verify session' });
  }

  // --- Parse the image ------------------------------------------------------
  let clean;
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') return res.status(400).json({ error: 'No image provided' });
    if (!image.includes(',') || !image.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image format' });

    const base64Data = image.split(',')[1];
    const mimeMatch = image.match(/^data:(image\/[a-z+]+);base64,/);
    if (!base64Data || !mimeMatch) return res.status(400).json({ error: 'Could not parse image data' });
    const mimeType = mimeMatch[1];

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a strength & conditioning coach with excellent OCR skills. The image shows a workout written or printed on a whiteboard, paper, sign, or screen. Read EVERY line and extract the full workout.

Return ONLY valid JSON in this exact format, no other text:
{"title": "Workout Name", "description": "Short summary or scheme (e.g. AMRAP 20, For Time)", "exercises": [{"name": "Back Squat", "metric_type": "weight", "sets": 5, "reps": 5, "target": 100, "notes": "tempo 3-1-1"}]}

Rules:
- Read the whole image carefully. Extract EVERY distinct movement as its own entry in "exercises", in the order listed.
- Do your best even if text is messy, angled, or low contrast.
- "title" is a short name for the session. If none is written, infer one from the movements.
- "description" captures the overall scheme/notes (rounds, time cap, etc.), or "".
- "metric_type" MUST be one of: "weight" (lifts in kg/lb), "time" (holds/cardio in minutes), "reps" (bodyweight rep targets OR calorie targets on ergs), "distance_m" (distance in METRES — rower/bike/ski-erg and short runs, e.g. "500m row"), "distance" (distance in KILOMETRES, e.g. "5km run"). Choose the best fit.
- For erg machines (row, bike, ski-erg): use "distance_m" for metres, "reps" for calories, "time" for a duration.
- "sets" and "reps" are whole numbers, or null if not specified.
- "target" is the prescribed load/time/distance as a number, or null (e.g. squat 100kg -> 100; 500m row -> 500; 5km run -> 5).
- "notes" is any per-exercise note, or "".
- Only return an empty "exercises" array if the image genuinely contains no workout at all.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }] }],
      config: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = result.text || '';
    if (!text.trim()) {
      return res.status(500).json({ error: 'The AI returned an empty result. Please try a clearer, well-lit photo.' });
    }

    let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];

    let data;
    try {
      data = JSON.parse(cleanJson);
    } catch {
      return res.status(500).json({ error: 'Failed to read the workout. Please try a clearer photo.' });
    }
    if (!data || !Array.isArray(data.exercises)) {
      return res.status(500).json({ error: 'Invalid workout response. Please try again.' });
    }

    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    clean = {
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 120) : 'My Workout',
      description: typeof data.description === 'string' ? data.description.trim().slice(0, 240) : '',
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
  } catch (err) {
    console.error('scan-my-workout parse error:', err?.message);
    return res.status(500).json({ error: 'Could not read the workout. Please try again.' });
  }

  if (clean.exercises.length === 0) {
    return res.status(400).json({ error: "Couldn't find a workout in that photo. Try a clearer, well-lit shot." });
  }

  // --- Persist as a personal workout for today ------------------------------
  try {
    const tzToday = new Date().toISOString().slice(0, 10);
    const { data: workout, error: wErr } = await supabaseAdmin
      .from('daily_workouts')
      .insert({
        title: clean.title,
        description: clean.description,
        workout_date: tzToday,
        source: 'photo',
        is_published: true,
        owner_id: userId,
        created_by: userId,
      })
      .select()
      .single();
    if (wErr) throw wErr;

    const rows = clean.exercises.map((ex, i) => ({
      daily_workout_id: workout.id,
      name: ex.name,
      metric_type: ex.metric_type,
      target_sets: ex.sets,
      target_reps: ex.reps,
      target_value: ex.target,
      notes: ex.notes || null,
      position: i,
    }));
    const { data: exs, error: eErr } = await supabaseAdmin
      .from('daily_workout_exercises')
      .insert(rows)
      .select();
    if (eErr) throw eErr;

    return res.status(200).json({ workout: { ...workout, exercises: exs || [] } });
  } catch (err) {
    console.error('scan-my-workout save error:', err?.message);
    return res.status(500).json({ error: 'Read the workout but failed to save it. Please try again.' });
  }
}
