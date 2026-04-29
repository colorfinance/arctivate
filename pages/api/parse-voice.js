import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Voice parser not configured. Please add GOOGLE_API_KEY.' });
  }

  try {
    const { transcript, audio, mimeType, exercises } = req.body;

    if ((!transcript || typeof transcript !== 'string') && !audio) {
      return res.status(400).json({ error: 'No transcript or audio provided' });
    }

    const ai = new GoogleGenAI({ apiKey });

    let spokenText = transcript;

    if (audio) {
      const transcribeResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Transcribe this audio to text. Return ONLY the transcription, no commentary.' },
              { inlineData: { data: audio, mimeType: mimeType || 'audio/webm' } },
            ],
          },
        ],
      });
      spokenText = (transcribeResult.text || '').trim();
    }

    if (!spokenText) {
      return res.status(400).json({ error: 'Could not transcribe audio.' });
    }

    const exerciseList = (exercises || []).map(e => `"${e.name}" (${e.metric_type})`).join(', ');

    const prompt = `You are a gym workout voice command parser. Parse the following spoken workout entry into structured data.

AVAILABLE EXERCISES IN USER'S LIST:
${exerciseList || 'No exercises loaded yet'}

VOICE INPUT: "${spokenText}"

PARSING RULES:
- "plates" or "plate" = 20kg each (standard Olympic plate). "Two plates" = 2x20kg per side = 80kg + 20kg bar = 100kg total.
- "a ten" / "a five" / "a 2.5" = additional plate weight per side, doubled for total.
- Bar weight = 20kg (standard Olympic barbell) unless user says "dumbbell" or "DB".
- For dumbbells, the weight mentioned is per hand, report per-hand weight.
- Common slang: "225" = 225lbs (convert to kg by dividing by 2.205 if needed, or keep as-is since user may use lbs), "135" = 135lbs.
- "for X" = X reps (e.g., "225 for 8" = 225 weight, 8 reps).
- "at X RPE" or "RPE X" = Rate of Perceived Exertion (1-10 scale).
- "X sets" or "X sets of Y" = sets and reps.
- Match exercise name to the closest available exercise if possible.
- If no exercise match found, suggest the exercise name from the voice input.

Return ONLY valid JSON in this exact format:
{"exercise": "Exercise Name", "weight": 100, "reps": 8, "sets": 3, "rpe": null, "matched": true, "notes": ""}

Fields:
- "exercise": Best matching exercise name from user's list, or parsed name if no match
- "weight": Total weight in kg as a number (null if not mentioned)
- "reps": Rep count as a number (null if not mentioned)
- "sets": Number of sets (null if not mentioned, default to 1 if only reps given)
- "rpe": RPE value 1-10 (null if not mentioned)
- "matched": true if exercise matched user's list, false if new
- "notes": Any additional context or parsing notes`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = result.text || '';

    let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    let data;
    try {
      data = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Voice workout JSON parse error:', parseError.message, 'Raw text:', text);
      return res.status(500).json({ error: 'Could not parse voice command. Please try again.' });
    }

    data.weight = data.weight ? parseFloat(data.weight) : null;
    data.reps = data.reps ? parseInt(data.reps, 10) : null;
    data.sets = data.sets ? parseInt(data.sets, 10) : null;
    data.rpe = data.rpe ? Math.min(10, Math.max(1, parseInt(data.rpe, 10))) : null;
    data.matched = !!data.matched;
    data.transcript = spokenText;

    res.status(200).json(data);
  } catch (error) {
    logUpstreamError('Voice workout API Error', error);

    const msg = error?.message || '';
    const status = error?.status ?? error?.response?.status;

    if (status === 401 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
      return res.status(500).json({ error: 'AI service rejected the API key (403). Verify GOOGLE_API_KEY in Vercel and that the Generative Language API is enabled.' });
    }

    if (status === 429 || msg.includes('quota') || msg.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'Rate limit reached. Please try again.' });
    }

    res.status(500).json({ error: 'Failed to parse voice command. Please try again.' });
  }
}
