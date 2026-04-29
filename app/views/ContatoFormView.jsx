import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput, useTheme } from "react-native-paper";

import ContatoEntity from "../entities/ContatoEntity";
import ContatoService from "../services/ContatoService";

export default function ContatoFormView() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [idContato, setIdContato] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [favorito, setFavorito] = useState(false);
  const [categoria, setCategoria] = useState("Amigos");
  const [sexo, setSexo] = useState(true); // true = M, false = F

  useEffect(() => {
    if (!id) return;

    ContatoService.findById(id).then((contato) => {
      if (!contato) return;

      setIdContato(contato.id);
      setNome(contato.nome);
      setEmail(contato.email);
      setTelefone(contato.telefone);
      setAvatar(contato.avatar); // preserva avatar
      setFavorito(contato.favorito);
      setCategoria(contato.categoria);
      setSexo(contato.sexo === "M");
    });
  }, [id]);

  function salvar() {
    const contato = new ContatoEntity(
      idContato,
      nome,
      email,
      telefone,
      avatar, // usa o avatar atual
      favorito,
      categoria,
      sexo ? "M" : "F"
    );

    ContatoService.save(contato).then(() => {
      router.back();
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TextInput
        label="Nome"
        value={nome}
        onChangeText={setNome}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        label="Telefone"
        value={telefone}
        onChangeText={setTelefone}
        mode="outlined"
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={categoria}
          onValueChange={(itemValue) => setCategoria(itemValue)}
        >
          <Picker.Item label="Amigos" value="Amigos" />
          <Picker.Item label="Família" value="Família" />
          <Picker.Item label="Trabalho" value="Trabalho" />
          <Picker.Item label="Outros" value="Outros" />
        </Picker>
      </View>

      <View style={styles.linhaSwitch}>
        <Text variant="bodyLarge">
          Sexo: {sexo ? "Masculino" : "Feminino"}
        </Text>
        <Switch value={sexo} onValueChange={setSexo} />
      </View>

      <View style={styles.linhaSwitch}>
        <Text variant="bodyLarge">Favorito</Text>
        <Switch value={favorito} onValueChange={setFavorito} />
      </View>

      <Button mode="contained" onPress={salvar} style={styles.botao}>
        Salvar
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    marginBottom: 12,
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 14,
    color: "#555",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 6,
    marginBottom: 12,
  },
  linhaSwitch: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  botao: {
    marginTop: 16,
  },
});