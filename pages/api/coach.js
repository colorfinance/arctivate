import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'AI Coach not configured. Please add GOOGLE_API_KEY to environment variables.' });
  }

  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'No message provided' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = `You are an expert AI fitness coach for the Arctivate fitness app. Your name is "Arc Coach". You are knowledgeable, motivating, and data-driven.

You have access to the user's data below. Use it to provide personalized, actionable advice.

USER CONTEXT:
${JSON.stringify(context || {}, null, 2)}

GUIDELINES:
- Be concise and actionable. Keep responses under 200 words unless the user asks for detail.
- Reference the user's actual workout data, wearable metrics, and trends when relevant.
- Identify plateaus: If the user has logged the same weight/reps for an exercise 3+ times, suggest progressive overload strategies.
- Consider recovery data (HRV, sleep, RHR) when suggesting training intensity.
- If readiness is low, suggest deload or recovery-focused sessions.
- Use gym terminology naturally (RPE, progressive overload, deload, etc.)
- Format key points with bullet points for readability.
- If you don't have enough data, ask the user to log more workouts or wearable data.
- Never provide medical advice. Recommend seeing a professional for injuries or health concerns.
- Be encouraging but honest. If someone is stalling, tell them directly with solutions.`;

    const result = await model.generateContent([systemPrompt, message]);
    const response = result.response;
    const text = response.text();

    res.status(200).json({ reply: text });
  } catch (error) {
    console.error('Coach API Error:', error.message || error);

    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
      return res.status(500).json({ error: 'Invalid API key. Please check your GOOGLE_API_KEY.' });
    }

    if (error.message?.includes('quota') || error.message?.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'Rate limit reached. Please try again in a moment.' });
    }

    if (error.message?.includes('SAFETY')) {
      return res.status(400).json({ error: 'Message could not be processed. Please rephrase.' });
    }

    res.status(500).json({ error: 'Failed to get coach response. Please try again.' });
  }
}
