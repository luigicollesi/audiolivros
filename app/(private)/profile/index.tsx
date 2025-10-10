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

const LANGUAGE_OPTIONS: Array<{ id: 'pt-BR' | 'en-US'; label: string }> = [
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'en-US', label: 'English (US)' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { session, signOut, refreshSession } = useAuth();
  const { authedFetch } = useAuthedFetch();

  const [languagePopoverVisible, setLanguagePopoverVisible] = useState(false);
  const [languageSubmitting, setLanguageSubmitting] = useState(false);

  const user = session?.user;

  const languageLabel = useMemo(() => {
    const current = user?.language ?? 'pt-BR';
    const option =
      LANGUAGE_OPTIONS.find((item) => item.id === current) ?? LANGUAGE_OPTIONS[0];
    return option.label;
  }, [user?.language]);

  const handleSelectLanguage = useCallback(
    async (languageId: 'pt-BR' | 'en-US') => {
      if (languageSubmitting) return;
      if (languageId === (user?.language as 'pt-BR' | 'en-US' | undefined)) {
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
        Alert.alert('Idioma atualizado', 'Suas preferências foram salvas.');
      } catch (err: any) {
        Alert.alert('Idioma', String(err?.message || err || 'Falha ao atualizar idioma.'));
      } finally {
        setLanguageSubmitting(false);
        setLanguagePopoverVisible(false);
      }
    },
    [authedFetch, refreshSession, user?.language, languageSubmitting],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          signOut();
        },
      },
    ]);
  }, [signOut]);

  const name = user?.name?.trim() || user?.email || 'Olá!';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.bookCard }]}>
          <Text style={styles.title}>{name}</Text>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email ?? 'Não informado'}</Text>
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Telefone</Text>
            <Text style={styles.infoValue}>{user?.phone ?? 'Não verificado'}</Text>
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Idioma preferido</Text>
            <View style={styles.languageWrapper}>
              <Pressable
                style={styles.languageButton}
                onPress={() => setLanguagePopoverVisible((prev) => !prev)}
                disabled={languageSubmitting}
              >
                {languageSubmitting ? (
                  <ActivityIndicator />
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
                  <View style={[styles.popover, { backgroundColor: theme.background }]}>
                    {LANGUAGE_OPTIONS.map((option) => {
                      const selected = option.id === user?.language;
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
            <Text style={styles.primaryButtonText}>Alterar telefone</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.signOutButton, { borderColor: theme.tint }]}
          onPress={handleSignOut}
        >
          <Text style={[styles.signOutText, { color: theme.tint }]}>Sair</Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => router.push('/(private)/profile/delete')}
        >
          <Text style={styles.deleteButtonText}>Excluir conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: 24,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  infoGroup: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    opacity: 0.6,
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
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
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
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
    borderColor: '#d1d5db',
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
    borderColor: '#d1d5db',
  },
  popoverItemSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  popoverItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  popoverItemTextSelected: {
    color: '#fff',
  },
  primaryButton: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  signOutButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
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
