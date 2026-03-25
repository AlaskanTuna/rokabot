// Jikan's free tier allows ~3 req/s; enforce a minimum gap to stay under

const JIKAN_MIN_INTERVAL_MS = 350

let lastJikanRequest = 0

/** Delay if needed to respect the Jikan API rate limit (~3 req/s). */
export async function jikanThrottle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastJikanRequest
  if (elapsed < JIKAN_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, JIKAN_MIN_INTERVAL_MS - elapsed))
  }
  lastJikanRequest = Date.now()
}
