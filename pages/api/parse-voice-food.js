import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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

    // Need either a text transcript OR a base64 audio blob
    if ((!transcript || typeof transcript !== 'string') && !audio) {
      return res.status(400).json({ error: 'No transcript or audio provided' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let spokenText = transcript;

    // If audio was provided (e.g. from iOS WKWebView), transcribe it first.
    if (audio) {
      const transcribeResult = await model.generateContent([
        { text: 'Transcribe this audio to text. Return ONLY the transcription, no commentary.' },
        { inlineData: { data: audio, mimeType: mimeType || 'audio/webm' } },
      ]);
      spokenText = transcribeResult.response.text().trim();
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

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    let data;
    try {
      data = JSON.parse(cleanJson);
    } catch (parseError) {
      return res.status(500).json({ error: 'Could not parse food description. Please try again.' });
    }

    // Validate and sanitize
    data.cals = parseInt(data.cals, 10) || 0;
    data.p = parseInt(data.p, 10) || 0;
    data.c = parseInt(data.c, 10) || 0;
    data.f = parseInt(data.f, 10) || 0;
    data.meal_type = ['breakfast', 'lunch', 'dinner', 'snack'].includes(data.meal_type) ? data.meal_type : 'snack';

    if (!data.name) {
      return res.status(500).json({ error: 'Could not identify food from voice input.' });
    }

    // Include the transcript so the client can show what was heard
    data.transcript = spokenText;

    res.status(200).json(data);
  } catch (error) {
    if (error.message?.includes('quota') || error.message?.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'Rate limit reached. Please try again.' });
    }

    res.status(500).json({ error: 'Failed to parse food description. Please try again.' });
  }
}
