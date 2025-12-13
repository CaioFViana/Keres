import { Ionicons } from '@expo/vector-icons';
import { StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { TagsStackParamList } from '../../navigation/MainSystemStack'; // Import TagsStackParamList
import { createTagService } from '../../services/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';

const TagFormScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { tagId } = (route.params as TagsStackParamList['TagForm']) || {};

  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const userId = useUserSettingsStore.getState().userId; // Get userId from the store

  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const tagService = createTagService(drizzleDb);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      marginBottom: 15,
    },
    buttonContainer: {
      marginTop: 20,
    },
  });

  useEffect(() => {
    if (tagId) {
      setIsEditing(true);
      const fetchTag = async () => {
        try {
          const tag = await drizzleDb.query.tags.findFirst({
            where: (tags, { eq }) => eq(tags.id, tagId),
          });
          if (tag) {
            setTagName(tag.name);
            setTagColor(tag.color || '');
          } else {
            Alert.alert(t('error'), t('tag_not_found'));
            navigation.goBack();
          }
        } catch (error) {
          console.error('Failed to fetch tag:', error);
          Alert.alert(t('error'), t('failed_to_load_tag'));
          navigation.goBack();
        } finally {
          setLoading(false);
        }
      };
      fetchTag();
    } else {
      setIsEditing(false);
      setLoading(false);
    }
  }, [tagId, drizzleDb, navigation, t]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        headerTitle: isEditing ? t('edit_tag') : t('create_tag'),
        headerRight: () => (
          isEditing && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  t('delete_tag_title'),
                  t('delete_tag_message'),
                  [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('delete'),
                      onPress: async () => {
                        if (!userId || !selectedStory?.id) {
                          Alert.alert(t('error'), t('user_story_not_found'));
                          return;
                        }
                        try {
                          await tagService.deleteTag(userId, tagId!);
                          entityEventEmitter.emit('tag_changed', selectedStory.id);
                          navigation.dispatch(StackActions.popToTop()); // Go back to Tags list
                        } catch (error) {
                          console.error('Failed to delete tag:', error);
                          Alert.alert(t('error'), t('failed_to_delete_tag'));
                        }
                      },
                    },
                  ],
                  { cancelable: true }
                );
              }}
              style={{ marginRight: 15 }}
            >
              <Ionicons name="trash-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          )
        ),
      });
    }, [navigation, isEditing, tagId, userId, selectedStory?.id, tagService, colors.text, t])
  );

  const handleSave = useCallback(async () => {
    if (!tagName.trim()) {
      Alert.alert(t('error'), t('tag_name_required'));
      return;
    }
    if (!selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('story_user_not_found'));
      return;
    }

    try {
      if (isEditing && tagId) {
        await tagService.updateTag(userId, tagId, { name: tagName, color: tagColor });
        Alert.alert(t('success'), t('tag_updated_successfully'));
      } else {
        await tagService.createTag(userId, { name: tagName, color: tagColor, storyId: selectedStory.id });
        Alert.alert(t('success'), t('tag_created_successfully'));
      }
      entityEventEmitter.emit('tag_changed', selectedStory.id);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save tag:', error);
      Alert.alert(t('error'), t('failed_to_save_tag'));
    }
  }, [tagName, tagColor, isEditing, tagId, selectedStory?.id, userId, tagService, navigation, t]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        placeholder={t('enter_tag_name')}
        value={tagName}
        onChangeText={setTagName}
        style={styles.input}
      />
      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>
          {isEditing ? t('save_changes') : t('create_tag')}
        </Button>
      </View>
    </View>
  );
};

export default TagFormScreen;
