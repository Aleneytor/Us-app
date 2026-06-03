import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const ONBOARDING_DONE_KEY = 'nosotros_onboarding_done';
const HINT_VOICE_KEY      = 'nosotros_hint_voice_seen';

export function useOnboardingDone() {
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((v) => setDone(v === '1'));
  }, []);
  return done;
}

export function useVoiceHintSeen() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(HINT_VOICE_KEY).then((v) => setSeen(v === '1'));
  }, []);
  const markSeen = () => {
    setSeen(true);
    void AsyncStorage.setItem(HINT_VOICE_KEY, '1');
  };
  return { seen, markSeen };
}
