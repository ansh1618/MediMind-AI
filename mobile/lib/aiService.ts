const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? process.env.EXPO_PUBLIC_GROK_API_KEY;

export interface AIResponse {
  diagnosis?: string;
  risk_level?: string;
  recommendations?: string[];
  summary?: string;
  response?: string;
}

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Gemini error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Groq error');
  return data.choices?.[0]?.message?.content ?? '';
}

export async function analyzeSymptoms(symptoms: string, patientInfo: string): Promise<AIResponse> {
  const prompt = `You are an expert clinical AI assistant. Analyze the following symptoms and provide a structured medical assessment.

Patient Information: ${patientInfo}
Symptoms: ${symptoms}

Respond in JSON format:
{
  "diagnosis": "Primary diagnosis or differential diagnoses",
  "risk_level": "low|medium|high|critical",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "summary": "Brief clinical summary"
}`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { diagnosis: text, risk_level: 'medium', recommendations: [], summary: text };
  } catch {
    try {
    const text = await callGroq(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return { diagnosis: text, risk_level: 'medium', recommendations: [], summary: text };
    } catch (e) {
      throw new Error('AI service unavailable');
    }
  }
}

export async function chatWithAI(message: string, history: { role: string; content: string }[]): Promise<string> {
  const context = history.map(h => `${h.role === 'user' ? 'Patient' : 'AI'}: ${h.content}`).join('\n');
  const prompt = `You are MediMind AI, a helpful clinical intelligence assistant. Be concise, professional, and empathetic.

Conversation history:
${context}

Patient: ${message}

Respond as AI:`;

  try {
    return await callGemini(prompt);
  } catch {
    try {
    return await callGroq(prompt);
    } catch {
      throw new Error('AI service unavailable');
    }
  }
}
