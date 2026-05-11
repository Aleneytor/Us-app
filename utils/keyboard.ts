import { useEffect, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';

export function dismissKeyboardAndBlur() {
  const focusedInput = TextInput.State.currentlyFocusedInput?.();
  if (focusedInput) {
    TextInput.State.blurTextInput(focusedInput);
  }
  Keyboard.dismiss();
}

export function runAfterKeyboardDismiss(action: () => void) {
  dismissKeyboardAndBlur();
  action();
}

export function useKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      if (hideTimer) clearTimeout(hideTimer);
      setKeyboardOpen(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      hideTimer = setTimeout(() => {
        setKeyboardOpen(false);
      }, 180);
    });

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardOpen;
}
