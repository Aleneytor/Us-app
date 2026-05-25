import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type SpeechRecognitionStartOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  maxAlternatives?: number;
  contextualStrings?: string[];
};

type SpeechModuleType = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  isRecognitionAvailable: () => boolean;
  start: (options: SpeechRecognitionStartOptions) => void;
  stop: () => void;
  addListener: (eventName: string, listener: (...args: any[]) => void) => { remove: () => void };
};

type SpeechEventPayloads = {
  start: void;
  end: void;
  result: { results: Array<{ transcript: string; isFinal?: boolean }> };
  error: { error: string; message: string };
};

const stub: SpeechModuleType = {
  requestPermissionsAsync: async () => ({ granted: false }),
  isRecognitionAvailable: () => false,
  start: () => {},
  stop: () => {},
  addListener: () => ({ remove: () => {} }),
};

let _module: SpeechModuleType = stub;
let _available = false;

// requireNativeModule throws at load time in Expo Go — catch it here
if (Platform.OS !== 'web') {
  try {
    const m = require('expo-speech-recognition');
    _module = m.ExpoSpeechRecognitionModule;
    _available = true;
  } catch {
    // Native module not compiled in (Expo Go or simulator without dev build)
  }
}

export const ExpoSpeechRecognitionModule = _module;
export const isSpeechRecognitionSupported = _available;

export function useSpeechRecognitionEvent<T extends keyof SpeechEventPayloads>(
  eventName: T,
  listener: (event: SpeechEventPayloads[T]) => void,
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!_available) return;
    try {
      const sub = _module.addListener(eventName, (event: any) => listenerRef.current(event));
      return () => sub.remove();
    } catch {
      // Subscription failed
    }
  }, [eventName]);
}
