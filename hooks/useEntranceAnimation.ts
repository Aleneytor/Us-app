import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '../store/useAppStore';

type ScrollToTopHandle = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
  scrollToLocation?: (options: { sectionIndex: number; itemIndex: number; animated?: boolean }) => void;
};

type EntranceAnimationOptions = {
  itemCount?: number;
  resetScrollOnFocus?: boolean;
  scrollRef?: RefObject<ScrollToTopHandle | null>;
  onResetScroll?: () => void;
};

function scrollToTop(ref?: RefObject<ScrollToTopHandle | null>) {
  const node = ref?.current;
  if (!node) return;

  requestAnimationFrame(() => {
    if (node.scrollToOffset) {
      node.scrollToOffset({ offset: 0, animated: false });
      return;
    }

    if (node.scrollTo) {
      node.scrollTo({ x: 0, y: 0, animated: false });
      return;
    }

    node.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false });
  });
}

export function useEntranceAnimation({
  itemCount = 32,
  resetScrollOnFocus = true,
  scrollRef,
  onResetScroll,
}: EntranceAnimationOptions = {}) {
  const currentUser = useAppStore((s) => s.currentUser);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(
    Array.from({ length: itemCount }, () => new Animated.Value(0)),
  ).current;

  const [focusCycle, setFocusCycle] = useState(0);
  const focusedRef = useRef(false);
  const prevUser = useRef(currentUser);
  const onResetScrollRef = useRef(onResetScroll);

  useEffect(() => {
    onResetScrollRef.current = onResetScroll;
  }, [onResetScroll]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (resetScrollOnFocus) {
        scrollToTop(scrollRef);
        onResetScrollRef.current?.();
      }
      setFocusCycle((cycle) => cycle + 1);

      return () => {
        focusedRef.current = false;
      };
    }, [resetScrollOnFocus, scrollRef]),
  );

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    const userChanged = prevUser.current !== currentUser;
    prevUser.current = currentUser;

    heroAnim.stopAnimation();
    contentAnim.stopAnimation();
    headerAnim.stopAnimation();
    itemAnims.forEach((itemAnim) => itemAnim.stopAnimation());

    if (focusCycle === 0 || !focusedRef.current) {
      heroAnim.setValue(0);
      contentAnim.setValue(0);
      headerAnim.setValue(0);
      itemAnims.forEach((itemAnim) => itemAnim.setValue(0));
      return undefined;
    }

    const isUserSwitch = userChanged && focusCycle > 1;
    if (!isUserSwitch) {
      heroAnim.setValue(0);
      contentAnim.setValue(0);
      headerAnim.setValue(0);
      itemAnims.forEach((itemAnim) => itemAnim.setValue(0));
    }

    anim = Animated.parallel([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: isUserSwitch ? 180 : 240,
        delay: 0,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: isUserSwitch ? 180 : 300,
        delay: isUserSwitch ? 0 : 45,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: isUserSwitch ? 180 : 260,
        delay: isUserSwitch ? 0 : 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...itemAnims.map((itemAnim, i) =>
        Animated.timing(itemAnim, {
          toValue: 1,
          duration: 210,
          delay: isUserSwitch ? 0 : 130 + Math.min(i, 14) * 24,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ]);

    anim.start();

    return () => {
      anim?.stop();
    };
  }, [contentAnim, currentUser, focusCycle, headerAnim, heroAnim, itemAnims]);

  return { heroAnim, contentAnim, headerAnim, itemAnims };
}
