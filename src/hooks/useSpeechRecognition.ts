import { useCallback, useEffect, useRef, useState } from "react";

// Browser SpeechRecognition API types not in lib.dom.d.ts for all envs
type SpeechRecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } };
type SpeechRecognitionResultList = { length: number; [index: number]: SpeechRecognitionResult; resultIndex: number };
type SpeechRecognitionEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSR(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
    (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition ??
    null
  );
}

/**
 * Browser SpeechRecognition (voice-to-text) hook.
 * Returns interim + final transcripts as the user speaks.
 */
export function useSpeechRecognition(opts?: { lang?: string; continuous?: boolean }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const start = useCallback(() => {
    setError(null);
    const SR = getSR();
    if (!SR) {
      setError("Voice input not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.lang = opts?.lang ?? "en-US";
    rec.continuous = opts?.continuous ?? true;
    rec.interimResults = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((prev) => (prev ? prev + " " : "") + finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(e.error || "Voice input error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start voice input");
    }
  }, [opts?.lang, opts?.continuous]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
  }, []);

  return { start, stop, reset, listening, transcript, interim, supported, error };
}
