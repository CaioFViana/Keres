import { Tag } from '@keres/shared/entities/Tag';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { TagsStackParamList } from '../../navigation/MainSystemStack'; // Import TagsStackParamList
import { createTagService } from '../../services/storymanagement/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type TagFormScreenRouteProp = RouteProp<TagsStackParamList, 'TagForm'>;

const TagFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<TagFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore()
  const { tagId } = route.params || {};
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const tagService = useCallback(() => createTagService(drizzleDb), [drizzleDb]);
  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();


  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const isEditing = !!tagId;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_tag_title') : t('create_tag_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_tag_title') : t('create_tag_title'),
        headerRight: () => <View/>
      });
    }, [navigation, isEditing, t])
  );

  useEffect(() => {
    const loadTag = async () => {
      if (!isEditing) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedTag = await tagService().getById(tagId!);
        if (fetchedTag) {
          setName(fetchedTag.name);
          setColor(fetchedTag.color || '');
          setIsFavorite(fetchedTag.isFavorite);
          setExtraNotes(fetchedTag.extraNotes);
        } else {
          console.warn('Tag not found:', tagId);
        }
      } catch (err) {
        console.error('Failed to load tag:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTag();
  }, [tagId, isEditing, tagService, t]);

  const handleSave = async () => {
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('tag_name_required'));
      return;
    }
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!selectedStory?.id) {
      AppAlert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setLoading(true);

    try {
      const tagData: Omit<Tag, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        name: name.trim(),
        color: color,
        isFavorite: isFavorite,
        extraNotes: extraNotes,
      };

      if (isEditing) {
        await tagService().updateTag(userId, tagId!, tagData);
        AppAlert.alert(t('success'), t('tag_updated_successfully'));
      } else {
        await tagService().createTag(userId, { ...tagData, storyId: selectedStory.id });
        AppAlert.alert(t('success'), t('tag_created_successfully'));
      }
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save tag:', err);
      AppAlert.alert(t('error'), t('failed_to_save_tag'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!tagId) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_tag_title',
      messageKey: 'delete_tag_message',
      successKey: 'tag_deleted_successfully',
      failureKey: 'failed_to_delete_tag',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await tagService().deleteTag(userId, tagId);
        navigation.goBack();
      },
    });
  };

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: scrollBottomPadding,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 15,
      marginBottom: 5,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 5,
    },
    saveButton: {
      marginTop: 20,
      marginBottom: 0,
    },
    deleteButton: {
      backgroundColor: 'red',
      marginBottom: 15
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_tag_title') : t('create_tag_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('tag_form_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('name')}</Text>
          <TextInput
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('color')}</Text>
          <ColorPickerInput
            placeholder={t('select_tag_color')}
            currentColor={color}
            onSelectColor={setColor}
            style={commonInputStyles.input}
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>{t('is_favorite')}</Text>
            <ThemedSwitch
              value={isFavorite}
              onValueChange={setIsFavorite}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}            multiline
          />

          <Button onPress={handleSave} style={styles.saveButton}>
            {isEditing ? t('save_changes') : t('create_tag')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_tag_title')}
            </Button>
          )}
    </KeyboardAwareScreen>
  );
};

export default TagFormScreen;
