import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';
import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BASE_URL } from '@/constants/API';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatLanguageLabel, normalizeLanguage } from '@/i18n/translations';

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const { session, signOut, refreshSession } = useAuth();
  const { authedFetch } = useAuthedFetch();
  const { language: currentLanguage, setLanguage, availableLanguages, t } = useTranslation();

  const [languagePopoverVisible, setLanguagePopoverVisible] = useState(false);
  const [languageSubmitting, setLanguageSubmitting] = useState(false);

  const user = session?.user;

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
        await refreshSession();
        setLanguage(languageId);
        Alert.alert(t('profile.language'), t('profile.languageUpdated'));
      } catch (err: any) {
        Alert.alert(t('profile.language'), String(err?.message || err || t('common.error')));
      } finally {
        setLanguageSubmitting(false);
        setLanguagePopoverVisible(false);
      }
    },
    [authedFetch, refreshSession, user?.language, languageSubmitting, setLanguage, t, currentLanguage],
  );

  const handleSignOut = useCallback(() => {
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
  }, [signOut, t]);

  const name = user?.name?.trim() || user?.email || t('profile.greeting');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{name}</Text>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>{t('profile.email')}</Text>
            <Text style={styles.infoValue}>{user?.email ?? t('profile.emailMissing')}</Text>
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>{t('profile.phone')}</Text>
            <Text style={styles.infoValue}>{user?.phone ?? t('profile.phoneMissing')}</Text>
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>{t('profile.language')}</Text>
            <View style={styles.languageWrapper}>
              <Pressable
                style={styles.languageButton}
                onPress={() => setLanguagePopoverVisible((prev) => !prev)}
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
                  <Pressable
                    style={[StyleSheet.absoluteFillObject, styles.popoverOverlay]}
                    onPress={() => setLanguagePopoverVisible(false)}
                  />
                  <View style={styles.popover}>
                    {languageOptions.map((option) => {
                      const selected = option.id === normalizeLanguage(user?.language ?? currentLanguage);
                      return (
                        <Pressable
                          key={option.id}
                          style={[
                            styles.popoverItem,
                            selected && styles.popoverItemSelected,
                          ]}
                          onPress={() => handleSelectLanguage(option.id)}
                        >
                          <Text
                            style={[
                              styles.popoverItemText,
                              selected && styles.popoverItemTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(private)/profile/phone')}
          >
            <Text style={styles.primaryButtonText}>{t('profile.changePhone')}</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => router.push('/(private)/profile/delete')}
        >
          <Text style={styles.deleteButtonText}>{t('profile.delete')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

type Palette = typeof Colors.light;

const createStyles = (colors: Palette, isDark: boolean) => {
  const accent = colors.tint;
  const primaryTextColor = isDark ? '#000' : '#fff';
  const languageBackground = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(47,149,220,0.12)';

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 24,
      gap: 16,
    },
    card: {
      borderRadius: 16,
      padding: 20,
      gap: 18,
      backgroundColor: colors.bookCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.tabIconDefault,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
    },
    infoGroup: {
      gap: 4,
    },
    infoLabel: {
      fontSize: 12,
      textTransform: 'uppercase',
      opacity: 0.6,
      letterSpacing: 0.6,
      color: colors.text,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    languageWrapper: {
      position: 'relative',
      alignSelf: 'flex-start',
    },
    languageButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: accent,
      backgroundColor: languageBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    languageButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: accent,
    },
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
      borderColor: colors.tabIconDefault,
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
      borderColor: colors.tabIconDefault,
    },
    popoverItemSelected: {
      backgroundColor: accent,
      borderColor: accent,
    },
    popoverItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    popoverItemTextSelected: {
      color: primaryTextColor,
    },
    primaryButton: {
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: accent,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: primaryTextColor,
      fontWeight: '700',
      fontSize: 16,
    },
    signOutButton: {
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: accent,
      alignItems: 'center',
    },
    signOutText: {
      fontSize: 15,
      fontWeight: '600',
      color: accent,
    },
    deleteButton: {
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#ef4444',
      alignItems: 'center',
    },
    deleteButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
};
