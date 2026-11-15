import { create } from "zustand";

export type Language = "de" | "en";
export type Theme = "light" | "dark";
function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export const usePreferences = create<{
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
}>((set) => ({
  language: stored("lab.language", "de") === "en" ? "en" : "de",
  theme: stored("lab.theme", "light") === "dark" ? "dark" : "light",
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
}));
function applyPreferences() {
  const { language, theme } = usePreferences.getState();
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("lab.language", language);
    localStorage.setItem("lab.theme", theme);
  } catch {
    /* Preferences also work without storage. */
  }
}
usePreferences.subscribe(applyPreferences);
applyPreferences();

export const locale = () =>
  usePreferences.getState().language === "en" ? "en-GB" : "de-DE";
