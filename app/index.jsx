import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function Index() {
  const theme = useTheme();
  return (
    <View style={[style.container, { backgroundColor: theme.colors.background }]}>
      <View style={style.conteudo}>
        <Text style={style.text}>Home</Text>
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
  },
  conteudo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 40,
  },
  text:{
    fontSize:40,
    backgroundColor: "#FFFF"
  }
});