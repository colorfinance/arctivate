import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { image } = req.body; // Expecting data:image/jpeg;base64,...

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Extract base64 part
    const base64Data = image.split(',')[1];
    const mimeType = image.split(';')[0].split(':')[1];

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Identify the food in this image. Estimate the calories and macros (protein, carbs, fat) for the serving size shown. Return ONLY valid JSON in this format: { "name": "Food Name", "desc": "Short description", "cals": 0, "p": 0, "c": 0, "f": 0 }. Do not include markdown formatting or backticks.`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean up if Gemini adds markdown
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    res.status(200).json(data);
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Failed to analyze food' });
  }
}
