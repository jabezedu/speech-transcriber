"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { calculateSpeechStats, formatTime, FILLER_WORDS } from "@/lib/stats";

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-IN", label: "English (India)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "hi-IN", label: "Hindi (India)" },
  { code: "ta-IN", label: "Tamil (India)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "fr-FR", label: "French (France)" },
];

export default function SpeechTranscriberPage() {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check support on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
    }
  }, []);

  const fullText = useMemo(() => {
    return finalTranscript + (interimTranscript ? " " + interimTranscript : "");
  }, [finalTranscript, interimTranscript]);

  const stats = useMemo(() => {
    return calculateSpeechStats(fullText, elapsedSeconds);
  }, [fullText, elapsedSeconds]);

  // Keep isListeningRef in sync
  useEffect(() => {
    isListeningRef.current = isListening;
    if (isListening) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isListening]);

  const initRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return null;

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (newFinal) {
        setFinalTranscript((prev) => prev + newFinal);
      }
      setInterimTranscript(interim);
      setErrorMessage(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setErrorMessage("No speech detected. Please speak into your microphone.");
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setErrorMessage("Microphone access denied. Please allow microphone permissions in browser settings.");
        setIsListening(false);
      } else if (event.error === "audio-capture") {
        setErrorMessage("No microphone found or audio capture failed.");
        setIsListening(false);
      } else {
        setErrorMessage(`Recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if recognition ends unexpectedly while user hasn't pressed stop
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore if already active
        }
      } else {
        setInterimTranscript("");
      }
    };

    return recognition;
  };

  const handleToggleListening = () => {
    setErrorMessage(null);
    if (isListening) {
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      const rec = initRecognition();
      if (!rec) return;
      recognitionRef.current = rec;
      try {
        rec.start();
        setIsListening(true);
      } catch (err) {
        setErrorMessage("Failed to start speech recognition.");
        console.error(err);
      }
    }
  };

  // Change language on the fly
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.lang = newLang;
    }
  };

  const handleCopy = () => {
    if (!fullText.trim()) return;
    navigator.clipboard.writeText(fullText.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!fullText.trim()) return;
    const blob = new Blob([fullText.trim()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setFinalTranscript("");
    setInterimTranscript("");
    setElapsedSeconds(0);
    setErrorMessage(null);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2.5 bg-sky-100 dark:bg-sky-900/40 rounded-2xl mb-1 text-sky-600 dark:text-sky-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Speech Transcriber
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Live speech-to-text with continuous interim transcription, pacing stats, and real-time filler word detection.
          </p>
        </header>

        {!isSupported ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center text-amber-800 dark:text-amber-200">
            <p className="font-semibold text-base mb-1">Speech Recognition Not Supported</p>
            <p className="text-sm">Please use Chrome or Edge on desktop to utilize the Web Speech API.</p>
          </div>
        ) : (
          <>
            {/* Control Bar Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                    isListening
                      ? "bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-200 dark:ring-rose-950"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  }`}
                >
                  {isListening && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                  )}
                  {isListening ? "Stop Listening" : "Start Transcribing"}
                </button>

                <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="lang-select" className="text-xs font-medium text-slate-500">
                  Language:
                </label>
                <select
                  id="lang-select"
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-500 hover:underline ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Live Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Words</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.wordCount}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pace (WPM)</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.wpm}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Elapsed Time</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatTime(elapsedSeconds)}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Fillers</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalFillers}</div>
              </div>
            </div>

            {/* Filler Words Breakdown Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2.5">
                Filler Word Frequency
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {FILLER_WORDS.map((fw) => (
                  <div key={fw} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">&ldquo;{fw}&rdquo;</span>
                    <span className={`text-base font-bold ${stats.fillerCounts[fw] > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}`}>
                      {stats.fillerCounts[fw]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transcription Box Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Live Transcript
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!fullText.trim()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!fullText.trim()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    Download .txt
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!fullText && elapsedSeconds === 0}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="min-h-[160px] max-h-[360px] overflow-y-auto p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm leading-relaxed">
                {!fullText ? (
                  <span className="text-slate-400 italic">
                    {isListening ? "Listening... start speaking to transcribe." : "Press Start Transcribing to begin."}
                  </span>
                ) : (
                  <>
                    <span className="text-slate-900 dark:text-slate-100 font-sans">{finalTranscript}</span>
                    {interimTranscript && (
                      <span className="text-slate-400 dark:text-slate-500 italic ml-1">{interimTranscript}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
