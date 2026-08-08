import { AttributeKeyRegex, AttributeType, deriveAttributeKey } from '@keres/shared';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import AttributeValueInput from '../../components/common/CustomAttributeFields/AttributeValueInput';
import Button from '../../components/common/Button/Button';
import Select from '../../components/common/Select/Select';
import TextInput from '../../components/common/TextInput/TextInput';
import { ScreenLoading } from '../../components/common/ScreenState/ScreenState';
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

type StorySchemaFieldFormScreenRouteProp = RouteProp<StorySchemaStackParamList, 'StorySchemaFieldForm'>;
type StorySchemaFieldFormScreenNavigationProp = NativeStackNavigationProp<StorySchemaStackParamList, 'StorySchemaFieldForm'>;

const ATTRIBUTE_TYPE_OPTIONS = Object.values(AttributeType);

const StorySchemaFieldFormScreen = () => {
  useBackButtonHandler();
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
  const existingFields = useStorySchemaFields(storyId, entityType);

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [type, setType] = useState<AttributeType>(AttributeType.TEXT);
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: isEditing ? t('edit_attribute_title') : t('create_attribute_title') });
    }, [navigation, isEditing, t])
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
          defaultValue: defaultValue?.trim() || null,
        });
      } else {
        await service.createField(userId, {
          storyId,
          entityType,
          name: name.trim(),
          key,
          description: description?.trim() || null,
          type,
          isRequired,
          defaultValue: defaultValue?.trim() || null,
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

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: colors.text },
    hint: { fontSize: 13, color: colors.textSecondary, marginTop: -2, marginBottom: 5 },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 5 },
    saveButton: { marginTop: 30 },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
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

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { marginTop: 0 }]}>{t('attribute_required')}</Text>
            <Switch
              value={isRequired}
              onValueChange={setIsRequired}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isRequired ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={styles.label}>{t('attribute_default_value')}</Text>
          <AttributeValueInput
            type={type}
            value={defaultValue || ''}
            onChange={setDefaultValue}
            placeholder={t('attribute_default_value')}
            storyId={storyId}
            suggestionFieldId={fieldId}
          />

          <Button onPress={handleSave} style={styles.saveButton} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default StorySchemaFieldFormScreen;
