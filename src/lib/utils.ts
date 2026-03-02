import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Copy text to clipboard and return success status
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a consistent Tailwind color class from a string (for avatars)
 */
export function stringToColorClass(str: string): string {
  const classes = [
    "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
    "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
    "bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400",
    "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return classes[Math.abs(hash) % classes.length];
}

/**
 * Generate a consistent color from a string (for avatars) - legacy
 */
export function stringToColor(str: string): string {
  const colors = [
    "#3F3F46", "#52525B", "#44403C", "#57534E",
    "#292524", "#1C1917", "#27272A", "#404040",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get the first letter of a string for avatar display
 */
export function getInitial(str: string): string {
  return str.charAt(0).toUpperCase();
}

/**
 * Format a timestamp to human readable date
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Generate a random strong password
 */
export function generatePassword(length: number = 20): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = upper + lower + digits + symbols;

  let password = "";
  // Ensure at least one of each category
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return password.split("").sort(() => Math.random() - 0.5).join("");
}
