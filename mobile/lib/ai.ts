// MediMind AI — Mobile AI Service
// Groq vision (primary) → Gemini (fallback)

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GROQ_KEY   = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

// ─── OCR / Text Extraction from image (base64 dataUrl) ──────────────────────
export async function extractTextFromImage(dataUrl: string): Promise<string> {
  const PROMPT = `You are a medical document OCR engine. Extract ALL text from this image exactly as written — preserve lab values, numbers, units, doctor notes, dates, and patient info. Return only the extracted plain text, no markdown.`;

  // 1. Try Groq vision first
  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ]}],
          temperature: 0, max_tokens: 8192,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const text = data?.choices?.[0]?.message?.content ?? '';
        if (text.trim()) return text;
      }
    } catch {}
  }

  // 2. Gemini fallback
  if (GEMINI_KEY) {
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
      try {
        const base64 = dataUrl.split(',')[1];
        const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ]}],
              generationConfig: { temperature: 0, maxOutputTokens: 8192 },
            }),
          }
        );
        const data = await res.json();
        if (res.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
          if (text.trim()) return text;
        }
      } catch {}
    }
  }

  throw new Error('Could not extract text from image. Please try again.');
}

// ─── Analyze medical text → structured JSON ──────────────────────────────────
export async function analyzeMedicalText(text: string): Promise<AnalysisResult> {
  const PROMPT = `You are MediMind AI, an expert clinical intelligence system. Analyze this medical record and return ONLY valid JSON (no markdown, no backticks):
{
  "title": "Brief report title",
  "patient_name": "Name or Unknown",
  "age": 0,
  "gender": "Male/Female/Unknown",
  "summary": "2-3 sentence clinical summary",
  "keyFindings": [
    { "finding": "Lab/vital finding description", "status": "normal|abnormal|critical" }
  ],
  "vitals": { "BP": "120/80 mmHg", "HR": "72 bpm" },
  "risk_scores": {
    "diabetes": { "score": 0, "level": "LOW|MODERATE|HIGH|CRITICAL" },
    "cardiac": { "score": 0, "level": "LOW|MODERATE|HIGH|CRITICAL" },
    "renal": { "score": 0, "level": "LOW|MODERATE|HIGH|CRITICAL" }
  },
  "diagnoses": ["..."],
  "medications": ["..."],
  "simplifiedExplanation": "Plain language explanation for patient",
  "recommendations": ["Actionable recommendations"]
}

Medical Record:
${text.slice(0, 6000)}`;

  // Try Groq text
  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: PROMPT }],
          temperature: 0.1, max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const raw = data?.choices?.[0]?.message?.content ?? '{}';
        return JSON.parse(raw) as AnalysisResult;
      }
    } catch {}
  }

  // Gemini fallback
  if (GEMINI_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as AnalysisResult;
    }
  }

  throw new Error('AI analysis failed. Please try again.');
}

// ─── Chat with AI ────────────────────────────────────────────────────────────
export async function chatWithAI(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const system = `You are MediMind AI, an expert clinical AI assistant. Provide accurate, concise, evidence-based medical information. Always recommend consulting a qualified healthcare professional for diagnosis and treatment. Keep responses clear and helpful.`;

  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: system }, ...messages],
          temperature: 0.3, max_tokens: 2048,
        }),
      });
      const data = await res.json();
      if (res.ok) return data?.choices?.[0]?.message?.content ?? '';
    } catch {}
  }

  if (GEMINI_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );
    const data = await res.json();
    if (res.ok) return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  throw new Error('AI service unavailable.');
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface AnalysisResult {
  title: string;
  patient_name: string;
  age: number;
  gender: string;
  summary: string;
  keyFindings: { finding: string; status: 'normal' | 'abnormal' | 'critical' }[];
  vitals: Record<string, string>;
  risk_scores: {
    diabetes: { score: number; level: string };
    cardiac: { score: number; level: string };
    renal: { score: number; level: string };
  };
  diagnoses: string[];
  medications: string[];
  simplifiedExplanation: string;
  recommendations: string[];
}
