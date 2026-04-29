import { router } from 'expo-router';
import { useState } from 'react';
import { Appbar, Menu } from 'react-native-paper';

export default function TopDropDownMenu() {
  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const navigate = (path) => {
    closeMenu();           // fecha o menu
    router.push(path);     // navega para a rota
  };

  return (
    <Appbar.Header>
      <Menu visible={visible} onDismiss={closeMenu}
        anchor={<Appbar.Action icon="menu" color="black" onPress={openMenu} />}
      >
        <Menu.Item onPress={() => navigate('/')} title="Home" />
        <Menu.Item onPress={() => navigate('/views/ContatoListView')} title="Contatos" />
      </Menu>
      <Appbar.Content title="Meus contatos" />
    </Appbar.Header>
  );
}