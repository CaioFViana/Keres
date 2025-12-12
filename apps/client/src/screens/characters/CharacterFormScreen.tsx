import { Character } from '@keres/shared/entities/Character';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import SuggestionTextInput from '../../components/common/SuggestionTextInput/SuggestionTextInput';
import TextInput from '../../components/common/TextInput/TextInput'; // Custom TextInput
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { CharacterStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createCharacterService } from '../../services/CharacterService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';


type CharacterFormScreenRouteProp = RouteProp<CharacterStackParamList, 'CharacterForm'>;

const CharacterFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const drawerNavigation = useNavigation<DrawerNavigationProp<MainSystemDrawerParamList>>();
  const route = useRoute<CharacterFormScreenRouteProp>();
  const { characterId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const characterService = useCallback(() => createCharacterService(drizzleDb), [drizzleDb]);

  const [name, setName] = useState('');
  const [title, setTitle] = useState<string | null>(null); // Added title state
  const [description, setDescription] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [race, setRace] = useState<string | null>(null);
  const [subrace, setSubrace] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string | null>(null);
  const [weaknesses, setWeaknesses] = useState<string | null>(null);
  const [biography, setBiography] = useState<string | null>(null);
  const [plannedTimeline, setPlannedTimeline] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const isEditing = !!characterId;

  useFocusEffect(
    useCallback(() => {
      drawerNavigation.getParent()?.setOptions({
        title: isEditing ? t('edit_character_title') : t('create_character_title'),
      });
    }, [drawerNavigation, isEditing, t])
  );

  useEffect(() => {
    const loadCharacter = async () => {
      if (!isEditing) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedCharacter = await characterService().getById(characterId!);
        if (fetchedCharacter) {
          setName(fetchedCharacter.name);
          setTitle(fetchedCharacter.title);
          setDescription(fetchedCharacter.description);
          setGender(fetchedCharacter.gender);
          setRace(fetchedCharacter.race);
          setSubrace(fetchedCharacter.subrace);
          setPersonality(fetchedCharacter.personality);
          setMotivation(fetchedCharacter.motivation);
          setQualities(fetchedCharacter.qualities);
          setWeaknesses(fetchedCharacter.weaknesses);
          setBiography(fetchedCharacter.biography);
          setPlannedTimeline(fetchedCharacter.plannedTimeline);
          setIsFavorite(fetchedCharacter.isFavorite);
          setExtraNotes(fetchedCharacter.extraNotes);
        } else {
          setError(t('character_not_found'));
        }
      } catch (err) {
        console.error('Failed to load character:', err);
        setError(t('failed_to_load_character'));
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
  }, [characterId, isEditing, characterService, t]);


  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!selectedStory?.id) {
      Alert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const characterData: Omit<Character, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        name: name.trim(),
        title: title ? title.trim() : null,
        description,
        gender,
        race,
        subrace,
        personality,
        motivation,
        qualities,
        weaknesses,
        biography,
        plannedTimeline,
        isFavorite,
        extraNotes,
      };

      if (isEditing) {
        await characterService().updateCharacter(userId, characterId!, characterData);
        Alert.alert(t('success'), t('character_updated_successfully'));
      } else {
        await characterService().createCharacter(userId, { ...characterData, storyId: selectedStory.id });
        Alert.alert(t('success'), t('character_created_successfully'));
      }
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save character:', err);
      setError(t('failed_to_save_character'));
      Alert.alert(t('error'), t('failed_to_save_character'));
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: 350,
      flexGrow: 1,
    },    title: {
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
      marginTop: 30,
      marginBottom: 20,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_character_title') : t('create_character_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('character_form_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('name')}</Text>
          <TextInput
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
          <TextInput
            placeholder={t('description_placeholder')}
            value={description || ""}
            onChangeText={setDescription}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('gender')}</Text>
          <SuggestionTextInput
            placeholder={t('gender_placeholder')}
            value={gender || ""}
            onChangeText={setGender}
            type="character_gender"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('race')}</Text>
          <SuggestionTextInput
            placeholder={t('race_placeholder')}
            value={race || ""}
            onChangeText={setRace}
            type="character_race"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('subrace')}</Text>
          <SuggestionTextInput
            placeholder={t('subrace_placeholder')}
            value={subrace || ""}
            onChangeText={setSubrace}
            type="character_subrace"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('personality')}</Text>
          <TextInput
            placeholder={t('personality_placeholder')}
            value={personality || ""}
            onChangeText={setPersonality}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('motivation')}</Text>
          <TextInput
            placeholder={t('motivation_placeholder')}
            value={motivation || ""}
            onChangeText={setMotivation}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('qualities')}</Text>
          <TextInput
            placeholder={t('qualities_placeholder')}
            value={qualities || ""}
            onChangeText={setQualities}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('weaknesses')}</Text>
          <TextInput
            placeholder={t('weaknesses_placeholder')}
            value={weaknesses || ""}
            onChangeText={setWeaknesses}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('biography')}</Text>
          <TextInput
            placeholder={t('biography_placeholder')}
            value={biography || ""}
            onChangeText={setBiography}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('planned_timeline')}</Text>
          <TextInput
            placeholder={t('planned_timeline_placeholder')}
            value={plannedTimeline || ""}
            onChangeText={setPlannedTimeline}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Button onPress={handleSave} style={styles.saveButton}>
            {t('save_character')}
          </Button>

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
  );
};

export default CharacterFormScreen;
