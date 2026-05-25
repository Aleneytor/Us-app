import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';

interface ModalScreenProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  activeBreadcrumb?: number;
  onBreadcrumbPress?: (index: number) => void;
  canPressBreadcrumb?: (index: number) => boolean;
  accentColor?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: object;
}

export function ModalScreen({
  title,
  subtitle,
  breadcrumbs = [],
  activeBreadcrumb,
  onBreadcrumbPress,
  canPressBreadcrumb,
  accentColor = '#7C3AED',
  onBack,
  children,
  footer,
  headerRight,
  scroll = false,
  contentContainerStyle,
}: ModalScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const activeIndex = activeBreadcrumb ?? Math.max(0, breadcrumbs.length - 1);

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.contentFlex, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : <View style={styles.headerSpacer} />}
      </View>

      {breadcrumbs.length > 0 ? (
        <View style={styles.breadcrumbBar}>
          {breadcrumbs.map((item, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            const canPress = !!onBreadcrumbPress && (canPressBreadcrumb ? canPressBreadcrumb(index) : true);
            const crumbStyle = [styles.crumb, active && { backgroundColor: accentColor + '2E' }, done && { backgroundColor: accentColor }];
            const crumbTextStyle = [styles.crumbText, active && { color: accentColor }, done && styles.crumbDoneText];
            return (
              <View key={`${item}-${index}`} style={styles.crumbWrap}>
                {canPress ? (
                  <Pressable
                    onPress={() => onBreadcrumbPress?.(index)}
                    style={({ pressed }) => [crumbStyle, pressed && styles.pressed]}
                  >
                    <Text style={crumbTextStyle} numberOfLines={1}>{item}</Text>
                  </Pressable>
                ) : (
                  <View style={crumbStyle}>
                    <Text style={crumbTextStyle} numberOfLines={1}>{item}</Text>
                  </View>
                )}
                {index < breadcrumbs.length - 1 ? (
                  <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {body}

      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  breadcrumbBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  crumb: {
    backgroundColor: t.softSurface,
    borderRadius: 999,
    maxWidth: 132,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  crumbText: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  crumbDoneText: {
    color: '#FFFFFF',
  },
  crumbWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  content: {
    padding: 16,
  },
  contentFlex: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.68,
  },
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  subtitle: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  title: {
    color: t.textPrimary,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
});
