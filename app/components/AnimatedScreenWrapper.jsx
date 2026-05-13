import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  SlideInRight,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS
} from "react-native-reanimated";
import { StyleSheet } from "react-native";

export default function AnimatedScreenWrapper({ children }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useFocusEffect(
    useCallback(() => {
      // Quando a tela entra em foco (dispara animação de entrada)
      opacity.value = withTiming(1, { duration: 400 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 90 });

      return () => {
        // Ao sair de foco, reseta os valores para animar na próxima vez
        opacity.value = 0;
        translateY.value = 20;
      };
    }, [])
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
      flex: 1,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});