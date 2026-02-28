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
    "bg-zinc-700", "bg-zinc-600", "bg-stone-800", "bg-stone-600",
    "bg-stone-900", "bg-stone-950", "bg-zinc-800", "bg-neutral-700",
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
