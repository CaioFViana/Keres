import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { StoryArcSelect } from '@/src/db/schema';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { AppAlert } from '@/src/utils/AppAlert';
import { setDocumentTitle } from '@/src/utils/documentTitle';

const StoryArcListScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const { canEdit } = useStoryRole(story?.id);
  const { userId } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);
  const vocab = useStoryVocabulary();
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'StoryArcList'>>();
  const [arcs, setArcs] = useState<StoryArcSelect[]>([]);

  const reload = useCallback(async () => {
    if (!story?.id) return;
    const service = createStoryArcService(db);
    if (canEdit && userId) await service.ensureDefaultArc(userId, story.id);
    setArcs(await service.getArcsForStory(story.id));
  }, [canEdit, db, story?.id, userId]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('arcs_title'),
        headerRight: canEdit
          ? () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('StoryArcForm', {})}
                style={{ marginRight: 15 }}
                accessibilityLabel={t('add')}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )
          : undefined,
      });
      setDocumentTitle(t('arcs_title'));
      void reload();
    }, [canEdit, colors.text, navigation, reload, t]),
  );

  const handleDelete = (arc: StoryArcSelect) => {
    if (!userId) return;
    if (arc.isDefault) {
      notify(t('arc_delete_blocked', { arc: vocab.term('Arc') }), 'error');
      return;
    }
    AppAlert.alert(t('delete'), vocab.term('Arc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await createStoryArcService(db).deleteArc(userId, arc.id);
            await reload();
          } catch (error) {
            notify(
              error instanceof Error
                ? error.message
                : t('arc_delete_blocked', { arc: vocab.term('Arc') }),
              'error',
            );
          }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, padding: 14 },
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
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    badge: { fontSize: 12, color: colors.primary, marginTop: 2 },
    empty: { fontSize: 13, color: colors.textSecondary },
  });

  return (
    <ScrollView style={styles.root}>
      <Text style={styles.intro}>{t('arcs_intro', { arc: vocab.term('Arc') })}</Text>
      {arcs.map((arc) => (
        <TouchableOpacity
          key={arc.id}
          style={styles.card}
          onPress={() => canEdit && navigation.navigate('StoryArcForm', { arcId: arc.id })}
        >
          <Ionicons
            name={(arc.icon as keyof typeof Ionicons.glyphMap) || 'library'}
            size={22}
            color={arc.color || colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{arc.title}</Text>
            {arc.isDefault ? <Text style={styles.badge}>{t('arc_default_badge')}</Text> : null}
          </View>
          {canEdit && !arc.isDefault ? (
            <TouchableOpacity onPress={() => handleDelete(arc)} accessibilityLabel={t('delete')}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      ))}
      {arcs.length === 0 ? (
        <Text style={styles.empty}>{t('arcs_empty', { arc: vocab.term('Arc') })}</Text>
      ) : null}
    </ScrollView>
  );
};

export default StoryArcListScreen;
