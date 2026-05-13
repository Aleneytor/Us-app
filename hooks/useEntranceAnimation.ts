import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useEntranceAnimation() {
  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(0)),
  ).current;

  useFocusEffect(
    useCallback(() => {
      heroAnim.setValue(0);
      contentAnim.setValue(0);
      headerAnim.setValue(0);
      itemAnims.forEach((a) => a.setValue(0));

      const anim = Animated.parallel([
        Animated.timing(heroAnim, {
          toValue: 1,
          duration: 320,
          delay: 0,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 420,
          delay: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 260,
          delay: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        ...itemAnims.map((itemAnim, i) =>
          Animated.timing(itemAnim, {
            toValue: 1,
            duration: 220,
            delay: 450 + i * 60,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ]);

      anim.start();
      return () => anim.stop();
    }, []),
  );

  return { heroAnim, contentAnim, headerAnim, itemAnims };
}
