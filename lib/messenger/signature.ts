import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verifies Meta's `X-Hub-Signature-256` against the **raw** request body.
 *
 * Raw matters: the signature covers the exact bytes Meta sent. Parsing the JSON
 * and re-serialising it changes key order, spacing and unicode escaping, and
 * the hash of that will never match. In an App Router route that means
 * `await request.text()` first, hash the string, and `JSON.parse` it yourself —
 * `request.json()` consumes the body and you cannot get the original back.
 *
 * This is the only thing standing between the webhook and anyone on the
 * internet who knows the URL. The route is public by necessity (Meta has to
 * reach it) and `middleware.ts` only guards `/admin`, so an unverified request
 * must be refused here or not at all.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined
): boolean {
  // No secret configured means we cannot verify anything. Fail closed: an
  // unconfigured deployment should reject Meta rather than accept the world.
  if (!appSecret) return false
  if (!signatureHeader) return false

  const [algorithm, received] = signatureHeader.split('=')
  if (algorithm !== 'sha256' || !received) return false

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')

  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false, and a wrong-length signature is a wrong signature.
  if (received.length !== expected.length) return false

  try {
    return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

/**
 * The GET handshake Meta performs before it will save a callback URL: it sends
 * `hub.mode=subscribe` with our own verify token and expects `hub.challenge`
 * echoed back verbatim as the body.
 *
 * Returns the challenge to echo, or null to refuse. A mismatched token means
 * someone else is pointing an app at our URL.
 */
export function verificationChallenge(
  params: URLSearchParams,
  verifyToken: string | undefined
): string | null {
  if (!verifyToken) return null
  if (params.get('hub.mode') !== 'subscribe') return null
  if (params.get('hub.verify_token') !== verifyToken) return null
  return params.get('hub.challenge')
}
