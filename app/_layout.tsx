import { Slot } from "expo-router";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import TopDropDownMenu from "./components/TopDropDownMenu";

const tema = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#b2c3d8",
    secondary: "#021123",
    background: "#e2e6eb",
    surface: "#7babe7",
    onPrimary: "#FFFFFF"
  }
};

export default function RootLayout() {
  return (
    <PaperProvider theme={tema}>
      <TopDropDownMenu></TopDropDownMenu>
      <Slot />
    </PaperProvider>
  );
}