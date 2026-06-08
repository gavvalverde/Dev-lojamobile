import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "@yellowduck:theme-mode";

const profileColorOptions = [
  "#ffc94a",
  "#ff8f3d",
  "#ef476f",
  "#b5179e",
  "#7b2cbf",
  "#4361ee",
  "#039be5",
  "#00b4d8",
  "#2ec4b6",
  "#36b37e",
  "#8ac926",
  "#ffffff",
  "#f7f3e8",
  "#dcebf5",
  "#5f7284",
  "#06243a",
];

const lightTheme = {
  mode: "light",
  dark: false,
  profileColorOptions,
  colors: {
    primary: "#039be5",
    secondary: "#06243a",
    accent: "#ffc94a",
    profileWarm: "#ff8f3d",
    background: "#eef5fa",
    surface: "#ffffff",
    surfaceVariant: "#dcebf5",
    text: "#061d30",
    mutedText: "#5f7284",
    border: "#c9d9e5",
    danger: "#d9412e",
    onPrimary: "#ffffff",
    onAccent: "#06243a",
    onDark: "#ffffff",
    shadow: "#000000",
    avatarBackground: "#222222",
    subtleText: "#888888",
    placeholderText: "#999999",
    overlay: "rgba(0, 0, 0, 0.45)",
    overlaySoft: "rgba(0, 0, 0, 0.16)",
    overlayMedium: "rgba(0, 0, 0, 0.42)",
    overlayStrong: "rgba(0, 0, 0, 0.55)",
  },
};

const darkTheme = {
  mode: "dark",
  dark: true,
  profileColorOptions,
  colors: {
    primary: "#17aefa",
    secondary: "#03111f",
    accent: "#ffc94a",
    profileWarm: "#ff8f3d",
    background: "#061827",
    surface: "#0b2b45",
    surfaceVariant: "#123b5f",
    text: "#f4f7fb",
    mutedText: "#b7c9d8",
    border: "#244d6d",
    danger: "#ff8a72",
    onPrimary: "#ffffff",
    onAccent: "#06243a",
    onDark: "#ffffff",
    shadow: "#000000",
    avatarBackground: "#222222",
    subtleText: "#b7c9d8",
    placeholderText: "#8fa9bc",
    overlay: "rgba(0, 0, 0, 0.62)",
    overlaySoft: "rgba(0, 0, 0, 0.22)",
    overlayMedium: "rgba(0, 0, 0, 0.5)",
    overlayStrong: "rgba(0, 0, 0, 0.68)",
  },
};

const AppThemeContext = createContext({
  isDarkMode: false,
  theme: lightTheme,
  toggleTheme: () => {},
});

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((storedMode) => {
      if (storedMode === "dark" || storedMode === "light") {
        setMode(storedMode);
      }
    });
  }, []);

  const value = useMemo(() => {
    const theme = mode === "dark" ? darkTheme : lightTheme;

    return {
      isDarkMode: mode === "dark",
      theme,
      toggleTheme: () => {
        setMode((currentMode) => {
          const nextMode = currentMode === "dark" ? "light" : "dark";
          AsyncStorage.setItem(STORAGE_KEY, nextMode);
          return nextMode;
        });
      },
    };
  }, [mode]);

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
