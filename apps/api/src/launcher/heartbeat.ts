import type { Translate } from './i18n';
import { formatLanUrls, lanHttpUrls, listLanIPv4 } from './lanAddresses';

export const LAN_POLL_MS = 15_000;
export const LAN_REPEAT_MS = 30_000;

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

export function startLanAddressHeartbeat(options: {
  port: string | number;
  host: string;
  /** A human line in the terminal — never the JSON logger / `api_logs`. */
  print: (message: string) => void;
  t: Translate;
  listAddresses?: () => string[];
  now?: () => number;
  setIntervalFn?: typeof setInterval;
}): () => void {
  const list = options.listAddresses ?? listLanIPv4;
  const now = options.now ?? Date.now;
  const schedule = options.setIntervalFn ?? setInterval;
  let lastKey = list().slice().sort().join(',');
  let lastRepeatAt = now();

  const timer = schedule(() => {
    const current = list();
    const key = current.slice().sort().join(',');
    const timestamp = now();
    if (key !== lastKey) {
      lastKey = key;
      lastRepeatAt = timestamp;
      const urls = lanHttpUrls(options.port, current);
      options.print(
        options.t('lan_changed', {
          urls: urls.length ? formatLanUrls(urls) : options.t('lan_none'),
        }),
      );
      if (options.host === '127.0.0.1') {
        options.print(options.t('lan_localhost_note'));
      }
      return;
    }
    if (timestamp - lastRepeatAt >= LAN_REPEAT_MS) {
      lastRepeatAt = timestamp;
      for (const line of describeLanAddresses(options.port, options.host, options.t, current)) {
        options.print(line);
      }
    }
  }, LAN_POLL_MS);

  return () => clearInterval(timer);
}
