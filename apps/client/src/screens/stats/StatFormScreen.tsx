import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import ThemedSwitch from '../../components/common/controls/ThemedSwitch/ThemedSwitch';
import { ScreenLoading } from '../../components/common/feedback/ScreenState/ScreenState';
import TextInput from '../../components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '../../components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryStats } from '../../hooks/useStoryStats';
import type { StatsStackParamList } from '../../navigation/StatsStack';
import { createStatService } from '../../services/storymanagement/StatService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';

type StatFormNavigationProp = NativeStackNavigationProp<StatsStackParamList, 'StatForm'>;

const StatFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StatFormNavigationProp>();
  const route = useRoute<RouteProp<StatsStackParamList, 'StatForm'>>();
  const statId = route.params?.statId;
  const isEditing = !!statId;
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const data = useStoryStats(storyId);
  const scrollBottomPadding = useFormScrollBottomPadding();

  const [name, setName] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const title = isEditing ? t('stat_form_edit') : t('stat_form_new');
  useDocumentTitle(title);
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title });
    }, [navigation, title]),
  );

  useEffect(() => {
    if (!statId) return;
    const stat = data.stats.find((row) => row.id === statId);
    if (!stat) return;
    setName(stat.name);
    setIsPrimary(stat.isPrimary);
    setLoading(false);
  }, [data.stats, statId]);

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
        hint: { color: colors.textSecondary, marginBottom: 12 },
        switchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        ladderLink: {
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 14,
          marginBottom: 20,
        },
        ladderLinkTitle: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
        ladderLinkHint: { color: colors.textSecondary, marginTop: 4 },
      }),
    [colors],
  );

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('stat_name_required'));
      return;
    }
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!storyId) {
      AppAlert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setSaving(true);
    try {
      const service = createStatService(drizzleDb);
      if (isEditing) {
        await service.updateStat(userId, statId!, { name: name.trim(), isPrimary });
      } else {
        await service.createStat(userId, {
          storyId,
          name: name.trim(),
          isPrimary,
          order: data.stats.length,
        });
      }
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to save stat:', error);
      AppAlert.alert(t('error'), error?.message || t('stat_save_failed'));
    } finally {
      setSaving(false);
    }
  }, [
    data.stats.length,
    drizzleDb,
    isEditing,
    isPrimary,
    name,
    navigation,
    statId,
    storyId,
    t,
    userId,
  ]);

  if (loading) return <ScreenLoading padded message={t('loading')} />;

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 }}
    >
      <Text style={styles.label}>{t('name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('stat_name_placeholder')}
        style={commonInputStyles.input}
      />

      <View style={[styles.switchRow, { marginTop: 20 }]}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.label}>{t('stat_is_primary')}</Text>
          <Text style={styles.hint}>{t('stat_is_primary_hint')}</Text>
        </View>
        <ThemedSwitch value={isPrimary} onValueChange={setIsPrimary} />
      </View>

      {isEditing ? (
        <TouchableOpacity
          style={styles.ladderLink}
          onPress={() => navigation.navigate('StatLadder', { statId })}
        >
          <Text style={styles.ladderLinkTitle}>{t('stat_ladder_title')}</Text>
          <Text style={styles.ladderLinkHint}>{t('stat_ladder_own_hint')}</Text>
        </TouchableOpacity>
      ) : (
        // Sem id ainda não há a que prender a escada; ela é editada depois de salvar.
        <Text style={styles.hint}>{t('stat_ladder_after_save')}</Text>
      )}

      <Button onPress={handleSave} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </KeyboardAwareScreen>
  );
};

export default StatFormScreen;
