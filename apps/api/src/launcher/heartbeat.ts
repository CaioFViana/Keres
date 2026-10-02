import type { Translate } from './i18n';
import { formatLanUrls, lanHttpUrls, listLanIPv4 } from './lanAddresses';

/** How often the machine's addresses are looked at - quietly: nothing is printed unless they changed. */
export const LAN_POLL_MS = 15_000;

export function describeLanAddresses(
  port: string | number,
  host: string,
  t: Translate,
  addresses: string[] = listLanIPv4(),
): string[] {
  const lines: string[] = [];
  const urls = lanHttpUrls(port, addresses);
  if (urls.length === 0) {
    lines.push(t('lan_none'));
  } else {
    lines.push(t('lan_addresses', { urls: formatLanUrls(urls) }));
  }
  if (host === '127.0.0.1') {
    lines.push(t('lan_localhost_note'));
  }
  return lines;
}

/**
 * Watches the machine's LAN addresses and prints only when they change (a laptop moving between Wi-Fi and
 * cable, a VPN coming up). The addresses are printed once at startup by `describeLanAddresses`; repeating
 * them on a timer filled the terminal with lines nobody asked for.
 */
export function startLanAddressHeartbeat(options: {
  port: string | number;
  host: string;
  /** A human line in the terminal — never the JSON logger / `api_logs`. */
  print: (message: string) => void;
  t: Translate;
  listAddresses?: () => string[];
  setIntervalFn?: typeof setInterval;
}): () => void {
  const list = options.listAddresses ?? listLanIPv4;
  const schedule = options.setIntervalFn ?? setInterval;
  let lastKey = list().slice().sort().join(',');

  const timer = schedule(() => {
    const current = list();
    const key = current.slice().sort().join(',');
    if (key !== lastKey) {
      lastKey = key;
      const urls = lanHttpUrls(options.port, current);
      options.print(
        options.t('lan_changed', {
          urls: urls.length ? formatLanUrls(urls) : options.t('lan_none'),
        }),
      );
      if (options.host === '127.0.0.1') {
        options.print(options.t('lan_localhost_note'));
      }
    }
  }, LAN_POLL_MS);

  return () => clearInterval(timer);
}
