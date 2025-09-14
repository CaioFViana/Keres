const LANGUAGE_KEY = 'userLanguage';

export const setItem = async (key: string, value: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

export const getItem = async (key: string): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

export const deleteItem = async (key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
};

export const setLanguage = async (languageCode: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_KEY, languageCode);
  }
};

export const getLanguage = async (): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(LANGUAGE_KEY);
  }
  return null;
};
