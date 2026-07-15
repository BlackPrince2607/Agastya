import { fetchApiHealth } from '@/services/agastyaApi';
import { AGASTYA_API_ROOT, getApiHostLabel } from '@/services/env';

export type ReachabilityIssue = 'ok' | 'offline' | 'dns_subdomain' | 'server_unreachable';

const PROBE_TIMEOUT_MS = 6000;

async function probeReachable(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, signal: controller.signal });
    return res.ok || res.status === 204 || res.status === 405;
  } catch {
    if (method === 'HEAD') {
      return probeReachable(url, 'GET');
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Distinguish "no internet", "DNS blocks Railway deploy hostnames", and "API down".
 * Many mobile hotspots resolve railway.app but refuse *.up.railway.app.
 */
export async function diagnoseReachability(): Promise<ReachabilityIssue> {
  try {
    await fetchApiHealth();
    return 'ok';
  } catch {
    const internetOk = await probeReachable('https://connectivitycheck.gstatic.com/generate_204');
    if (!internetOk) return 'offline';

    const railwayRootOk = await probeReachable('https://railway.app', 'HEAD');
    const apiOk = await probeReachable(`${AGASTYA_API_ROOT}/v1/health`);
    if (railwayRootOk && !apiOk) return 'dns_subdomain';
    return 'server_unreachable';
  }
}

export function reachabilityDevHint(issue: ReachabilityIssue): string {
  const host = getApiHostLabel();
  switch (issue) {
    case 'offline':
      return 'No internet on this device. Check Wi-Fi or mobile data.';
    case 'dns_subdomain':
      return (
        `Network DNS is blocking ${host} (common on phone hotspots). ` +
        'Android: Settings → Network → Private DNS → dns.google (or one.one.one.one). ' +
        'iPhone: Wi-Fi → (i) → Configure DNS → Manual → 8.8.8.8. ' +
        'Or run the API locally: npm run api and set EXPO_PUBLIC_AGASTYA_API_URL=http://localhost:8000 in .env.'
      );
    case 'server_unreachable':
      return `Internet works but ${host} is unreachable. Check Railway deploy status or try again shortly.`;
    default:
      return `Phone must reach ${AGASTYA_API_ROOT} (Wi-Fi or mobile data).`;
  }
}
