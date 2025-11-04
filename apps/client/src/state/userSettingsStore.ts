import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserSettingsState {
  username: string;
  language: string;
  setUsername: (username: string) => void;
  setLanguage: (language: string) => void;
}

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set) => ({
      username: '',
      language: 'en', // Default language
      setUsername: (username) => set({ username }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'user-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
