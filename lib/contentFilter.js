// Lightweight client-side profanity / hate / threat filter used to block
// obviously-objectionable posts before they hit the database. This is the
// "method for filtering objectionable content" required by Apple guideline 1.2.
// Server-side moderation (reports + admin action) is the authoritative layer;
// this just catches the easy cases.

const BANNED_TERMS = [
  // slurs
  'nigger', 'n1gger', 'nigga', 'n1gga',
  'faggot', 'f4ggot', 'fag',
  'retard', 'r3tard',
  'tranny', 'kike', 'chink', 'spic', 'wetback', 'gook', 'coon',
  // explicit sexual content directed at minors
  'cp', 'childporn', 'child porn', 'pedo', 'pedophile', 'loli',
  // threats
  'kill yourself', 'kys', 'kill urself',
  'i will kill you', 'going to kill you',
  'rape you', 'rape her', 'rape him',
  // doxxing intent
  'doxx you', 'dox you',
]

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
    .replace(/[!.@#$%^&*()_\-+={}\[\]|\\:;"'<>,?\/~`]/g, '')
    .trim()
}

export function containsBannedContent(text) {
  if (!text) return false
  const normalized = normalize(text)
  if (!normalized) return false
  for (const term of BANNED_TERMS) {
    const t = normalize(term)
    if (!t) continue
    // whole-word match for short terms, substring for phrases with spaces
    if (t.includes(' ')) {
      if (normalized.includes(t)) return true
    } else {
      const re = new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`)
      if (re.test(normalized)) return true
    }
  }
  return false
}

export function checkUserContent(text) {
  if (containsBannedContent(text)) {
    return {
      ok: false,
      reason:
        'This post was blocked because it contains language that violates our community rules. Hate speech, threats, and sexual content involving minors are not allowed.',
    }
  }
  return { ok: true }
}
