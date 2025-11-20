import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/shared/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/shared/useColorScheme';

export default function TermsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: palette.tint }]}>Termos e Política de Privacidade</Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          Estes termos descrevem as condições de uso do aplicativo Audiolivros. Ao utilizar o aplicativo, você concorda em
          seguir todas as regras de conduta estabelecidas, incluindo o uso responsável e o respeito às leis aplicáveis. O
          conteúdo fornecido é destinado apenas para uso pessoal e não comercial, salvo consentimento expresso.
        </Text>
        <Text style={[styles.subtitle, { color: palette.tint }]}>Privacidade</Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          Sua privacidade é importante. Coletamos informações mínimas necessárias para oferecer a melhor experiência,
          incluindo dados de autenticação e preferências. Essas informações não são compartilhadas com terceiros sem sua
          autorização, exceto quando necessário para cumprir obrigações legais.
        </Text>
        <Text style={[styles.paragraph, { color: palette.text }]}>
          Para mais detalhes, entre em contato com nossa equipe de suporte. Continuar utilizando o aplicativo significa
          aceitar estas condições.
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.descriptor, { color: palette.text }]}>
            Última atualização: {new Date().getFullYear()}
          </Text>
          <Text style={[styles.backButton, { color: palette.tint }]} onPress={() => router.back()}>
            Voltar
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  paragraph: { fontSize: 14, lineHeight: 22 },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  descriptor: { fontSize: 12, opacity: 0.7 },
  backButton: { fontSize: 16, fontWeight: '600' },
});
