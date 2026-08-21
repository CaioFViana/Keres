import { Ionicons } from '@expo/vector-icons';
import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ThemedSwitch from '../../components/common/controls/ThemedSwitch/ThemedSwitch';
import Select from '../../components/common/inputs/Select/Select';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryStats } from '../../hooks/useStoryStats';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { StatsStackParamList } from '../../navigation/StatsStack';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { useDocumentTitle } from '../../utils/documentTitle';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import type { StatNotation } from '../../utils/statLadder';
import { buildStatRanking } from '../../utils/statRanking';

type StatRankingNavigationProp = NativeStackNavigationProp<StatsStackParamList, 'StatRanking'>;

/**
 * A tier list: um status escolhido no topo e todo mundo da história ordenado por ele. Cada modo
 * conta como uma linha própria, para "Ilda" e "Ilda · Na tempestade" aparecerem lado a lado.
 */
const StatRankingScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StatRankingNavigationProp>();
  const route = useRoute<RouteProp<StatsStackParamList, 'StatRanking'>>();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const notation = (selectedStory?.statNotation ?? 'letter') as StatNotation;
  const data = useStoryStats(storyId);

  const [statId, setStatId] = useState<string | null>(route.params?.statId ?? null);
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [hideInherited, setHideInherited] = useState(false);

  useDocumentTitle(t('stat_ranking_title'));
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('stat_ranking_title') });
    }, [navigation, t]),
  );

  useEffect(() => {
    // Sem escolha ainda, começa pelo primeiro eixo - a tela nunca abre vazia à toa.
    if (!statId && data.stats.length > 0) setStatId(data.stats[0]!.id);
  }, [data.stats, statId]);

  const groups = useMemo(() => {
    if (!statId) return [];
    return buildStatRanking({
      characters: data.characters.map((character) => ({
        id: character.id,
        name: character.name,
      })),
      modes: data.modes.map((mode) => ({
        id: mode.id,
        characterId: mode.characterId,
        name: mode.name,
      })),
      values: data.valueIndex,
      statId,
      ladder: data.ladderOf(statId),
      notation,
      direction,
      hideInherited,
    });
  }, [data, direction, hideInherited, notation, statId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        controls: { gap: 10, paddingBottom: 12 },
        controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        statSelect: { flex: 1 },
        directionButton: {
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        directionLabel: { color: colors.text },
        switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        switchLabel: { color: colors.text, flex: 1, marginRight: 12 },
        sectionHeader: {
          backgroundColor: colors.background,
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: '700',
          paddingTop: 12,
          paddingBottom: 4,
          textTransform: 'uppercase',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        rowLabel: { color: colors.text, fontSize: 15, flexShrink: 1, paddingRight: 8 },
        rowValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
        inherited: { color: colors.textSecondary, fontWeight: '400' },
        empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 30 },
      }),
    [colors],
  );

  const sections = groups.map((group) => ({
    key: group.key,
    title: group.label ?? (group.key === 'none' ? t('stat_ranking_no_value') : ''),
    data: group.entries,
  }));

  const openCharacter = (characterId: string) =>
    navigateToEntityDetail(
      navigation.getParent() as unknown as DrawerNavigationProp<MainSystemDrawerParamList>,
      'Character',
      characterId,
    );

  return (
    <View style={getCommonContainerStyles(colors).container}>
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <View style={styles.statSelect}>
            <Select
              options={data.stats.map((stat) => ({ label: stat.name, value: stat.id }))}
              value={statId}
              onValueChange={setStatId}
              placeholder={t('stats_title')}
            />
          </View>
          <TouchableOpacity
            style={styles.directionButton}
            onPress={() => setDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
          >
            <Ionicons
              name={direction === 'desc' ? 'arrow-down' : 'arrow-up'}
              size={18}
              color={colors.text}
            />
            <Text style={styles.directionLabel}>
              {direction === 'desc'
                ? t('stat_ranking_direction_desc')
                : t('stat_ranking_direction_asc')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('stat_ranking_hide_inherited')}</Text>
          <ThemedSwitch value={hideInherited} onValueChange={setHideInherited} />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.key}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<Text style={styles.empty}>{t('stats_empty')}</Text>}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openCharacter(item.characterId)}>
            <Text style={styles.rowLabel} numberOfLines={2}>
              {item.label}
            </Text>
            <Text style={[styles.rowValue, item.inherited && styles.inherited]}>
              {item.display}
              {item.inherited ? ` · ${t('stat_inherited')}` : ''}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default StatRankingScreen;
