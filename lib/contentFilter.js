const BLOCKED_WORDS = [
  // Slurs and hate speech
  'nigger','nigga','faggot','fag','retard','retarded','kike','spic','chink','wetback','tranny',
  // Extreme profanity / sexual
  'fuck','shit','bitch','asshole','cock','dick','pussy','cunt','whore','slut',
  // Violence
  'kill yourself','kys','die','murder','rape','suicide',
  // Drugs (explicit solicitation patterns)
  'buy drugs','sell drugs','meth','heroin','fentanyl',
]

const BLOCKED_PATTERNS = BLOCKED_WORDS.map(w =>
  new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
)

export function filterContent(text) {
  if (!text || typeof text !== 'string') return { clean: true, text }

  let filtered = text
  let flagged = false

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(filtered)) {
      flagged = true
      filtered = filtered.replace(pattern, (match) =>
        match[0] + '*'.repeat(match.length - 1)
      )
    }
  }

  return { clean: !flagged, text: filtered, flagged }
}

export function isContentClean(text) {
  return filterContent(text).clean
}
