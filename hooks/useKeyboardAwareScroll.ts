import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';

export function useKeyboardAwareScroll(minBottomPadding = 260) {
  const scrollRef = useRef<ScrollView>(null);
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollOnce = (delay = 60) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      timerRef.current = null;
    }, delay);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      if (focusedRef.current) scrollOnce();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      focusedRef.current = false;
      setFocused(false);
      setKeyboardHeight(0);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onFocus = () => {
    focusedRef.current = true;
    setFocused(true);
    if (keyboardHeight > 0) scrollOnce();
  };

  const onBlur = () => {
    focusedRef.current = false;
    setFocused(false);
  };

  const bottomPadding = focused ? Math.max(minBottomPadding, keyboardHeight + 24) : undefined;

  return { scrollRef, bottomPadding, onFocus, onBlur };
}
