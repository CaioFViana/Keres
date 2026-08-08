import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface ElectronAuthBridge {
  status(): Promise<{ available: boolean }>;
  read(serverId: string): Promise<AuthTokens | null>;
  write(serverId: string, tokens: AuthTokens): Promise<void>;
  remove(serverId: string): Promise<void>;
}

declare global {
  interface Window {
    keresAuth?: ElectronAuthBridge;
  }
}

const keyFor = (serverId: string) => `keres.auth.${serverId}`;

/** Stores credentials outside SQLite/OPFS while keeping the rest of auth platform-agnostic. */
class TokenVault {
  private memory = new Map<string, AuthTokens>();

  async get(serverId: string): Promise<AuthTokens | null> {
    const cached = this.memory.get(serverId);
    if (cached) return cached;

    let tokens: AuthTokens | null = null;
    if (Platform.OS === 'web') {
      tokens = await window.keresAuth?.read(serverId) ?? null;
    } else {
      const value = await SecureStore.getItemAsync(keyFor(serverId));
      tokens = value ? JSON.parse(value) as AuthTokens : null;
    }
    if (tokens) this.memory.set(serverId, tokens);
    return tokens;
  }

  peek(serverId: string): AuthTokens | null {
    return this.memory.get(serverId) ?? null;
  }

  async set(serverId: string, tokens: AuthTokens): Promise<void> {
    if (Platform.OS === 'web') {
      const bridge = window.keresAuth;
      if (bridge && (await bridge.status()).available) await bridge.write(serverId, tokens);
    } else {
      await SecureStore.setItemAsync(keyFor(serverId), JSON.stringify(tokens));
    }
    this.memory.set(serverId, tokens);
  }

  async remove(serverId: string): Promise<void> {
    this.memory.delete(serverId);
    if (Platform.OS === 'web') {
      await window.keresAuth?.remove(serverId);
    } else {
      await SecureStore.deleteItemAsync(keyFor(serverId));
    }
  }
}

export const tokenVault = new TokenVault();
