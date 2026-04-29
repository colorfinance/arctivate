import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
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
    return res.status(500).json({ error: 'AI Coach not configured. Please add GOOGLE_API_KEY to environment variables.' });
  }

  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'No message provided' });
    }

    const ai = new GoogleGenAI({ apiKey });

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

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }, { text: message }] },
      ],
    });

    const text = result.text;

    res.status(200).json({ reply: text });
  } catch (error) {
    logUpstreamError('Coach API Error', error);

    const msg = error?.message || '';
    const status = error?.status ?? error?.response?.status;

    if (status === 401 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('PERMISSION_DENIED')) {
      return res.status(500).json({ error: 'AI service rejected the API key (403). Verify GOOGLE_API_KEY in Vercel and that the Generative Language API is enabled.' });
    }

    if (status === 429 || msg.includes('quota') || msg.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: 'Rate limit reached. Please try again in a moment.' });
    }

    if (msg.includes('SAFETY')) {
      return res.status(400).json({ error: 'Message could not be processed. Please rephrase.' });
    }

    res.status(500).json({ error: 'Failed to get coach response. Please try again.' });
  }
}
