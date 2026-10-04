/** @jest-environment node */
import { isAllowedServerUrl, isLocalServerHost } from '../../src/utils/serverUrl';

describe('server URL policy', () => {
  it('accepts https anywhere', () => {
    expect(isAllowedServerUrl('https://keres.example.com')).toBe(true);
    expect(isAllowedServerUrl('https://keres.example.com:8443/sync')).toBe(true);
  });

  it('accepts http on this device', () => {
    expect(isAllowedServerUrl('http://localhost:3000')).toBe(true);
    expect(isAllowedServerUrl('http://LOCALHOST:3000')).toBe(true);
    expect(isAllowedServerUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isAllowedServerUrl('http://127.1.2.3/')).toBe(true);
    expect(isAllowedServerUrl('http://[::1]:3000')).toBe(true);
  });

  it('accepts http on the local network', () => {
    expect(isAllowedServerUrl('http://192.168.1.10:3000')).toBe(true);
    expect(isAllowedServerUrl('http://10.0.0.5/')).toBe(true);
    expect(isAllowedServerUrl('http://172.16.0.9:3000')).toBe(true);
    expect(isAllowedServerUrl('http://172.31.255.255/')).toBe(true);
  });

  it('refuses http to the internet', () => {
    expect(isAllowedServerUrl('http://keres.example.com')).toBe(false);
    expect(isAllowedServerUrl('http://8.8.8.8:3000')).toBe(false);
    expect(isAllowedServerUrl('http://172.15.0.1/')).toBe(false);
    expect(isAllowedServerUrl('http://172.32.0.1/')).toBe(false);
    expect(isAllowedServerUrl('http://[2001:db8::1]/')).toBe(false);
    expect(isAllowedServerUrl('http://myserver.local/')).toBe(false);
  });

  it('refuses anything that is not http(s)', () => {
    expect(isAllowedServerUrl('')).toBe(false);
    expect(isAllowedServerUrl('not a url')).toBe(false);
    expect(isAllowedServerUrl('ftp://keres.example.com')).toBe(false);
    expect(isAllowedServerUrl('javascript:alert(1)')).toBe(false);
  });

  it('classifies local hosts, including IPv6 local ranges', () => {
    expect(isLocalServerHost('localhost')).toBe(true);
    expect(isLocalServerHost('LOCALHOST.')).toBe(true);
    expect(isLocalServerHost('192.168.0.1')).toBe(true);
    expect(isLocalServerHost('999.1.1.1')).toBe(false);
    expect(isLocalServerHost('keres.example.com')).toBe(false);
    expect(isLocalServerHost('::1')).toBe(true);
    expect(isLocalServerHost('fd00::1')).toBe(true);
    expect(isLocalServerHost('fe80::1%eth0')).toBe(true);
    expect(isLocalServerHost('2001:db8::1')).toBe(false);
  });
});
