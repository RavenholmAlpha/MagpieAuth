/**
 * Evaluates password strength and returns a score and label.
 * Score: 0-4 (very weak → very strong)
 */
export function evaluatePasswordStrength(password: string): {
  score: number;
  label: string;
  bgClass: string;
  textClass: string;
} {
  if (!password) return { score: 0, label: "", bgClass: "", textClass: "" };

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Penalize common patterns
  if (/^(.)\1+$/.test(password)) score = Math.max(score - 2, 0); // repeated chars
  if (/^(123|abc|qwerty|password)/i.test(password)) score = Math.max(score - 2, 0);

  // Normalize to 0-4
  const normalized = Math.min(Math.max(Math.floor(score * 4 / 6), 0), 4);

  const labels: Record<number, { label: string; bgClass: string; textClass: string }> = {
    0: { label: "Very Weak", bgClass: "bg-red-400/80", textClass: "text-red-400" },
    1: { label: "Weak", bgClass: "bg-orange-400/80", textClass: "text-orange-400" },
    2: { label: "Fair", bgClass: "bg-yellow-400/80", textClass: "text-yellow-400" },
    3: { label: "Strong", bgClass: "bg-green-400/80", textClass: "text-green-400" },
    4: { label: "Very Strong", bgClass: "bg-green-400/90", textClass: "text-green-400" },
  };

  return { score: normalized, ...labels[normalized] };
}
