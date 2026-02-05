import { GoogleGenerativeAI } from "@google/generative-ai";

// Validate environment variable
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

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

  // Check if API is configured
  if (!genAI) {
    return res.status(500).json({ error: 'Food analysis service not configured' });
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Identify the food in this image. Estimate the calories and macros (protein, carbs, fat) for the serving size shown. Return ONLY valid JSON in this format: { "name": "Food Name", "desc": "Short description", "cals": 0, "p": 0, "c": 0, "f": 0 }. Do not include markdown formatting or backticks. If you cannot identify food in the image, return: { "name": "Unknown", "desc": "Could not identify food", "cals": 0, "p": 0, "c": 0, "f": 0 }`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
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
      console.error('JSON parse error:', parseError, 'Raw text:', text);
      return res.status(500).json({ error: 'Failed to parse food analysis response' });
    }

    // Validate required fields
    if (!data.name || data.cals === undefined) {
      console.error('Invalid response structure:', data);
      return res.status(500).json({ error: 'Invalid food analysis response' });
    }

    // Ensure numeric values
    data.cals = parseInt(data.cals, 10) || 0;
    data.p = parseInt(data.p, 10) || 0;
    data.c = parseInt(data.c, 10) || 0;
    data.f = parseInt(data.f, 10) || 0;

    res.status(200).json(data);
  } catch (error) {
    console.error('Gemini Error:', error);

    // Provide more specific error messages
    if (error.message?.includes('API key')) {
      return res.status(500).json({ error: 'API configuration error' });
    }

    if (error.message?.includes('quota')) {
      return res.status(429).json({ error: 'API rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({ error: 'Failed to analyze food. Please try again.' });
  }
}
