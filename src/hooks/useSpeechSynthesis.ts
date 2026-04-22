import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser SpeechSynthesis (text-to-speech) hook.
 * Maps an ISO-ish language hint to a matching voice when possible.
 */
export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string, langHint?: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    const lang = langToBcp47(langHint);
    u.lang = lang;

    // Pick a matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
    if (match) u.voice = match;

    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported };
}

function langToBcp47(hint?: string): string {
  if (!hint) return "en-US";
  const map: Record<string, string> = {
    English: "en-US",
    Hindi: "hi-IN",
    Spanish: "es-ES",
    French: "fr-FR",
    "Mandarin Chinese": "zh-CN",
    Arabic: "ar-SA",
    Bengali: "bn-IN",
    Tamil: "ta-IN",
  };
  return map[hint] ?? hint;
}
