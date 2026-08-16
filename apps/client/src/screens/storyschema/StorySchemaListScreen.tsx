import { Ionicons } from '@expo/vector-icons';
import { STORY_SCHEMA_ENTITY_TYPES, StorySchemaEntityType } from '@keres/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { StorySchemaFieldSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import { StorySchemaStackParamList } from '../../navigation/MainSystemStack';
import { createStorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';
import { StorySchemaFieldReorderModal } from '../../components/features/storyschema/StorySchemaFieldReorderModal/StorySchemaFieldReorderModal';

const ENTITY_TYPE_LABEL_KEYS: Record<StorySchemaEntityType, string> = {
  Character: 'characters_title',
  Location: 'locations_title',
  Item: 'items_title',
  Scene: 'scenes_title',
  Chapter: 'chapters_title',
  Note: 'notes_title',
  WorldRule: 'world_rules_title',
};

type StorySchemaListScreenNavigationProp = NativeStackNavigationProp<
  StorySchemaStackParamList,
  'StorySchemaList'
>;

const StorySchemaListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  useDocumentTitle(t('story_schema_management_title'));
  const { colors } = useTheme();
  const navigation = useNavigation<StorySchemaListScreenNavigationProp>();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();

  const [activeEntityType, setActiveEntityType] = useState<StorySchemaEntityType>('Character');
  const [isReorderModalVisible, setIsReorderModalVisible] = useState(false);
  const fields = useStorySchemaFields(storyId, activeEntityType);
  const { canEdit } = useStoryRole(storyId);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('story_schema_management_title') });
    }, [navigation, t]),
  );

  const commonContainerStyles = getCommonContainerStyles(colors);

  const styles = StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    description: {
      color: colors.textSecondary,
      marginBottom: 20,
    },
    tabsContainer: {
      flexGrow: 0,
      marginBottom: 10,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      color: colors.text,
      fontSize: 14,
    },
    tabTextActive: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    fieldName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    fieldMeta: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionButton: {
      padding: 8,
      marginLeft: 4,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 30,
    },
    fab: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      backgroundColor: colors.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
    },
  });

  const handleDelete = useCallback(
    (field: StorySchemaFieldSelect) => {
      AppAlert.alert(
        t('delete_attribute_title'),
        t('delete_attribute_message', { name: field.name }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              if (!userId) return;
              try {
                await createStorySchemaFieldService(drizzleDb).deleteField(userId, field.id);
              } catch (err) {
                console.error('Failed to delete attribute field:', err);
                AppAlert.alert(t('error'), t('failed_to_delete_attribute'));
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [drizzleDb, userId, t],
  );

  const handleReorderConfirm = useCallback(
    async (newOrder: { id: string; order: number }[]) => {
      if (!userId || !storyId) return;
      try {
        await createStorySchemaFieldService(drizzleDb).reorderFields(
          userId,
          storyId,
          activeEntityType,
          newOrder,
        );
        setIsReorderModalVisible(false);
      } catch (err) {
        console.error('Failed to reorder attribute fields:', err);
        AppAlert.alert(t('error'), t('failed_to_save_attribute'));
      }
    },
    [activeEntityType, drizzleDb, storyId, t, userId],
  );

  if (!storyId) {
    return (
      <View
        style={[
          commonContainerStyles.container,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Text style={{ color: colors.error }}>{t('no_story_selected')}</Text>
      </View>
    );
  }

  return (
    <View style={commonContainerStyles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.title}>{t('story_schema_management_title')}</Text>
        {canEdit && fields.length > 1 && (
          <TouchableOpacity
            accessibilityLabel={t('reorder_attributes_title')}
            style={styles.actionButton}
            onPress={() => setIsReorderModalVisible(true)}
          >
            <Ionicons name="swap-vertical" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.description}>{t('story_schema_management_description')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {STORY_SCHEMA_ENTITY_TYPES.map((entityType) => (
          <TouchableOpacity
            key={entityType}
            onPress={() => setActiveEntityType(entityType)}
            style={[styles.tab, activeEntityType === entityType && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeEntityType === entityType && styles.tabTextActive]}>
              {t(ENTITY_TYPE_LABEL_KEYS[entityType])}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={fields}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldName}>
                {item.name}
                {item.isRequired ? ' *' : ''}
              </Text>
              <Text style={styles.fieldMeta}>
                {item.key} · {t(`attribute_type_${item.type}`)}
              </Text>
            </View>
            {canEdit && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() =>
                    navigation.navigate('StorySchemaFieldForm', {
                      entityType: activeEntityType,
                      fieldId: item.id,
                    })
                  }
                >
                  <Ionicons name="pencil-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('no_custom_attributes')}</Text>}
      />

      {canEdit && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate('StorySchemaFieldForm', { entityType: activeEntityType })
          }
        >
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </TouchableOpacity>
      )}
      <StorySchemaFieldReorderModal
        isVisible={isReorderModalVisible}
        fields={fields}
        onClose={() => setIsReorderModalVisible(false)}
        onReorderConfirm={handleReorderConfirm}
      />
    </View>
  );
};

export default StorySchemaListScreen;
