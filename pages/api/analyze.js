import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

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

    // Validate base64 image format
    if (!image.includes(',') || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    // Extract base64 part
    const base64Data = image.split(',')[1];
    const mimeMatch = image.match(/^data:(image\/[a-z+]+);base64,/);

    if (!base64Data || !mimeMatch) {
      return res.status(400).json({ error: 'Could not parse image data' });
    }

    const mimeType = mimeMatch[1];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    // Clean up potential markdown formatting
    let cleanJson = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Try to extract JSON if there's extra text
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    // Parse and validate JSON
    let data;
    try {
      data = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message, 'Raw text:', text);
      return res.status(500).json({ error: 'Failed to parse food analysis. Please try again.' });
    }

    // Validate required fields
    if (!data.name || data.cals === undefined) {
      console.error('Invalid response structure:', data);
      return res.status(500).json({ error: 'Invalid food analysis response. Please try again.' });
    }

    // Ensure numeric values
    data.cals = parseInt(data.cals, 10) || 0;
    data.p = parseInt(data.p, 10) || 0;
    data.c = parseInt(data.c, 10) || 0;
    data.f = parseInt(data.f, 10) || 0;

    res.status(200).json(data);
  } catch (error) {
    console.error('Gemini API Error:', error.message || error);

    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
      return res.status(500).json({ error: 'Invalid API key. Please check your GOOGLE_API_KEY.' });
    }

    if (error.message?.includes('quota') || error.message?.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'API rate limit reached. Please try again in a moment.' });
    }

    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return res.status(500).json({ error: 'Gemini model not available. Please try again.' });
    }

    if (error.message?.includes('SAFETY')) {
      return res.status(400).json({ error: 'Image could not be processed. Please try a different photo.' });
    }

    res.status(500).json({ error: 'Failed to analyze food. Please try again.' });
  }
}
