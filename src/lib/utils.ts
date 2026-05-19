import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合併 Tailwind CSS 類名的工具函數
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
