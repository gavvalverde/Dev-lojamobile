import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import ContatoItem from "../components/ContatoItem";
import ContatoService from "../services/ContatoService";
import { useRouter } from "expo-router";

export default function TelaA() {
  const theme = useTheme();
  const router = useRouter();
  const [contatos, setContatos] = useState([]);

  useEffect(() => {
    carregarContatos();
  }, []);

  function carregarContatos() {
    ContatoService.findAll().then((dados) => {
      setContatos(dados);
    });
  }

  function abrirFormulario(contato) {
    router.push({
      pathname: "/views/ContatoFormView",
      params: { id: contato.id },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.areaLista}>
        <FlatList
          data={contatos}
          keyExtractor={(item) => item.key}
          renderItem={({ item, index }) => (
            <ContatoItem
              item={item}
              index={index}
              onPress={() => abrirFormulario(item)}
            />
          )}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  areaLista: {
    flex: 1,
    margin: 14,
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  lista: {
    paddingBottom: 10,
  },
});