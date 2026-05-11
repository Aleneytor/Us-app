import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { IconPicker } from '../components/IconPicker';
import { AppModal as Modal } from '../components/AppModal';
import { SAVING_ICON_KEYS } from '../constants/categories';
import { APP_COLORS } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Plan, PlanMember } from '../types';
import { MEMBER_COLORS } from '../types';
import { todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { getPartnerId, getUserData } from '../utils/users';

const PLAN_ACCENT = '#7C3AED';

interface PlanModalProps {
  visible: boolean;
  plan?: Plan | null;
  onClose: () => void;
}

export function PlanModal({ visible, plan, onClose }: PlanModalProps) {
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const addPlan = useAppStore((s) => s.addPlan);
  const updatePlan = useAppStore((s) => s.updatePlan);
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

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('map');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<PlanMember[]>([meMember]);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [splitPcts, setSplitPcts] = useState<Record<string, string>>({});
  const [externalName, setExternalName] = useState('');
  const [showAddExternal, setShowAddExternal] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(plan?.title ?? '');
    setIcon(plan?.icon ?? 'map');
    setDescription(plan?.description ?? '');
    setSplitMode(plan?.splitMode ?? 'equal');
    if (plan) {
      setMembers(plan.members);
      const pcts: Record<string, string> = {};
      for (const m of plan.members) {
        if (m.splitPct != null) pcts[m.id] = String(m.splitPct);
      }
      setSplitPcts(pcts);
    } else {
      setMembers([meMember]);
      setSplitPcts({});
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
    if (id === currentUser) return; // can't remove self
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const splitTotal = useMemo(() => {
    return Object.values(splitPcts).reduce((sum, v) => sum + (Number.parseFloat(v) || 0), 0);
  }, [splitPcts]);

  const save = () => {
    if (!title.trim()) {
      Alert.alert('Falta el nombre', 'Dale un nombre al plan.');
      return;
    }
    if (members.length === 0) {
      Alert.alert('Sin participantes', 'Agrega al menos un participante.');
      return;
    }
    if (splitMode === 'custom') {
      if (Math.abs(splitTotal - 100) > 0.5) {
        Alert.alert('Porcentajes incorrectos', `Los porcentajes deben sumar 100%. Actualmente suman ${splitTotal.toFixed(0)}%.`);
        return;
      }
    }

    const finalMembers: PlanMember[] = members.map((m) => ({
      ...m,
      splitPct: splitMode === 'custom' ? (Number.parseFloat(splitPcts[m.id] ?? '0') || 0) : undefined,
    }));

    const next: Plan = {
      id: plan?.id ?? Date.now(),
      title: title.trim(),
      icon,
      description: description.trim() || undefined,
      date: plan?.date ?? todayStr(),
      members: finalMembers,
      categories: plan?.categories ?? [],
      expenses: plan?.expenses ?? [],
      splitMode,
    };

    if (editing) updatePlan(next);
    else addPlan(next);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.keyboardView}>
        <Pressable style={[styles.backdrop, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
          <Pressable style={styles.cardShadow} onPressIn={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{editing ? 'Editar plan' : 'Nuevo plan'}</Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={dismissKeyboardAndBlur}
              >
                {/* Nombre */}
                <Field
                  label="Nombre del plan"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ej. Viaje a Amsterdam"
                  autoFocus
                />

                {/* Icono */}
                <View style={styles.field}>
                  <Text style={styles.label}>Ícono</Text>
                  <IconPicker
                    value={icon}
                    colorId="purple"
                    keys={SAVING_ICON_KEYS}
                    horizontalInset={16}
                    onChange={setIcon}
                  />
                </View>

                {/* Descripción */}
                <Field
                  label="Descripción (opcional)"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ej. Fin de semana en mayo con amigos"
                  multiline
                />

                {/* Participantes */}
                <View style={styles.field}>
                  <Text style={styles.label}>Participantes</Text>

                  <View style={styles.membersWrap}>
                    {/* Yo — siempre incluido */}
                    <MemberChip
                      member={meMember}
                      label="Tú"
                      locked
                      splitMode={splitMode}
                      splitPct={splitPcts[meMember.id] ?? ''}
                      onSplitChange={(v) => setSplitPcts((p) => ({ ...p, [meMember.id]: v }))}
                    />

                    {/* Pareja */}
                    {partnerId !== currentUser && (
                      <Pressable
                        onPress={togglePartner}
                        style={({ pressed }) => [
                          styles.memberChip,
                          isPartnerIncluded && styles.memberChipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: partnerMember.bg }]}>
                          <Text style={[styles.memberInitials, { color: partnerMember.color }]}>
                            {partnerMember.initials}
                          </Text>
                        </View>
                        <Text style={[styles.memberName, isPartnerIncluded && styles.memberNameActive]}>
                          {partnerMember.name}
                        </Text>
                        {isPartnerIncluded && splitMode === 'custom' && (
                          <TextInput
                            value={splitPcts[partnerMember.id] ?? ''}
                            onChangeText={(v) => setSplitPcts((p) => ({ ...p, [partnerMember.id]: v }))}
                            placeholder="0"
                            keyboardType="decimal-pad"
                            style={styles.splitInput}
                            onPressIn={(e) => e.stopPropagation()}
                          />
                        )}
                        {isPartnerIncluded && splitMode === 'custom' && (
                          <Text style={styles.splitPct}>%</Text>
                        )}
                        {!isPartnerIncluded && (
                          <Ionicons name="add" size={14} color={APP_COLORS.textMuted} />
                        )}
                      </Pressable>
                    )}

                    {/* Externos */}
                    {members.filter((m) => !m.uid).map((m) => (
                      <MemberChip
                        key={m.id}
                        member={m}
                        splitMode={splitMode}
                        splitPct={splitPcts[m.id] ?? ''}
                        onSplitChange={(v) => setSplitPcts((p) => ({ ...p, [m.id]: v }))}
                        onRemove={() => removeMember(m.id)}
                      />
                    ))}

                    {/* Agregar externo */}
                    {showAddExternal ? (
                      <View style={styles.externalForm}>
                        <TextInput
                          value={externalName}
                          onChangeText={setExternalName}
                          placeholder="Nombre de la persona"
                          placeholderTextColor={APP_COLORS.textMuted}
                          style={styles.externalInput}
                          autoFocus
                          onSubmitEditing={addExternal}
                          returnKeyType="done"
                        />
                        <Pressable onPress={addExternal} style={styles.externalAddBtn}>
                          <Text style={styles.externalAddText}>Agregar</Text>
                        </Pressable>
                        <Pressable onPress={() => { setShowAddExternal(false); setExternalName(''); }}>
                          <Ionicons name="close" size={18} color={APP_COLORS.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setShowAddExternal(true)}
                        style={({ pressed }) => [styles.addExternalBtn, pressed && styles.pressed]}
                      >
                        <Ionicons name="person-add-outline" size={15} color={PLAN_ACCENT} />
                        <Text style={styles.addExternalText}>Agregar persona</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Modo de división */}
                <View style={styles.field}>
                  <Text style={styles.label}>División de gastos</Text>
                  <View style={styles.segmented}>
                    <SegmentBtn
                      label="Partes iguales"
                      icon="people-outline"
                      active={splitMode === 'equal'}
                      onPress={() => setSplitMode('equal')}
                    />
                    <SegmentBtn
                      label="Porcentajes"
                      icon="pie-chart-outline"
                      active={splitMode === 'custom'}
                      onPress={() => setSplitMode('custom')}
                    />
                  </View>
                  {splitMode === 'custom' && (
                    <Text style={[styles.splitHint, Math.abs(splitTotal - 100) > 0.5 && styles.splitHintError]}>
                      Total: {splitTotal.toFixed(0)}% {Math.abs(splitTotal - 100) <= 0.5 ? '✓' : '(debe ser 100%)'}
                    </Text>
                  )}
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <Pressable onPress={() => runAfterKeyboardDismiss(onClose)} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={() => runAfterKeyboardDismiss(save)} style={styles.primaryBtn}>
                  <Text style={styles.primaryText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── MemberChip ───────────────────────────────────────────────────────────────

function MemberChip({
  member,
  label,
  locked,
  splitMode,
  splitPct,
  onSplitChange,
  onRemove,
}: {
  member: PlanMember;
  label?: string;
  locked?: boolean;
  splitMode: 'equal' | 'custom';
  splitPct: string;
  onSplitChange: (v: string) => void;
  onRemove?: () => void;
}) {
  return (
    <View style={[styles.memberChip, styles.memberChipActive]}>
      <View style={[styles.memberAvatar, { backgroundColor: member.bg }]}>
        <Text style={[styles.memberInitials, { color: member.color }]}>{member.initials}</Text>
      </View>
      <Text style={[styles.memberName, styles.memberNameActive]}>{label ?? member.name}</Text>
      {splitMode === 'custom' && (
        <>
          <TextInput
            value={splitPct}
            onChangeText={onSplitChange}
            placeholder="0"
            keyboardType="decimal-pad"
            style={styles.splitInput}
          />
          <Text style={styles.splitPct}>%</Text>
        </>
      )}
      {!locked && onRemove && (
        <Pressable onPress={onRemove} hitSlop={6}>
          <Ionicons name="close-circle" size={16} color={APP_COLORS.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// ─── SegmentBtn ───────────────────────────────────────────────────────────────

function SegmentBtn({
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.segmentBtn, active && styles.segmentBtnActive, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={active ? PLAN_ACCENT : APP_COLORS.textSecondary} />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={APP_COLORS.textMuted}
        style={[styles.input, props.multiline && styles.textarea]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  cardShadow: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 560,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  card: {
    backgroundColor: APP_COLORS.background,
    borderRadius: 22,
    maxHeight: '96%',
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  closeBtn: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  field: { gap: 7 },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
  input: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  // ── Members ──
  membersWrap: {
    gap: 8,
  },
  memberChip: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  memberChipActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C4B5FD',
  },
  memberAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  memberInitials: {
    fontSize: 11,
    fontWeight: '800',
  },
  memberName: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  memberNameActive: {
    color: APP_COLORS.textPrimary,
  },
  splitInput: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    color: PLAN_ACCENT,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    width: 48,
  },
  splitPct: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  addExternalBtn: {
    alignItems: 'center',
    borderColor: PLAN_ACCENT,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addExternalText: {
    color: PLAN_ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  externalForm: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  externalInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  externalAddBtn: {
    backgroundColor: PLAN_ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  externalAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // ── Segment ──
  segmented: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
  },
  segmentBtn: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: APP_COLORS.border,
    borderWidth: 1,
  },
  segmentText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: PLAN_ACCENT,
    fontWeight: '700',
  },
  splitHint: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  splitHintError: {
    color: APP_COLORS.expense,
  },
  // ── Footer ──
  footer: {
    backgroundColor: APP_COLORS.surface,
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  primaryBtn: {
    alignItems: 'center',
    backgroundColor: PLAN_ACCENT,
    borderRadius: 13,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '400',
  },
  pressed: { opacity: 0.72 },
});
