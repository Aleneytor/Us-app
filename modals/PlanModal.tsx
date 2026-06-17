import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { IconPicker } from '../components/IconPicker';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { SAVING_ICON_KEYS } from '../constants/categories';
import { type AppTheme } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Plan, PlanMember } from '../types';
import { MEMBER_COLORS } from '../types';
import { todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { getPartnerId, getUserData } from '../utils/users';

const PLAN_ACCENT = '#7C3AED';

interface PlanModalProps {
  visible: boolean;
  plan?: Plan | null;
  onClose: () => void;
}

export function PlanModal({ visible, plan, onClose }: PlanModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const addPlan = useAppStore((s) => s.addPlan);
  const updatePlan = useAppStore((s) => s.updatePlan);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const partnerId = getPartnerId(partnerForUser, currentUser);
  const meData = getUserData(users, currentUser);
  const partnerData = getUserData(users, partnerId);

  const meMember: PlanMember = {
    id: currentUser,
    uid: currentUser,
    name: meData.name,
    initials: meData.initials,
    color: meData.color,
    bg: meData.bg,
  };

  const partnerMember: PlanMember = {
    id: partnerId,
    uid: partnerId as any,
    name: partnerData.name,
    initials: partnerData.initials,
    color: partnerData.color,
    bg: partnerData.bg,
  };

  const editing = !!plan;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<PlanMember[]>([meMember]);
  const [externalName, setExternalName] = useState('');
  const [showAddExternal, setShowAddExternal] = useState(false);
  const [icon, setIcon] = useState('map');
  const [iconColor, setIconColor] = useState('purple');

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setTitle(plan?.title ?? '');
    setDescription(plan?.description ?? '');
    setIcon(plan?.icon ?? 'map');
    setIconColor(plan?.iconColor ?? 'purple');
    if (plan) {
      setMembers(plan.members);
    } else {
      setMembers([meMember]);
    }
    setExternalName('');
    setShowAddExternal(false);
  }, [visible, plan]);

  const isPartnerIncluded = members.some((m) => m.id === partnerId);

  const togglePartner = () => {
    if (isPartnerIncluded) {
      setMembers((prev) => prev.filter((m) => m.id !== partnerId));
    } else {
      setMembers((prev) => [...prev, partnerMember]);
    }
  };

  const addExternal = () => {
    const name = externalName.trim();
    if (!name) return;
    const idx = members.filter((m) => !m.uid).length % MEMBER_COLORS.length;
    const colorSet = MEMBER_COLORS[idx];
    const initials = name.slice(0, 2).toUpperCase();
    const newMember: PlanMember = {
      id: `ext_${Date.now()}`,
      name,
      initials,
      color: colorSet.color,
      bg: colorSet.bg,
    };
    setMembers((prev) => [...prev, newMember]);
    setExternalName('');
    setShowAddExternal(false);
  };

  const removeMember = (id: string) => {
    if (id === currentUser) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const validateStep0 = () => {
    if (!title.trim()) {
      Alert.alert('Falta el nombre', 'Dale un nombre al plan.');
      return false;
    }
    return true;
  };

  const validateStep1 = () => {
    if (members.length === 0) {
      Alert.alert('Sin participantes', 'Agrega al menos un participante.');
      return false;
    }
    return true;
  };

  const handlePrimary = () => {
    runAfterKeyboardDismiss(() => {
      if (step === 0) {
        if (validateStep0()) setStep(1);
      } else if (step === 1) {
        if (validateStep1()) setStep(2);
      } else {
        save();
      }
    });
  };

  const handleSecondary = () => {
    dismissKeyboardAndBlur();
    if (step > 0) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    dismissKeyboardAndBlur();
    if (step > 0) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const save = () => {
    if (!validateStep0()) { setStep(0); return; }
    if (!validateStep1()) { setStep(1); return; }

    const next: Plan = {
      id: plan?.id ?? Date.now(),
      title: title.trim(),
      icon,
      iconColor,
      description: description.trim() || undefined,
      date: plan?.date ?? todayStr(),
      members,
      categories: plan?.categories ?? [],
      expenses: plan?.expenses ?? [],
      settlements: plan?.settlements ?? [],
      splitMode: plan?.splitMode ?? 'equal',
      budget: plan?.budget,
      finalizedAt: plan?.finalizedAt,
    };

    if (editing) updatePlan(next);
    else addPlan(next);
    onClose();
  };

  const primaryLabel = step === 2 ? 'Guardar' : 'Continuar';
  const secondaryLabel = step === 0 ? 'Cancelar' : 'Atrás';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleBack}>
      <ModalScreen
        title={editing ? 'Editar plan' : 'Nuevo plan'}
        breadcrumbs={['Plan', 'Participantes', 'Estilo']}
        activeBreadcrumb={step}
        canPressBreadcrumb={(index) => index < step}
        onBreadcrumbPress={setStep}
        onBack={handleBack}
        accentColor="#7C3AED"
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <>
            <Pressable onPress={handleSecondary} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
            <Pressable onPress={handlePrimary} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            </Pressable>
          </>
        )}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboardAndBlur}
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <View style={styles.block}>
              <View style={styles.field}>
                <Text style={styles.label}>Información del Plan</Text>
                <View style={styles.detailList}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>Nombre del plan</Text>
                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ej. Viaje a Ámsterdam"
                        placeholderTextColor={theme.textMuted}
                        numberOfLines={1}
                        style={styles.detailInput}
                      />
                    </View>
                  </View>
                  <View style={styles.separator} />
                  <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>Descripción (opcional)</Text>
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Ej. Fin de semana en mayo con amigos"
                        placeholderTextColor={theme.textMuted}
                        numberOfLines={2}
                        style={[styles.detailInput, styles.detailTextarea]}
                        multiline
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.block}>
              <View style={styles.field}>
                <Text style={styles.label}>Participantes</Text>
                <View style={styles.detailList}>
                  <MemberChip
                    member={meMember}
                    label="Tú"
                    locked
                  />

                  {partnerId !== currentUser && (
                    <>
                      <View style={styles.separator} />
                      {isPartnerIncluded ? (
                        <MemberChip
                          member={partnerMember}
                          onRemove={togglePartner}
                        />
                      ) : (
                        <Pressable
                          onPress={togglePartner}
                          style={({ pressed }) => [
                            styles.memberRow,
                            styles.memberRowInactive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.memberAvatar, { backgroundColor: partnerMember.bg, opacity: 0.6 }]}>
                            <Text style={[styles.memberInitials, { color: partnerMember.color }]}>
                              {partnerMember.initials}
                            </Text>
                          </View>
                          <Text style={styles.memberNameInactiveText}>
                            Incluir a {partnerMember.name}
                          </Text>
                          <Ionicons name="add-circle-outline" size={18} color={PLAN_ACCENT} />
                        </Pressable>
                      )}
                    </>
                  )}

                  {members.filter((m) => !m.uid).map((m) => (
                    <View key={m.id}>
                      <View style={styles.separator} />
                      <MemberChip
                        member={m}
                        onRemove={() => removeMember(m.id)}
                      />
                    </View>
                  ))}
                </View>

                {showAddExternal ? (
                  <View style={styles.externalForm}>
                    <TextInput
                      value={externalName}
                      onChangeText={setExternalName}
                      placeholder="Nombre de la persona"
                      placeholderTextColor={theme.textMuted}
                      numberOfLines={1}
                      style={styles.externalInput}
                      autoFocus
                      onSubmitEditing={addExternal}
                      returnKeyType="done"
                    />
                    <Pressable onPress={addExternal} style={({ pressed }) => [styles.externalAddBtn, pressed && styles.pressed]}>
                      <Text style={styles.externalAddText}>Agregar</Text>
                    </Pressable>
                    <Pressable onPress={() => { setShowAddExternal(false); setExternalName(''); }} style={({ pressed }) => pressed && styles.pressed}>
                      <Ionicons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowAddExternal(true)}
                    style={({ pressed }) => [styles.addExternalBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="person-add-outline" size={15} color={PLAN_ACCENT} />
                    <Text style={styles.addExternalText}>Agregar persona externa</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.block}>
              <View style={styles.field}>
                <Text style={styles.label}>Ícono</Text>
                <View style={styles.pickerCard}>
                  <IconPicker
                    value={icon}
                    colorId={iconColor}
                    keys={SAVING_ICON_KEYS}
                    horizontalInset={16}
                    onChange={setIcon}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Color</Text>
                <View style={styles.pickerCard}>
                  <ColorPicker value={iconColor} onChange={setIconColor} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

function MemberChip({
  member,
  label,
  locked,
  onRemove,
}: {
  member: PlanMember;
  label?: string;
  locked?: boolean;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatar, { backgroundColor: member.bg }]}>
        <Text style={[styles.memberInitials, { color: member.color }]}>{member.initials}</Text>
      </View>
      <Text style={styles.memberName}>{label ?? member.name}</Text>
      {!locked && onRemove && (
        <Pressable onPress={onRemove} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
          <Ionicons name="close-circle" size={18} color={theme.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

function ChoiceButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceBtn,
        active && styles.choiceBtnActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : theme.textSecondary} />
      <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  block: {
    gap: 16,
  },
  field: { gap: 8 },
  label: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  pickerCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    width: '100%',
    overflow: 'hidden',
  },
  detailList: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  detailLabel: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  detailInput: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    minHeight: 32,
    padding: 0,
  },
  detailTextarea: {
    lineHeight: 20,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  separator: {
    backgroundColor: t.border,
    height: 1,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  memberRowInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
  },
  memberAvatar: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  memberInitials: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberName: {
    color: t.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  memberNameInactiveText: {
    color: t.textSecondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  splitInputWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginRight: 4,
  },
  splitInput: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 8,
    borderWidth: 1,
    color: PLAN_ACCENT,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    width: 52,
  },
  splitPct: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  addExternalBtn: {
    alignItems: 'center',
    borderColor: PLAN_ACCENT,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 4,
    paddingHorizontal: 16,
  },
  addExternalText: {
    color: PLAN_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  externalForm: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  externalInput: {
    color: t.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    padding: 0,
  },
  externalAddBtn: {
    backgroundColor: PLAN_ACCENT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  externalAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceBtn: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  choiceBtnActive: {
    backgroundColor: PLAN_ACCENT,
    borderColor: PLAN_ACCENT,
  },
  choiceBtnText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  splitHint: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
  splitHintError: {
    color: t.expense,
  },
  primaryBtn: {
    alignItems: 'center',
    backgroundColor: PLAN_ACCENT,
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignItems: 'center',
    backgroundColor: t.mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.075)',
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  secondaryText: {
    color: t.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: { opacity: 0.65 },
});
