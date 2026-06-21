export type RiskLevel = 'safe' | 'low' | 'medium' | 'high';

export interface AnalysisResult {
  level: RiskLevel;
  summary: string;
  reasons: string[];
}

// ── Ollama config ───────────────────────────────────────────────────────────

const OLLAMA_HOST = 'http://172.29.10.103:11434';
const OLLAMA_MODEL = 'llama3.2:1b';

async function analyzeWithOllama(text: string): Promise<AnalysisResult> {
  const prompt = `You are a scam and phishing detection assistant. Analyze the following text from a user's screen and rate how dangerous it is.

Text to analyze:
"""
${text.slice(0, 1000)}
"""

Respond with ONLY a JSON object in this exact format, nothing else:
{
  "level": "safe" | "low" | "medium" | "high",
  "summary": "one sentence explanation",
  "reasons": ["reason 1", "reason 2"]
}

Rules:
- "high" = clear scam, phishing, malware alert, credential theft, fake virus warning
- "medium" = suspicious but not certain, urgency tactics, prize claims, unusual requests
- "low" = slightly odd but probably fine
- "safe" = normal everyday content`;

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) throw new Error('Ollama request failed');

    const data = await response.json();
    const parsed = JSON.parse(data.response);

    if (!parsed.level || !parsed.summary) throw new Error('Bad response format');

    return {
      level: parsed.level as RiskLevel,
      summary: parsed.summary,
      reasons: parsed.reasons ?? [],
    };
  } catch (e) {
    // Fall back to keyword detection if Ollama is unreachable
    console.warn('Ollama unreachable, falling back to keyword detection:', e);
    return analyzeScreenTextFallback(text);
  }
}

// ── fallback keyword detection (used if Ollama is offline) ─────────────────

const PHISHING_PATTERNS = [
  'secure-login', 'verify-account', 'account-update', 'login-verify',
  '.xyz', '.ru', '.tk', 'bit.ly', 'tinyurl.com', 'verify your account',
  'confirm your account', 'update your payment', 'unusual sign-in',
];

const MALWARE_PATTERNS = [
  'your computer is infected', 'virus detected', 'virus found',
  'call microsoft', 'call apple', 'call this number immediately',
  'your computer has been blocked', 'do not restart your computer',
  'tech support', 'download now to fix', 'install now to fix',
  'windows defender alert', 'microsoft warning',
];

const CREDENTIAL_PATTERNS = [
  'enter your password', 're-enter your password', 'confirm your identity',
  'social security number', 'credit card number', 'bank account number',
  'wire transfer', 'gift card', 'send money now', 'bitcoin wallet',
  'confirm your ssn',
];

const URGENCY_PATTERNS = [
  'act now', 'within 24 hours', 'account will be suspended',
  'account has been suspended', 'immediate action required',
  'limited time offer', 'claim your prize', 'you have won',
  'congratulations you won', 'you have been selected',
  'your package could not be delivered',
];

const LOTTERY_WORDS = ['lottery', 'prize', 'bitcoin', 'crypto reward'];
const SAFE_RESULT: AnalysisResult = { level: 'safe', summary: '', reasons: [] };

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function analyzeScreenTextFallback(rawText: string): AnalysisResult {
  const text = rawText.trim();
  if (text.length < 30) return SAFE_RESULT;
  const lower = text.toLowerCase();

  const highHits = [
    ...PHISHING_PATTERNS.filter((p) => lower.includes(p)),
    ...MALWARE_PATTERNS.filter((p) => lower.includes(p)),
    ...CREDENTIAL_PATTERNS.filter((p) => lower.includes(p)),
  ];

  const medHits = URGENCY_PATTERNS.filter((p) => lower.includes(p));
  const lottery = includesAny(lower, LOTTERY_WORDS);

  if (highHits.length > 0) {
    return {
      level: 'high',
      summary: 'This page looks very dangerous! Do not click anything.',
      reasons: [
        'This page may be trying to steal your personal information.',
        'Do NOT click any links or download anything.',
      ],
    };
  }

  if (medHits.length >= 2 || (medHits.length > 0 && lottery)) {
    return {
      level: 'medium',
      summary: 'Be careful — this page looks like a scam.',
      reasons: ['Do not enter any personal information.'],
    };
  }

  return SAFE_RESULT;
}

// ── main export ─────────────────────────────────────────────────────────────

export async function analyzeScreenText(rawText: string): Promise<AnalysisResult> {
  const text = rawText.trim();
  if (text.length < 30) return SAFE_RESULT;
  return analyzeWithOllama(text);
}

// ── cooldown / dedupe helper ────────────────────────────────────────────────

export class AlertCooldownTracker {
  private lastContentHash = '';
  private lastHighTime = 0;
  private lastHighHash = '';
  private lastMedTime = 0;
  private lastMedHash = '';

  constructor(
    private readonly highCooldownMs = 300_000,
    private readonly mediumCooldownMs = 60_000,
  ) {}

  resetCooldowns(): void {
    this.lastHighTime = 0;
    this.lastHighHash = '';
  }

  private static hash(text: string): string {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }

  async process(text: string, now: number = Date.now()): Promise<AnalysisResult | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const contentHash = AlertCooldownTracker.hash(trimmed);
    if (contentHash === this.lastContentHash) return null;
    this.lastContentHash = contentHash;

    const result = await analyzeScreenText(trimmed);

    if (result.level === 'high') {
      const same = contentHash === this.lastHighHash;
      const elapsed = now - this.lastHighTime;
      if (!same || elapsed > this.highCooldownMs) {
        this.lastHighTime = now;
        this.lastHighHash = contentHash;
        return result;
      }
      return null;
    }

    if (result.level === 'medium') {
      const same = contentHash === this.lastMedHash;
      const elapsed = now - this.lastMedTime;
      if (!same || elapsed > this.mediumCooldownMs) {
        this.lastMedTime = now;
        this.lastMedHash = contentHash;
        return result;
      }
      return null;
    }

    return null;
  }
}