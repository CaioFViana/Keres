import * as os from 'node:os';

type AddressFamily = string | number;

export type NetworkInterfaceSnapshot = Record<
  string,
  Array<{ address: string; family: AddressFamily; internal: boolean }> | undefined
>;

function isIPv4(family: AddressFamily): boolean {
  return family === 'IPv4' || family === 4;
}

function isLinkLocal(address: string): boolean {
  return address.startsWith('169.254.');
}

/**
 * IPv4 desta máquina que um telemóvel na LAN pode usar. Não escolhe “o certo”:
 * Wi‑Fi, cabo e VPN aparecem todos. Sem IPv6, sem 127.0.0.1, sem APIPA.
 */
export function listLanIPv4(
  interfaces: NetworkInterfaceSnapshot = os.networkInterfaces(),
): string[] {
  const found = new Set<string>();
  for (const addresses of Object.values(interfaces)) {
    for (const entry of addresses ?? []) {
      if (!isIPv4(entry.family) || entry.internal || isLinkLocal(entry.address)) {
        continue;
      }
      found.add(entry.address);
    }
  }
  return [...found].sort();
}

export function lanHttpUrls(port: string | number, addresses: string[] = listLanIPv4()): string[] {
  return addresses.map((address) => `http://${address}:${port}`);
}

export function formatLanUrls(urls: string[]): string {
  return urls.join('  ');
}
