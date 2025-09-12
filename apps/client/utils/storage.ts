import * as SecureStore from 'expo-secure-store';

export const setItem = async (key: string, value: string) => {
  await SecureStore.setItemAsync(key, value);
};

export const getItem = async (key: string): Promise<string | null> => {
  return await SecureStore.getItemAsync(key);
};

export const deleteItem = async (key: string) => {
  await SecureStore.deleteItemAsync(key);
};
