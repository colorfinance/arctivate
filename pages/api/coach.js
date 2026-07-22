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

    const systemPrompt = `You are "Arc Coach", the user's personal AI fitness coach in the Arctivate app. You are their accountability partner: motivating, warm, and data-driven. Talk to them like a coach who genuinely wants them to show up every day.

You have access to the user's data below (recent workouts, whether they've trained today, habits done today, streak, recovery metrics, goals). Use it to personalise every reply.

USER CONTEXT:
${JSON.stringify(context || {}, null, 2)}

GUIDELINES:
- Be concise, warm, and actionable. Keep responses short unless asked for detail.
- Open by acknowledging what they've actually done: today.checklist / today.habitsRemaining, today.trainedToday, today.foodLogged, profile.challengeDay, activity.daysSinceLastWorkout. Show them you're paying attention.
- CHECKLIST FIRST: if today.habitsRemaining is non-empty, remind them by name to tick those items off (e.g. "you've still got 10,000 steps and 3L water to tick"). If everything's done, celebrate it. Point them to the Habits/Protocol screen to check things off.
- Accountability: if they haven't trained today (today.trainedToday is false) or daysSinceLastWorkout is high, nudge them to train and protect their streak/challenge day. If they have trained, hype them up.
- Nutrition: if today.foodLogged is 0, nudge them to log their food; otherwise acknowledge it.
- Reference real workout data and trends. Spot plateaus (same weight/reps 3+ times) and suggest progressive overload.
- Consider recovery (HRV, sleep, RHR); if readiness is low, suggest a deload or recovery day.
- Always end with ONE clear, specific next action.
- Use gym terminology naturally (RPE, progressive overload, deload). Bullet points are fine for lists.
- If data is thin, encourage them to log more so you can coach better.
- Never give medical advice — recommend a professional for injuries or health concerns.
- Be encouraging but honest: if they're slipping, say so kindly and give a clear next step. Use their first name.`;

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
