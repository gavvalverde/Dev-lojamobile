import React, { useRef, useEffect } from 'react';
import { View, ImageBackground, Image, Text, TouchableOpacity, Animated, StyleSheet, useWindowDimensions } from 'react-native';

const IndexView = () => {
  const { width, height } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleButtonPress = () => {
    console.log('Botão pressionado!');
    // Animação de escala
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    // Adicione sua lógica aqui
  };

  // Função que executa a animação de "shake" (pequeno balanço horizontal)
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  // Dispara a animação de shake de vez em quando enquanto a tela estiver ativa
  useEffect(() => {
    const interval = setInterval(() => {
      shake();
    }, 1000); // 1s entre cada shake - ajuste conforme necessário

    return () => clearInterval(interval);
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/bg_login.jpg')}
      style={[styles.container, { width, height }]}
      resizeMode="cover"
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        {/* Logo centralizada - Ajuste a propriedade 'height' para modificar o tamanho */}
        <Image
          source={require('../../assets/images/logo/logoA.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        {/* Texto de boas-vindas */}
        <View style={styles.textContainer}>
          <Text style={styles.mainText}>Colecione & negocie</Text>
          <Text style={styles.mainText}>com facilidade.</Text>
        <Text style={styles.subText}>Compre, venda e descubra cartas raras em um marketplace seguro e confiável para colecionadores.</Text>

        </View>

        {/* Botão transparente com animação */}
        <Animated.View style={[styles.button, { transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] }]}>
          <TouchableOpacity onPress={handleButtonPress} style={styles.buttonInner}>
            <Text style={styles.buttonText}>Começar Agora!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    opacity: 0.9, // Opacidade da imagem de fundo em 50%
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Ajuste o valor de 'height' para modificar o tamanho da logo
  // Aumentar o valor = logo maior | Diminuir o valor = logo menor
  logo: {
    height: '15%', // 1/3 da tela
    bottom: 80, // Ajuste a posição vertical da logo (negativo para subir, positivo para descer)
    aspectRatio: 1,
  },
  textContainer: {
    marginTop: 40,
    alignItems: 'flex-start',
    width: '100%',
    paddingLeft: 20,
  },
  mainText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'left',
    textShadowColor: '#636161',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subText: {
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'left',
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 2,
  },
  // Botão transparente com animação de escala
  // Ajustes de tamanho:
  // Aumente/diminua 'width' para aumentar/diminuir a largura (ex: '70%', '80%', '90%')
  // Aumente/diminua 'paddingVertical' para aumentar/diminuir a altura (ex: 12, 16, 20)
  // Aumente/diminua 'borderWidth' para aumentar/diminuir a borda (ex: 2, 3, 4)
  button: {
    position: 'absolute',
    bottom: 60, // Distância da parte de baixo (aumente para descer mais)
    width: '120%',
    alignItems: 'center',

},
  buttonInner: {
    width: '70%', // Largura do botão - Ajuste conforme necessário
    paddingVertical: 14, // Altura interna - Ajuste para mudar tamanho vertical
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Transparente (20% opacidade branca)
    borderWidth: 2, // Borda do botão - Ajuste conforme necessário
    borderColor: '#ffffff', // Cor da borda
    borderRadius: 25, // Cantos arredondados
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16, // Tamanho da fonte - Ajuste conforme necessário
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default IndexView;
