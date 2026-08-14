import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import AttributeValueInput from '@/src/components/common/forms/CustomAttributeFields/AttributeValueInput';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import {
  AttributeKeyRegex,
  AttributeType,
  deriveAttributeKey,
  STORY_SCHEMA_ENTITY_TYPES,
  StorySchemaEntityType,
} from '@keres/shared';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import { StorySchemaStackParamList } from '../../navigation/MainSystemStack';
import { createStorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';

type StorySchemaFieldFormScreenRouteProp = RouteProp<
  StorySchemaStackParamList,
  'StorySchemaFieldForm'
>;
type StorySchemaFieldFormScreenNavigationProp = NativeStackNavigationProp<
  StorySchemaStackParamList,
  'StorySchemaFieldForm'
>;

const ATTRIBUTE_TYPE_OPTIONS = Object.values(AttributeType);

const StorySchemaFieldFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StorySchemaFieldFormScreenNavigationProp>();
  const route = useRoute<StorySchemaFieldFormScreenRouteProp>();
  const { entityType, fieldId } = route.params;
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  const isEditing = !!fieldId;
  useDocumentTitle(isEditing ? t('edit_attribute_title') : t('create_attribute_title'));
  const existingFields = useStorySchemaFields(storyId, entityType);

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [type, setType] = useState<AttributeType>(AttributeType.TEXT);
  const [targetEntityType, setTargetEntityType] = useState<StorySchemaEntityType | null>(null);
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        title: isEditing ? t('edit_attribute_title') : t('create_attribute_title'),
      });
    }, [navigation, isEditing, t]),
  );

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const service = createStorySchemaFieldService(drizzleDb);
        const field = await service.getById(fieldId!);
        if (field) {
          setName(field.name);
          setKey(field.key);
          setKeyManuallyEdited(true); // Chave já fixa em modo de edição, não precisa mais auto-derivar.
          setDescription(field.description);
          setType(field.type as AttributeType);
          setTargetEntityType(field.targetEntityType as StorySchemaEntityType | null);
          setIsRequired(field.isRequired);
          setDefaultValue(field.defaultValue);
        } else {
          AppAlert.alert(t('error'), t('attribute_not_found'));
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to load attribute field:', err);
        AppAlert.alert(t('error'), t('failed_to_load_attribute'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, fieldId, drizzleDb, navigation, t]);

  const handleNameChange = (text: string) => {
    setName(text);
    if (!keyManuallyEdited) {
      setKey(deriveAttributeKey(text));
    }
  };

  const handleKeyChange = (text: string) => {
    setKeyManuallyEdited(true);
    setKey(text.toLowerCase());
  };

  const handleSave = async () => {
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('display_name_required'));
      return;
    }
    if (!AttributeKeyRegex.test(key)) {
      AppAlert.alert(t('error'), t('invalid_attribute_key'));
      return;
    }
    if (type === AttributeType.ENTITY && !targetEntityType) {
      AppAlert.alert(t('error'), t('attribute_target_entity_type_required'));
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
      const service = createStorySchemaFieldService(drizzleDb);
      if (isEditing) {
        await service.updateField(userId, fieldId!, {
          name: name.trim(),
          description: description?.trim() || null,
          isRequired,
          defaultValue: type === AttributeType.ENTITY ? null : defaultValue?.trim() || null,
        });
      } else {
        await service.createField(userId, {
          storyId,
          entityType,
          name: name.trim(),
          key,
          description: description?.trim() || null,
          type,
          targetEntityType: type === AttributeType.ENTITY ? targetEntityType : null,
          isRequired,
          defaultValue: type === AttributeType.ENTITY ? null : defaultValue?.trim() || null,
          order: existingFields.length,
        });
      }
      navigation.goBack();
    } catch (err: any) {
      console.error('Failed to save attribute field:', err);
      AppAlert.alert(t('error'), err?.message || t('failed_to_save_attribute'));
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = ATTRIBUTE_TYPE_OPTIONS.map((value) => ({
    label: t(`attribute_type_${value}`),
    value,
  }));
  const targetEntityTypeOptions = STORY_SCHEMA_ENTITY_TYPES.map((value) => ({
    label: t(`${value.toLowerCase()}s`),
    value,
  }));

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: colors.text },
    hint: { fontSize: 13, color: colors.textSecondary, marginTop: -2, marginBottom: 5 },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 5,
    },
    saveButton: { marginTop: 30 },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={styles.label}>{t('attribute_display_name')}</Text>
      <TextInput
        placeholder={t('attribute_display_name_placeholder')}
        value={name}
        onChangeText={handleNameChange}
        style={commonInputStyles.input}
      />

      <Text style={styles.label}>{t('attribute_internal_key')}</Text>
      <Text style={styles.hint}>{t('attribute_internal_key_hint')}</Text>
      <TextInput
        placeholder={t('attribute_internal_key_placeholder')}
        value={key}
        onChangeText={handleKeyChange}
        autoCapitalize="none"
        editable={!isEditing}
        style={[commonInputStyles.input, isEditing && { opacity: 0.6 }]}
      />

      <Text style={styles.label}>{t('description')}</Text>
      <TextInput
        placeholder={t('attribute_description_placeholder')}
        value={description || ''}
        onChangeText={setDescription}
        style={[commonInputStyles.input, { minHeight: 3 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <Text style={styles.label}>{t('attribute_type_label')}</Text>
      <Select
        options={typeOptions}
        value={type}
        onValueChange={(value) => setType((value as AttributeType) || AttributeType.TEXT)}
        placeholder={t('attribute_type_label')}
        disabled={isEditing}
      />

      {type === AttributeType.ENTITY && (
        <>
          <Text style={styles.label}>{t('attribute_target_entity_type')}</Text>
          <Text style={styles.hint}>{t('attribute_target_entity_type_hint')}</Text>
          <Select
            options={targetEntityTypeOptions}
            value={targetEntityType}
            onValueChange={(value) => setTargetEntityType((value as StorySchemaEntityType) || null)}
            placeholder={t('attribute_target_entity_type')}
            disabled={isEditing}
          />
        </>
      )}

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { marginTop: 0 }]}>{t('attribute_required')}</Text>
        <ThemedSwitch
          value={isRequired}
          onValueChange={setIsRequired}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>

      {type !== AttributeType.ENTITY && (
        <>
          <Text style={styles.label}>{t('attribute_default_value')}</Text>
          <AttributeValueInput
            type={type}
            value={defaultValue || ''}
            onChange={setDefaultValue}
            placeholder={t('attribute_default_value')}
            storyId={storyId}
            suggestionFieldId={fieldId}
          />
        </>
      )}

      <Button onPress={handleSave} style={styles.saveButton} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </KeyboardAwareScreen>
  );
};

export default StorySchemaFieldFormScreen;
