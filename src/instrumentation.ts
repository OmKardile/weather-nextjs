/**
 * Runs once when the Next.js server boots.
 *
 * The sandbox/edge network this app may be deployed on can advertise
 * unreachable IPv6 routes (ENETUNREACH/ETIMEDOUT). Node's fetch only
 * retries the other family reliably when "Happy Eyeballs"
 * (autoSelectFamily) is enabled, so we set process-wide network
 * preferences before any route handler runs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('node:dns');
    const net = await import('node:net');
    try {
      dns.setDefaultResultOrder('ipv4first');
    } catch {
      /* not supported in this runtime — ignore */
    }
    if (typeof net.setDefaultAutoSelectFamily === 'function') {
      net.setDefaultAutoSelectFamily(true);
    }
  }
}
