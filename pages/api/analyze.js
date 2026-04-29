import { GoogleGenAI } from "@google/genai";

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Food scanner not configured. Please add GOOGLE_API_KEY to environment variables.' });
  }

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

    const prompt = `You are a nutrition expert. Identify the food in this image. Estimate the calories and macronutrients (protein, carbs, fat in grams) for the serving size shown.

Return ONLY valid JSON in this exact format, no other text:
{"name": "Food Name", "desc": "Short description of the dish", "cals": 350, "p": 25, "c": 40, "f": 12}

Rules:
- "name" should be a clear, concise food name
- "desc" should describe what you see (e.g. "Grilled chicken breast with rice")
- "cals" is total calories as a whole number
- "p" is protein in grams as a whole number
- "c" is carbs in grams as a whole number
- "f" is fat in grams as a whole number
- If you cannot identify food, use: {"name": "Unknown", "desc": "Could not identify food", "cals": 0, "p": 0, "c": 0, "f": 0}`;

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
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    let data;
    try {
      data = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message, 'Raw text:', text);
      return res.status(500).json({ error: 'Failed to parse food analysis. Please try again.' });
    }

    if (!data.name || data.cals === undefined) {
      console.error('Invalid response structure:', data);
      return res.status(500).json({ error: 'Invalid food analysis response. Please try again.' });
    }

    data.cals = parseInt(data.cals, 10) || 0;
    data.p = parseInt(data.p, 10) || 0;
    data.c = parseInt(data.c, 10) || 0;
    data.f = parseInt(data.f, 10) || 0;

    res.status(200).json(data);
  } catch (error) {
    logUpstreamError('Gemini API Error', error);

    const msg = error?.message || '';
    const status = error?.status ?? error?.response?.status;

    if (status === 401 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('PERMISSION_DENIED')) {
      return res.status(500).json({ error: 'AI service rejected the API key (403). Verify GOOGLE_API_KEY in Vercel and that the Generative Language API is enabled.' });
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

    res.status(500).json({ error: 'Failed to analyze food. Please try again.' });
  }
}
