import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

// Warm up the browser for better performance on Android
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync();
    }
    return () => {
      if (Platform.OS !== 'web') {
        void WebBrowser.coolDownAsync();
      }
    };
  }, []);
};

// Complete redirect sessions
WebBrowser.maybeCompleteAuthSession();

export default function ClerkAuthScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  // Warm up browser for Google OAuth redirects
  useWarmUpBrowser();

  const { signIn, isLoaded: signInLoaded, setActive: setSignInActive } = useSignIn() as any;
  const { signUp, isLoaded: signUpLoaded, setActive: setSignUpActive } = useSignUp() as any;
  const { startSSOFlow } = useSSO();

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Input focus states for micro-interactions
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  // Email verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  // Entry Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pendingVerification]); // Re-trigger on verification screen change for a fresh entrance

  const handleSignIn = async () => {
    console.log('[ClerkAuthScreen] handleSignIn called, signInLoaded:', signInLoaded);
    if (!signInLoaded) {
      Alert.alert('Espere', 'El servicio de autenticación de Clerk se está cargando. Inténtelo de nuevo.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Por favor rellene todos los campos');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
      } else {
        console.warn('Incomplete sign-in status:', result.status);
        setErrorMsg(`Estado incompleto: ${result.status}`);
      }
    } catch (err: any) {
      console.error('[ClerkAuthScreen] Sign In error details:', err);
      setErrorMsg(err.errors?.[0]?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log('[ClerkAuthScreen] handleSignUp called, signUpLoaded:', signUpLoaded);
    if (!signUpLoaded) {
      Alert.alert('Espere', 'El servicio de autenticación de Clerk se está cargando. Inténtelo de nuevo.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Por favor rellene todos los campos');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('[ClerkAuthScreen] Sign Up error details:', err);
      setErrorMsg(err.errors?.[0]?.message || 'Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    console.log('[ClerkAuthScreen] handleVerify called, signUpLoaded:', signUpLoaded);
    if (!signUpLoaded) return;

    if (!code) {
      setErrorMsg('Ingrese el código de verificación');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
      } else {
        console.warn('Incomplete sign-up verification status:', result.status);
        setErrorMsg(`Verificación incompleta: ${result.status}`);
      }
    } catch (err: any) {
      console.error('[ClerkAuthScreen] Verification error details:', err);
      setErrorMsg(err.errors?.[0]?.message || 'Código de verificación incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[ClerkAuthScreen] handleGoogleSignIn called');
    setLoading(true);
    setErrorMsg('');

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: any) {
      console.error('[ClerkAuthScreen] Google Sign In error details:', err);
      setErrorMsg(err.errors?.[0]?.message || 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  // Select background gradient depending on theme mode
  const bgColors = theme.mode === 'dark'
    ? (['#040407', '#0A0815', '#040407'] as const)
    : (['#F7F8FC', '#EFF1F7', '#E5E8F1'] as const);

  return (
    <LinearGradient colors={bgColors} style={styles.backgroundContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Outer Double-Bezel Frame */}
          <Animated.View
            style={[
              styles.outerCardFrame,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.innerCard}>
              {/* Logo & Header */}
              <View style={styles.headerArea}>
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>FINANZAS COMPARTIDAS</Text>
                </View>
                
                <View style={styles.logoRow}>
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.logoWrap}
                  >
                    <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.appName}>Juntos</Text>
                </View>
              </View>

              {!pendingVerification ? (
                <>
                  <Text style={styles.welcomeText}>
                    {isSignUpMode ? 'Crea tu cuenta compartida para empezar' : 'Controla tus finanzas en pareja sincronizados'}
                  </Text>

                  {/* Mode Toggle Switch */}
                  <View style={styles.toggleRow}>
                    <Pressable
                      style={styles.toggleBtn}
                      onPress={() => {
                        setIsSignUpMode(false);
                        setErrorMsg('');
                      }}
                    >
                      {!isSignUpMode && (
                        <LinearGradient
                          colors={['#7C3AED', '#4F46E5']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                      )}
                      <Text style={[styles.toggleText, !isSignUpMode && styles.toggleTextActive]}>
                        Iniciar Sesión
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.toggleBtn}
                      onPress={() => {
                        setIsSignUpMode(true);
                        setErrorMsg('');
                      }}
                    >
                      {isSignUpMode && (
                        <LinearGradient
                          colors={['#7C3AED', '#4F46E5']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                      )}
                      <Text style={[styles.toggleText, isSignUpMode && styles.toggleTextActive]}>
                        Registrarse
                      </Text>
                    </Pressable>
                  </View>

                  {/* Form */}
                  <View style={styles.form}>
                    {/* Email Input */}
                    <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={emailFocused ? '#7C3AED' : theme.textMuted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Correo electrónico"
                        placeholderTextColor={theme.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                      />
                    </View>

                    {/* Password Input */}
                    <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={passwordFocused ? '#7C3AED' : theme.textMuted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        placeholderTextColor={theme.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
                    </View>

                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Submit Button */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.submitBtn,
                        pressed && styles.btnPressed,
                      ]}
                      disabled={loading}
                      onPress={isSignUpMode ? handleSignUp : handleSignIn}
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#4F46E5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <View style={styles.submitBtnContent}>
                          <Text style={styles.submitText}>
                            {isSignUpMode ? 'Crear Cuenta' : 'Entrar'}
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </View>
                      )}
                    </Pressable>

                    {/* Google OAuth Button */}
                    <View style={styles.oauthContainer}>
                      <View style={styles.dividerRow}>
                        <View style={styles.line} />
                        <Text style={styles.dividerText}>o continuar con</Text>
                        <View style={styles.line} />
                      </View>

                      <Pressable
                        style={({ pressed }) => [
                          styles.googleBtn,
                          pressed && styles.btnPressed,
                        ]}
                        disabled={loading}
                        onPress={handleGoogleSignIn}
                      >
                        <Ionicons name="logo-google" size={18} color={theme.textPrimary} style={{ marginRight: 10 }} />
                        <Text style={styles.googleBtnText}>Iniciar con Google</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.form}>
                  <Pressable
                    style={styles.backBtn}
                    onPress={() => setPendingVerification(false)}
                  >
                    <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
                    <Text style={styles.backBtnText}>Volver</Text>
                  </Pressable>

                  <Text style={styles.verifyTitle}>Verifica tu cuenta</Text>
                  <Text style={styles.verifyDesc}>
                    Hemos enviado un código de verificación a tu correo:{'\n'}
                    <Text style={styles.verifyEmail}>{email}</Text>
                  </Text>

                  <View style={[styles.inputWrap, codeFocused && styles.inputWrapFocused]}>
                    <Ionicons
                      name="keypad-outline"
                      size={20}
                      color={codeFocused ? '#7C3AED' : theme.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Código de 6 dígitos"
                      placeholderTextColor={theme.textMuted}
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      onFocus={() => setCodeFocused(true)}
                      onBlur={() => setCodeFocused(false)}
                    />
                  </View>

                  {errorMsg ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [
                      styles.submitBtn,
                      pressed && styles.btnPressed,
                    ]}
                    disabled={loading}
                    onPress={handleVerify}
                  >
                    <LinearGradient
                      colors={['#7C3AED', '#4F46E5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.submitBtnContent}>
                        <Text style={styles.submitText}>Verificar Código</Text>
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (t: any) =>
  StyleSheet.create({
    backgroundContainer: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    keyboardContainer: {
      flex: 1,
      width: '100%',
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    outerCardFrame: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 32,
      padding: 6,
      backgroundColor: t.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderColor: t.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
      borderWidth: 1.5,
      ...Platform.select({
        web: {
          boxShadow: t.mode === 'dark'
            ? '0 20px 40px rgba(0, 0, 0, 0.45)'
            : '0 20px 40px rgba(15, 23, 42, 0.06)',
        } as any,
        default: {},
      }),
    },
    innerCard: {
      backgroundColor: t.mode === 'dark' ? 'rgba(12, 16, 23, 0.82)' : 'rgba(255, 255, 255, 0.96)',
      borderRadius: 27,
      paddingHorizontal: 24,
      paddingVertical: 28,
      gap: 20,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(20px)',
        } as any,
        default: {},
      }),
    },
    headerArea: {
      alignItems: 'center',
      gap: 10,
    },
    badgeWrap: {
      backgroundColor: t.mode === 'dark' ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.07)',
      borderColor: t.mode === 'dark' ? 'rgba(124, 58, 237, 0.22)' : 'rgba(124, 58, 237, 0.15)',
      borderWidth: 1,
      borderRadius: 99,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    badgeText: {
      color: '#8B5CF6',
      fontSize: 9,
      fontFamily: 'Poppins_600SemiBold',
      letterSpacing: 1.8,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    logoWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    appName: {
      color: t.textPrimary,
      fontSize: 28,
      fontFamily: 'Poppins_700Bold',
      letterSpacing: -0.5,
    },
    welcomeText: {
      color: t.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      fontFamily: 'Poppins_400Regular',
      paddingHorizontal: 10,
    },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: t.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: t.border,
      position: 'relative',
      overflow: 'hidden',
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      zIndex: 2,
      position: 'relative',
      overflow: 'hidden',
      height: 44,
    },
    toggleText: {
      color: t.textMuted,
      fontSize: 13.5,
      fontFamily: 'Poppins_500Medium',
    },
    toggleTextActive: {
      color: '#FFFFFF',
      fontFamily: 'Poppins_600SemiBold',
    },
    form: {
      gap: 14,
      width: '100%',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: t.border,
      borderWidth: 1.2,
      borderRadius: 16,
      backgroundColor: t.mode === 'dark' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.5)',
      paddingHorizontal: 14,
      height: 54,
    },
    inputWrapFocused: {
      borderColor: '#8B5CF6',
      backgroundColor: t.mode === 'dark' ? 'rgba(124, 90, 250, 0.04)' : 'rgba(124, 90, 250, 0.02)',
      ...Platform.select({
        web: {
          boxShadow: '0 0 0 3px rgba(124, 90, 250, 0.15)',
        } as any,
        default: {},
      }),
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: t.textPrimary,
      fontSize: 14.5,
      fontFamily: 'Poppins_500Medium',
      paddingVertical: 10,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.15)',
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      gap: 8,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      fontFamily: 'Poppins_500Medium',
      flex: 1,
    },
    submitBtn: {
      height: 52,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginTop: 8,
      position: 'relative',
    },
    submitBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      height: '100%',
      zIndex: 3,
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontFamily: 'Poppins_600SemiBold',
    },
    btnPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.92,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    backBtnText: {
      color: t.textSecondary,
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
    },
    verifyTitle: {
      color: t.textPrimary,
      fontSize: 18,
      fontFamily: 'Poppins_700Bold',
      textAlign: 'center',
    },
    verifyDesc: {
      color: t.textSecondary,
      fontSize: 12.5,
      fontFamily: 'Poppins_400Regular',
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 6,
    },
    verifyEmail: {
      color: '#8B5CF6',
      fontFamily: 'Poppins_600SemiBold',
    },
    oauthContainer: {
      marginTop: 10,
      gap: 14,
      alignItems: 'center',
      width: '100%',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: 8,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: t.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    },
    dividerText: {
      color: t.textMuted,
      fontSize: 11.5,
      fontFamily: 'Poppins_500Medium',
    },
    googleBtn: {
      height: 52,
      width: '100%',
      backgroundColor: t.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderColor: t.border,
      borderWidth: 1.2,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    googleBtnText: {
      color: t.textPrimary,
      fontSize: 14.5,
      fontFamily: 'Poppins_600SemiBold',
    },
  });
