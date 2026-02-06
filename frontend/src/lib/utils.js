import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * P2-FIX: Get today's date in local timezone as YYYY-MM-DD string
 * This ensures the date shown matches the user's local date, not UTC
 * 
 * Problem: new Date().toISOString().split('T')[0] uses UTC timezone
 * which can show "yesterday" for IST users when it's after midnight IST but before 5:30 AM IST
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * P2-FIX: Format a date string or Date object to localized display format
 * @param {string|Date} dateInput - Date string (ISO format) or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export function formatDateLocal(dateInput, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString('en-IN', options);
}

/**
 * P2-FIX: Format a date string or Date object to localized time format
 * @param {string|Date} dateInput - Date string (ISO format) or Date object
 * @returns {string} - Formatted time string
 */
export function formatTimeLocal(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * P2-FIX: Format a date with both date and time
 * @param {string|Date} dateInput - Date string (ISO format) or Date object
 * @returns {string} - Formatted date and time string
 */
export function formatDateTimeLocal(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
