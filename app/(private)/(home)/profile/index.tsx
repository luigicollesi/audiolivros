import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BASE_URL } from '@/constants/API';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatLanguageLabel, normalizeLanguage } from '@/i18n/translations';
import { setStatusBarBackgroundColor } from 'expo-status-bar';
import { useSoundFx } from '@/features/sound/SoundProvider';
import ClickPressable from '@/components/shared/ClickPressable';

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const {
    session,
    signOut,
    updateSessionUser,
    finishedDirty,
    acknowledgeFinished,
  } = useAuth();
  const { playTransition1, playClick } = useSoundFx();
  const { authedFetch } = useAuthedFetch();
  const { language: currentLanguage, setLanguage, availableLanguages, t } = useTranslation();

  const [languagePopoverVisible, setLanguagePopoverVisible] = useState(false);
  const [languageSubmitting, setLanguageSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [showCheckinOverlay, setShowCheckinOverlay] = useState(false);
  const checkinAnim = useRef(new Animated.Value(0)).current;
  const params = useLocalSearchParams<{ phoneUpdated?: string }>();
  const [emailCopied, setEmailCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  useFocusEffect(
    useCallback(() => {
      playTransition1();
    }, [playTransition1]),
  );

  const user = session?.user;
  const streakDays = (user?.days as number | undefined) ?? (user as any)?.streakDays ?? 0;
  const daysRead = (user?.daysRead as number | undefined) ?? (user as any)?.daysRead ?? 0;
  const mission = Boolean((user as any)?.mission);
  const booksRead = (user as any)?.booksRead ?? 0;
  const libraryCount = (user as any)?.libraryCount ?? 0;
  const unlockedCount = (user as any)?.unlockedCount ?? 0;
  const keyBalance = (user?.keys as number | undefined) ?? 0;
  const earnedKeys = (user?.earnedKeys as number | undefined) ?? 0;
  const userId = user?.id ?? '---';
  const supportEmail = 'suporte@audiolivros.com';

  const languageOptions = useMemo(
    () =>
      availableLanguages.map((code) => ({
        id: code,
        label: formatLanguageLabel(code),
      })),
    [availableLanguages],
  );

  const languageLabel = useMemo(() => {
    const current = normalizeLanguage(user?.language ?? currentLanguage);
    return formatLanguageLabel(current);
  }, [user?.language, currentLanguage]);

  const name = user?.name?.trim() || user?.email || t('profile.greeting');

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      toastAnim.setValue(0);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 1000);
    });
    },
    [toastAnim],
  );

  const handleSelectLanguage = useCallback(
    async (languageId: 'pt-BR' | 'en-US') => {
      if (languageSubmitting) return;
      const current = normalizeLanguage(user?.language ?? currentLanguage);
      if (languageId === current) {
        setLanguagePopoverVisible(false);
        return;
      }
      setLanguageSubmitting(true);
      try {
        const res = await authedFetch(`${BASE_URL}/account/language`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ languageId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || 'Não foi possível atualizar o idioma.');
        }
        updateSessionUser({ language: languageId });
        setLanguage(languageId);
        showToast(t('profile.languageUpdated'));
      } catch (err: any) {
        Alert.alert(t('profile.language'), String(err?.message || err || t('common.error')));
      } finally {
        setLanguageSubmitting(false);
        setLanguagePopoverVisible(false);
      }
    },
    [authedFetch, user?.language, languageSubmitting, setLanguage, t, currentLanguage, updateSessionUser, showToast],
  );

  useEffect(() => {
    const updated = params?.phoneUpdated;
    if (updated === '1' || updated === 'true') {
      showToast(t('profile.phoneUpdated') ?? 'Telefone atualizado com sucesso.');
      router.setParams?.({ phoneUpdated: undefined });
    }
  }, [params?.phoneUpdated, showToast, t, router]);

  const handleSignOut = useCallback(() => {
    playClick();
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmMessage'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () => {
          signOut();
        },
      },
    ]);
  }, [signOut, t, playClick]);

  const handleCopy = useCallback(
    async (value: string, label: string, setFlag: React.Dispatch<React.SetStateAction<boolean>>) => {
      playClick();
      try {
        await Clipboard.setStringAsync(value);
        showToast(t('profile.copied'));
        setFlag(true);
        setTimeout(() => setFlag(false), 2000);
      } catch {
        Alert.alert(label, t('common.error'));
      }
    },
    [t, showToast, playClick],
  );

  useEffect(() => {
    let cancelled = false;
    if (!finishedDirty) return;
    (async () => {
      try {
        const res = await authedFetch(`${BASE_URL}/account/counts`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data) return;
        if (cancelled) return;
        updateSessionUser({
          booksRead: data.finishedCount ?? data.booksRead ?? 0,
          finishedCount: data.finishedCount ?? 0,
        });
        if (finishedDirty) acknowledgeFinished();
      } catch {
        // silencioso; manterá o flag para tentar novamente
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, finishedDirty, acknowledgeFinished, updateSessionUser]);

  const openCheckin = useCallback(() => {
    playClick();
    setShowCheckinOverlay(true);
    checkinAnim.setValue(0);
    Animated.timing(checkinAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [checkinAnim, playClick]);

  const closeCheckin = useCallback(() => {
    playClick();
    Animated.timing(checkinAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setShowCheckinOverlay(false));
  }, [checkinAnim, playClick]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={isDark ? ['#0a0f1f', '#0c1b2e'] : ['#f7f4ff', '#eef2ff']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={{ backgroundColor: 'transparent' }}>
            <Text style={styles.greetingLabel}>{t('profile.title')}</Text>
            <Text style={styles.title}>{name}</Text>
          </View>
          <View style={styles.streakPill}>
            <MaterialCommunityIcons name="fire" size={18} color="#ff8a00" />
            <Text style={styles.streakText}>{daysRead}d</Text>
          </View>
        </View>

        <View style={styles.missionCard}>
          <View style={styles.missionIcon}>
            {mission ? (
              <Ionicons name="checkmark-done-circle" size={22} color="#d4af37" />
            ) : (
              <MaterialCommunityIcons name="file-document-outline" size={22} color="#d4af37" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.missionTitle}>
              {mission ? t('profile.missionDoneTitle') ?? 'Missão concluída' : t('profile.missionPendingTitle') ?? 'Missão diária'}
            </Text>
            <Text style={styles.missionSubtitle}>
              {mission
                ? t('profile.missionDoneSubtitle') ?? 'Você já completou a missão diária de leitura.'
                : t('profile.missionPendingSubtitle') ??
                  'Leia ou ouça um novo resumo hoje para ganhar +1 chave.'}
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroRow}>
              <Ionicons name="key-sharp" size={22} color={palette.background} />
              <Text style={styles.heroLabel}>{t('profile.keys')}</Text>
            </View>
            <Text style={styles.heroValue}>{keyBalance}</Text>
            <Text style={styles.heroSub}>{t('profile.keysHint')}</Text>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="book-open-page-variant" size={18} color={palette.text} />
              <Text style={styles.heroBadgeText}>
                {booksRead} {t('profile.booksRead')}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="library-shelves" size={18} color={palette.text} />
              <Text style={styles.heroBadgeText}>
                {libraryCount} {t('profile.inLibrary')}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="lock-open-variant" size={18} color={palette.text} />
              <Text style={styles.heroBadgeText}>
                {unlockedCount} {t('profile.unlocked')}
              </Text>
            </View>
          </View>
        </View>

        <ClickPressable style={styles.checkinButton} onPress={openCheckin}>
          <Ionicons name="gift" size={20} color={palette.background} />
          <Text style={styles.checkinText}>{t('profile.checkin')}</Text>
        </ClickPressable>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="at-circle" size={18} color={palette.tint} />
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>{t('profile.email')}</Text>
              <Text style={styles.infoValue}>{user?.email ?? t('profile.emailMissing')}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={18} color={palette.tint} />
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>{t('profile.phone')}</Text>
              <Text style={styles.infoValue}>{user?.phone ?? t('profile.phoneMissing')}</Text>
            </View>
            <ClickPressable
              style={styles.linkButton}
              onPress={() => {
                playClick();
                router.push('/(private)/(home)/profile/phone');
              }}
            >
              <Text style={styles.linkButtonText}>{t('profile.changePhone')}</Text>
            </ClickPressable>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="language" size={18} color={palette.tint} />
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>{t('profile.language')}</Text>
              <Pressable
                style={styles.languageButton}
                onPress={() => {
                  playClick();
                  setLanguagePopoverVisible((prev) => !prev);
                }}
                disabled={languageSubmitting}
              >
                {languageSubmitting ? (
                  <ActivityIndicator color={palette.tint} />
                ) : (
                  <Text style={styles.languageButtonText}>{languageLabel}</Text>
                )}
              </Pressable>
              {languagePopoverVisible && (
                <>
                  <ClickPressable
                    style={[StyleSheet.absoluteFillObject, styles.popoverOverlay]}
                    onPress={() => {
                      playClick();
                      setLanguagePopoverVisible(false);
                    }}
                  />
                  <View style={styles.popover}>
                    {languageOptions.map((option) => {
                      const selected = option.id === normalizeLanguage(user?.language ?? currentLanguage);
                      return (
                        <ClickPressable
                          key={option.id}
                          style={[
                            styles.popoverItem,
                            selected && styles.popoverItemSelected,
                          ]}
                          onPress={() => {
                            playClick();
                            handleSelectLanguage(option.id);
                          }}
                        >
                          <Text
                            style={[
                              styles.popoverItemText,
                              selected && styles.popoverItemTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </ClickPressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.supportTitle')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail-open-outline" size={18} color={palette.tint} />
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>{t('profile.support')}</Text>
              <Text style={styles.infoValue}>{supportEmail}</Text>
            </View>
            {emailCopied ? (
              <Text style={styles.linkButtonText}>{t('profile.copied')}</Text>
            ) : (
              <ClickPressable
                style={styles.linkButton}
                onPress={() => handleCopy(supportEmail, t('profile.support'), setEmailCopied)}
              >
                <Text style={styles.linkButtonText}>{t('profile.copy')}</Text>
              </ClickPressable>
            )}
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={18} color={palette.tint} />
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>{t('profile.userId')}</Text>
              <Text style={styles.infoValue}>{userId}</Text>
            </View>
            {idCopied ? (
              <Text style={styles.linkButtonText}>{t('profile.copied')}</Text>
            ) : (
              <ClickPressable
                style={styles.linkButton}
                onPress={() => handleCopy(userId, t('profile.userId'), setIdCopied)}
              >
                <Text style={styles.linkButtonText}>{t('profile.copy')}</Text>
              </ClickPressable>
            )}
          </View>
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.actionsRowInner}>
            <ClickPressable
              style={styles.secondaryButton}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={18} color={palette.tint} />
              <Text style={styles.secondaryButtonText}>{t('profile.signOut')}</Text>
            </ClickPressable>
            <ClickPressable
              style={styles.dangerButton}
              onPress={() => {
                playClick();
                router.push('/(private)/(home)/profile/delete');
              }}
            >
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.dangerButtonText}>{t('profile.delete')}</Text>
            </ClickPressable>
          </View>
        </View>
      </ScrollView>
      {showCheckinOverlay && (
        <Animated.View
          style={[
            styles.checkinOverlay,
            {
              opacity: checkinAnim,
            },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.checkinCard,
              {
                transform: [
                  {
                    translateY: checkinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                  {
                    scale: checkinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.checkinTitle}>{t('profile.streakTitle')}</Text>
            <View style={styles.streakRow}>
              {buildStreakNodes(streakDays).map((node, idx, arr) => (
                <Fragment key={`${node.day}-${idx}`}>
                  <View style={styles.streakItem}>
                    <View style={styles.streakKeyRow}>
                      <MaterialCommunityIcons name="key-variant" size={16} color={palette.detail} />
                      <Text style={styles.streakKeyText}>{node.reward}</Text>
                    </View>
                    <View style={[styles.streakNode, node.active && styles.streakNodeActive]}>
                      <Text style={[styles.streakNodeText, node.active && styles.streakNodeTextActive]}>
                        {node.day}
                      </Text>
                    </View>
                  </View>
                  {idx < arr.length - 1 && <View style={styles.streakConnector} />}
                </Fragment>
              ))}
            </View>
            <Pressable style={styles.closeButton} onPress={closeCheckin}>
              <Text style={styles.closeButtonText}>{t('profile.close')}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
      {toast && (
        <View pointerEvents="none" style={styles.toastContainer}>
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) => {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background, position: 'relative' },
    screen: {
      flexGrow: 1,
      padding: 20,
      gap: 16,
      paddingBottom: 40,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'transparent',
    },
    greetingLabel: {
      fontSize: 13,
      letterSpacing: 0.5,
      color: colors.detail,
      opacity: 0.8,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      gap: 6,
    },
    streakText: {
      fontWeight: '700',
      color: colors.text,
    },
    heroCard: {
      flexDirection: 'row',
      padding: 18,
      borderRadius: 18,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      gap: 16,
    },
    heroLeft: {
      flex: 1,
      backgroundColor: colors.tint,
      borderRadius: 14,
      padding: 14,
      justifyContent: 'center',
      gap: 4,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' },
    heroLabel: { fontSize: 14, fontWeight: '700', color: colors.background },
    heroValue: { fontSize: 36, fontWeight: '900', color: colors.background },
    heroSub: { color: colors.background, opacity: 0.85 },
    heroRight: {
      flex: 1,
      gap: 10,
      justifyContent: 'space-between',
      backgroundColor: 'transparent',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    heroBadgeText: {
      fontWeight: '700',
      color: colors.text,
      fontSize: 13,
      lineHeight: 16,
      flexShrink: 1,
      flex: 1,
    },
    checkinButton: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.tint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    checkinText: { color: colors.background, fontWeight: '800', fontSize: 15 },
    card: {
      borderRadius: 16,
      padding: 18,
      gap: 14,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bookCard,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
    },
    infoColumn: { flex: 1, gap: 2, backgroundColor: 'transparent' },
    infoLabel: {
      fontSize: 12,
      textTransform: 'uppercase',
      opacity: 0.6,
      letterSpacing: 0.6,
      color: colors.tint,
    },
    infoValue: { fontSize: 16, fontWeight: '600', color: colors.text },
    languageButton: {
      marginTop: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    languageButtonText: { fontSize: 14, fontWeight: '700', color: colors.tint },
    popoverOverlay: {
      position: 'absolute',
      backgroundColor: 'transparent',
      top: -2000,
      left: -2000,
      right: -2000,
      bottom: -2000,
    },
    popover: {
      position: 'absolute',
      top: 50,
      alignSelf: 'center',
      minWidth: 220,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: colors.background,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      gap: 8,
      zIndex: 50,
    },
    popoverItem: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    popoverItemSelected: {
      backgroundColor: colors.secondary,
      borderColor: colors.detail,
    },
    popoverItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    popoverItemTextSelected: { color: colors.background },
    actionsRow: {
      gap: 12,
      marginTop: 8,
      backgroundColor: 'transparent',
    },
    actionsRowInner: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: 'transparent',
    },
    primaryButton: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.tint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    primaryButtonText: { color: colors.background, fontWeight: '800', fontSize: 15 },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: colors.bookCard,
    },
    secondaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.tint },
    dangerButton: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#ef4444',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#b91c1c',
    },
    dangerButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    linkButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      backgroundColor: colors.bookCard,
    },
    linkButtonText: { fontSize: 13, fontWeight: '700', color: colors.tint },
    checkinOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    checkinCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 16,
      padding: 16,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      gap: 14,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    checkinTitle: { fontSize: 15, fontWeight: '800', color: colors.detail, textAlign: 'center' },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      backgroundColor: 'transparent',
    },
    streakItem: {
      backgroundColor: 'transparent',
      alignItems: 'center',
      gap: 6,
    },
    streakKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'transparent' },
    streakKeyText: { fontWeight: '700', color: colors.text },
    streakNode: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      alignItems: 'center',
      justifyContent: 'center',
    },
    streakNodeActive: {
      backgroundColor: '#22c55e',
      borderColor: '#22c55e',
    },
    streakNodeText: { 
      fontWeight: '800', 
      color: colors.tint, 
      fontSize: 14 
    },
    streakNodeTextActive: { color: colors.background },
    streakConnector: {
      flex: 1,
      height: 2,
      backgroundColor: colors.detail,
      marginHorizontal: 4,
    },
    closeButton: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
    },
    closeButtonText: { fontWeight: '800', color: colors.detail },
    toastContainer: {
      backgroundColor: 'transparent',
      position: 'absolute',
      opacity: 0.95,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    },
    toast: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(10, 16, 32, 0.83)' : 'rgba(15,23,42,0.82)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      maxWidth: 260,
      minWidth: 180,
    },
    toastText: { color: '#fff', textAlign: 'center', fontWeight: '700', opacity: 0.7 },
    missionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
      borderRadius: 14,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.detail,
      marginBottom: 12,
    },
    missionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    missionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    missionSubtitle: { fontSize: 13, color: colors.text, opacity: 0.8 },
  });
};

type StreakNode = { day: number; reward: number; active: boolean };

function buildStreakNodes(daysRaw: number): StreakNode[] {
  const days = Math.max(1, Math.floor(daysRaw || 0));
  const windowStart = Math.max(1, days - 2);
  const base = Array.from({ length: 5 }, (_, i) => windowStart + i);
  return base.map((day) => ({
    day,
    reward: keysForDay(day),
    active: day <= days,
  }));
}

function keysForDay(day: number): number {
  const d = Math.max(1, Math.floor(day || 1));
  if (d === 1) return 1;
  if (d <= 3) return 2;
  if (d <= 6) return 3;
  if (d <= 10) return 4;
  return 5;
}
