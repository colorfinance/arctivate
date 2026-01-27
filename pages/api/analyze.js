import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Identify the food in this image. Estimate the calories and macros (protein, carbs, fat) for the serving size shown. Return ONLY valid JSON in this format: { \"name\": \"Food Name\", \"desc\": \"Short description\", \"cals\": 0, \"p\": 0, \"c\": 0, \"f\": 0 }. Do not include markdown formatting." },
            {
              type: "image_url",
              image_url: {
                "url": image,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    // Clean up potential markdown code blocks if the AI adds them
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    res.status(200).json(data);
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to analyze food' });
  }
}
