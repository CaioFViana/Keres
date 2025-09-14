import * as SecureStore from 'expo-secure-store';

const LANGUAGE_KEY = 'userLanguage';

export const setItem = async (key: string, value: string) => {
  await SecureStore.setItemAsync(key, value);
};

export const getItem = async (key: string): Promise<string | null> => {
  return await SecureStore.getItemAsync(key);
};

export const deleteItem = async (key: string) => {
  await SecureStore.deleteItemAsync(key);
};

export const setLanguage = async (languageCode: string) => {
  await setItem(LANGUAGE_KEY, languageCode);
};

export const getLanguage = async (): Promise<string | null> => {
  return await getItem(LANGUAGE_KEY);
};
