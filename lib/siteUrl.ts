/**
 * Absolute base for anything that has to work outside a page context —
 * confirmation emails, and chat replies that travel to Messenger where a
 * relative path means nothing.
 *
 * Kept in its own module because both lib/email.ts and lib/chat/conversation.ts
 * need it, and importing email.ts from the chat copy would drag nodemailer into
 * the bot's dependency graph for the sake of one string.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_URL || 'https://makemycoffee.cafe').replace(/\/+$/, '')
}
