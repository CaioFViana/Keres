import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WORLD_PIECE_SECTIONS, type WorldPieceSection } from '@keres/shared/entities/WorldRule';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import type { WorldRulesStackParamList } from '@/src/navigation/MainSystemStack';
import { useTheme } from '@/src/theme';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

const SECTION_ICONS: Record<WorldPieceSection, keyof typeof Ionicons.glyphMap> = {
  rule: 'shield-checkmark-outline',
  fauna: 'paw-outline',
  flora: 'leaf-outline',
  mythology: 'sparkles-outline',
  people: 'people-outline',
  knowledge: 'library-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

/** World drawer landing page. One common list keeps every section's CRUD and lifecycle identical. */
const WorldIndexScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<WorldRulesStackParamList, 'WorldIndex'>>();

  useScreenHeader({
    target: 'parent',
    title: t('world_title'),
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 14, paddingBottom: 40 },
        intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 10,
        },
        body: { flexGrow: 1, flexShrink: 1 },
        title: { fontSize: 16, fontWeight: '700', color: colors.text },
        description: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
      }),
    [colors],
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('world_index_description')}</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WorldRules')}>
          <Ionicons name="apps-outline" size={24} color={colors.primary} />
          <View style={styles.body}>
            <Text style={styles.title}>{term('WorldRule', true)}</Text>
            <Text style={styles.description}>{t('world_piece_section_all_description')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {WORLD_PIECE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section}
            style={styles.card}
            onPress={() => navigation.navigate('WorldRules', { section })}
          >
            <Ionicons name={SECTION_ICONS[section]} size={24} color={colors.primary} />
            <View style={styles.body}>
              <Text style={styles.title}>{t(`world_piece_section_${section}`)}</Text>
              <Text style={styles.description}>
                {t(`world_piece_section_${section}_description`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default WorldIndexScreen;
