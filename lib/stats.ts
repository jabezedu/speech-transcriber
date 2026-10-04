export interface TranscriberStats {
  wordCount: number;
  wpm: number;
  fillerCounts: Record<string, number>;
  totalFillers: number;
}

export const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually'] as const;

export function calculateSpeechStats(text: string, elapsedSeconds: number): TranscriberStats {
  const normalized = text.toLowerCase();
  const words = normalized.match(/[a-zA-Z0-9'-]+/g) || [];
  const wordCount = words.length;

  const wpm = elapsedSeconds > 2 ? Math.round((wordCount / (elapsedSeconds / 60))) : 0;

  const fillerCounts: Record<string, number> = {
    'um': 0,
    'uh': 0,
    'like': 0,
    'you know': 0,
    'basically': 0,
    'actually': 0,
  };

  let totalFillers = 0;

  // 'you know' check
  const youKnowMatches = normalized.match(/\byou\s+know\b/g);
  if (youKnowMatches) {
    fillerCounts['you know'] = youKnowMatches.length;
    totalFillers += youKnowMatches.length;
  }

  // Single word fillers
  const singleFillers = ['um', 'uh', 'like', 'basically', 'actually'];
  for (const filler of singleFillers) {
    const reg = new RegExp(`\\b${filler}\\b`, 'g');
    const matches = normalized.match(reg);
    if (matches) {
      fillerCounts[filler] = matches.length;
      totalFillers += matches.length;
    }
  }

  return {
    wordCount,
    wpm,
    fillerCounts,
    totalFillers,
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
