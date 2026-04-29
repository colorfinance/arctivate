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
    return res.status(500).json({ error: 'Voice food parser not configured. Please add GOOGLE_API_KEY.' });
  }

  try {
    const { transcript, audio, mimeType } = req.body;

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

    const prompt = `You are a nutrition expert and food logging assistant. Parse the following spoken food description into structured nutrition data. The user is describing what they ate.

VOICE INPUT: "${spokenText}"

PARSING RULES:
- Identify every food item mentioned
- Estimate reasonable calories and macros for each item based on typical serving sizes
- If quantity is mentioned (e.g., "two eggs", "a bowl of rice"), use that for estimation
- If no quantity is specified, assume one standard serving
- Common shortcuts: "chicken" = grilled chicken breast (~200g), "rice" = 1 cup cooked white rice
- Be generous but realistic with estimations
- Combine all items into a single meal entry with totals
- Try to detect meal type from context clues (time mentions, food types):
  - Breakfast foods (eggs, toast, cereal, oatmeal, coffee) -> "breakfast"
  - Lunch foods (sandwich, salad, soup) -> "lunch"
  - Dinner foods (steak, pasta, heavy meals) -> "dinner"
  - Otherwise -> "snack"

Return ONLY valid JSON in this exact format, no other text:
{"name": "Combined Food Name", "desc": "Brief description of all items", "cals": 500, "p": 30, "c": 50, "f": 15, "meal_type": "lunch", "items": ["item1", "item2"]}

Fields:
- "name": Concise combined name (e.g., "Chicken & Rice" or just the food if single item)
- "desc": What was described
- "cals": Total estimated calories as whole number
- "p": Total protein in grams as whole number
- "c": Total carbs in grams as whole number
- "f": Total fat in grams as whole number
- "meal_type": One of "breakfast", "lunch", "dinner", "snack"
- "items": Array of individual items parsed from the voice input`;

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
      console.error('Voice food JSON parse error:', parseError.message, 'Raw text:', text);
      return res.status(500).json({ error: 'Could not parse food description. Please try again.' });
    }

    data.cals = parseInt(data.cals, 10) || 0;
    data.p = parseInt(data.p, 10) || 0;
    data.c = parseInt(data.c, 10) || 0;
    data.f = parseInt(data.f, 10) || 0;
    data.meal_type = ['breakfast', 'lunch', 'dinner', 'snack'].includes(data.meal_type) ? data.meal_type : 'snack';

    if (!data.name) {
      return res.status(500).json({ error: 'Could not identify food from voice input.' });
    }

    data.transcript = spokenText;

    res.status(200).json(data);
  } catch (error) {
    logUpstreamError('Voice food API Error', error);

    const msg = error?.message || '';
    const status = error?.status ?? error?.response?.status;

    if (status === 401 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
      return res.status(500).json({ error: 'AI service rejected the API key (403). Verify GOOGLE_API_KEY in Vercel and that the Generative Language API is enabled.' });
    }

    if (status === 429 || msg.includes('quota') || msg.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'Rate limit reached. Please try again.' });
    }

    res.status(500).json({ error: 'Failed to parse food description. Please try again.' });
  }
}
