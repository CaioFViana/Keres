import { describe, expect, it } from 'vitest';
import {
  assertValidServerId,
  isExternalBrowserUrl,
  isInAppNavigation,
  isTrustedRendererUrl,
} from '../src/security';

describe('desktop IPC security', () => {
  it('accepts only the internal app renderer origin', () => {
    expect(isTrustedRendererUrl('app://app/')).toBe(true);
    expect(isTrustedRendererUrl('app://app/settings')).toBe(true);
    expect(isTrustedRendererUrl('https://app/')).toBe(false);
    expect(isTrustedRendererUrl('app://app.evil/')).toBe(false);
    expect(isTrustedRendererUrl('app://app@evil/')).toBe(false);
    expect(isTrustedRendererUrl('app://app:1234/')).toBe(false);
    expect(isTrustedRendererUrl('not a URL')).toBe(false);
    expect(isTrustedRendererUrl(undefined)).toBe(false);
  });

  it('rejects unsafe server identifiers', () => {
    expect(() => assertValidServerId('server_01-A')).not.toThrow();
    expect(() => assertValidServerId('../outside')).toThrow('Invalid server identifier.');
    expect(() => assertValidServerId('')).toThrow('Invalid server identifier.');
  });
});

describe('leaving the app for the system browser', () => {
  // O app é a janela de um programa, não um navegador: uma página aberta aqui dentro ficaria
  // sem barra de endereço, sem histórico e sem os logins que a pessoa já tem.
  it('sends http and https addresses out', () => {
    expect(isExternalBrowserUrl('https://keres.example/story/01ARZ3ND')).toBe(true);
    expect(isExternalBrowserUrl('http://localhost:3000/story/01ARZ3ND')).toBe(true);
  });

  // Um link não pode virar um jeito de mandar o sistema executar alguma coisa.
  it('refuses every other scheme', () => {
    expect(isExternalBrowserUrl('javascript:alert(1)')).toBe(false);
    expect(isExternalBrowserUrl('file:///etc/passwd')).toBe(false);
    expect(isExternalBrowserUrl('app://app/')).toBe(false);
    expect(isExternalBrowserUrl('data:text/html,<script>')).toBe(false);
    expect(isExternalBrowserUrl('not a URL')).toBe(false);
    expect(isExternalBrowserUrl(undefined)).toBe(false);
  });

  it('treats only the app renderer as an in-app navigation', () => {
    expect(isInAppNavigation('app://app/')).toBe(true);
    expect(isInAppNavigation('https://keres.example/')).toBe(false);
  });
});
