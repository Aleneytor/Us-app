import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '../store/useAppStore';

export function useEntranceAnimation() {
  const currentUser = useAppStore((s) => s.currentUser);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(0)),
  ).current;

  const [isFocused, setIsFocused] = useState(false);
  const hasAnimated = useRef(false);
  const prevUser = useRef(currentUser);
  // When true, the next animation cycle was triggered by a user switch.
  // We keep content visible (no setValue(0)) to avoid a blank screen on web,
  // where Supabase fetches can take noticeably longer than on native.
  const pendingUserSwitch = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, []),
  );

  useEffect(() => {
    if (prevUser.current !== currentUser) {
      prevUser.current = currentUser;
      hasAnimated.current = false;
      pendingUserSwitch.current = true;
    }

    let anim: Animated.CompositeAnimation | null = null;

    if (isFocused) {
      if (!hasAnimated.current) {
        hasAnimated.current = true;
        const isSwitch = pendingUserSwitch.current;
        pendingUserSwitch.current = false;

        // User switch: content is already visible — don't flash to 0.
        // Initial load: start from 0 so the entrance animation is meaningful.
        if (!isSwitch) {
          heroAnim.setValue(0);
          contentAnim.setValue(0);
          headerAnim.setValue(0);
          itemAnims.forEach((a) => a.setValue(0));
        }

        // All animations must share the same useNativeDriver value to avoid
        // mixing drivers inside Animated.parallel, which can throw on web.
        anim = Animated.parallel([
          Animated.timing(heroAnim, {
            toValue: 1,
            duration: isSwitch ? 200 : 320,
            delay: 0,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentAnim, {
            toValue: 1,
            duration: isSwitch ? 200 : 420,
            delay: isSwitch ? 0 : 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(headerAnim, {
            toValue: 1,
            duration: isSwitch ? 200 : 260,
            delay: isSwitch ? 0 : 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          ...itemAnims.map((itemAnim, i) =>
            Animated.timing(itemAnim, {
              toValue: 1,
              duration: 220,
              delay: isSwitch ? 0 : 450 + i * 60,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ),
        ]);

        anim.start();
      }
    } else if (!hasAnimated.current && !pendingUserSwitch.current) {
      // Screen not focused yet and no user switch pending:
      // keep at 0 during the initial app load to avoid a content flash.
      heroAnim.setValue(0);
      contentAnim.setValue(0);
      headerAnim.setValue(0);
      itemAnims.forEach((a) => a.setValue(0));
    }

    return () => {
      if (anim) {
        anim.stop();
      }
    };
  }, [isFocused, currentUser]);

  return { heroAnim, contentAnim, headerAnim, itemAnims };
}
