import { Button, Select, TextInput } from '@/src/components/common';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { createStoryService } from '@/src/services/storymanagement/StoryService';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { AppAlert } from '@/src/utils/AppAlert';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import {
  STORY_VOCABULARY_ENTITY_TYPES,
  type GrammaticalGender,
  type StoryVocabulary,
  type StoryVocabularyEntityType,
} from '@keres/shared/entities/Story';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

type VocabularyNavigation = NativeStackNavigationProp<CustomizationStackParamList, 'Vocabulary'>;
type DraftTerms = Record<
  StoryVocabularyEntityType,
  {
    singular: string;
    plural: string;
    grammaticalGender: GrammaticalGender;
  }
>;

const EMPTY_TERMS: DraftTerms = {
  Character: { singular: '', plural: '', grammaticalGender: 'masculine' },
  Location: { singular: '', plural: '', grammaticalGender: 'feminine' },
  Chapter: { singular: '', plural: '', grammaticalGender: 'masculine' },
  Scene: { singular: '', plural: '', grammaticalGender: 'feminine' },
  Event: { singular: '', plural: '', grammaticalGender: 'masculine' },
};

function languageFamily(language: string | undefined): 'pt' | 'en' {
  return language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function draftFromVocabulary(vocabulary: StoryVocabulary | null): DraftTerms {
  return Object.fromEntries(
    STORY_VOCABULARY_ENTITY_TYPES.map((type) => [
      type,
      vocabulary?.terms[type] ?? EMPTY_TERMS[type],
    ]),
  ) as DraftTerms;
}

interface VocabularyTermCardProps {
  type: StoryVocabularyEntityType;
  term: DraftTerms[StoryVocabularyEntityType];
  language: 'pt' | 'en';
  editable: boolean;
  onChange: (
    type: StoryVocabularyEntityType,
    field: keyof DraftTerms[StoryVocabularyEntityType],
    value: string,
  ) => void;
}

/**
 * Keeps an actively edited field mounted while the draft in the parent changes.
 * Only the card whose term changed needs to render again, including its default-term hint.
 */
const VocabularyTermCard = memo(
  ({ type, term, language, editable, onChange }: VocabularyTermCardProps) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(
      () =>
        StyleSheet.create({
          card: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.card,
            padding: 12,
            marginTop: 14,
          },
          title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
          labels: { flexDirection: 'row', gap: 10, marginBottom: 5 },
          label: { color: colors.textSecondary, fontSize: 12, flex: 1 },
          fields: { flexDirection: 'row', gap: 10, alignItems: 'center' },
          word: { flex: 1 },
          gender: { width: 136 },
          empty: { color: colors.textSecondary, fontSize: 12, marginTop: 7 },
        }),
      [colors],
    );

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t(`vocabulary_term_${type}`)}</Text>
        <View style={styles.labels}>
          <Text style={styles.label}>{t('vocabulary_singular')}</Text>
          <Text style={styles.label}>{t('vocabulary_plural')}</Text>
          {language === 'pt' && (
            <Text style={[styles.label, { flex: 0, width: 136 }]}>{t('vocabulary_gender')}</Text>
          )}
        </View>
        <View style={styles.fields}>
          <TextInput
            style={styles.word}
            testID={`vocabulary-${type}-singular`}
            value={term.singular}
            onChangeText={(value) => onChange(type, 'singular', value)}
            editable={editable}
          />
          <TextInput
            style={styles.word}
            testID={`vocabulary-${type}-plural`}
            value={term.plural}
            onChangeText={(value) => onChange(type, 'plural', value)}
            editable={editable}
          />
          {language === 'pt' && (
            <View style={styles.gender}>
              <Select
                value={term.grammaticalGender}
                onValueChange={(value) =>
                  onChange(type, 'grammaticalGender', (value ?? 'neutral') as GrammaticalGender)
                }
                options={[
                  { value: 'masculine', label: t('vocabulary_gender_masculine') },
                  { value: 'feminine', label: t('vocabulary_gender_feminine') },
                  { value: 'neutral', label: t('vocabulary_gender_neutral') },
                ]}
                disabled={!editable}
              />
            </View>
          )}
        </View>
        {!term.singular && !term.plural && (
          <Text style={styles.empty}>{t('vocabulary_default_term_hint')}</Text>
        )}
      </View>
    );
  },
);
VocabularyTermCard.displayName = 'VocabularyTermCard';

const VocabularyScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<VocabularyNavigation>();
  const { selectedStory, setSelectedStory } = useStoryStore();
  const selectedStoryId = selectedStory?.id;
  const selectedStoryVocabulary = selectedStory?.vocabulary ?? null;
  const { canManageStoryPolicy } = useStoryRole(selectedStory?.id);
  const [language, setLanguage] = useState<'pt' | 'en'>(() => languageFamily(i18n.language));
  const [terms, setTerms] = useState<DraftTerms>(() => draftFromVocabulary(null));
  const [saving, setSaving] = useState(false);
  const loadedDraftRef = useRef<string | null>(null);
  const vocabularySignature = JSON.stringify(selectedStoryVocabulary);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('vocabulary_title'), headerRight: undefined });
      setDocumentTitle(t('vocabulary_title'));
    }, [navigation, t]),
  );

  useEffect(() => {
    if (!selectedStoryId) {
      loadedDraftRef.current = null;
      return;
    }
    const draftKey = `${selectedStoryId}:${vocabularySignature}`;
    if (loadedDraftRef.current === draftKey) return;
    loadedDraftRef.current = draftKey;
    setLanguage(selectedStoryVocabulary?.language ?? languageFamily(i18n.language));
    setTerms(draftFromVocabulary(selectedStoryVocabulary));
  }, [i18n.language, selectedStoryId, selectedStoryVocabulary, vocabularySignature]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        intro: { color: colors.textSecondary, lineHeight: 20, marginBottom: 18 },
        languageLabel: { color: colors.text, fontWeight: '700', marginBottom: 6 },
        languageHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 7 },
        content: { paddingBottom: 40 },
        formActions: { marginBottom: 24 },
        footerSpacer: { height: 10 },
        secondaryButton: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        secondaryButtonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
      }),
    [colors],
  );

  const setTerm = useCallback(
    (
      type: StoryVocabularyEntityType,
      field: keyof DraftTerms[StoryVocabularyEntityType],
      value: string,
    ) => {
      setTerms((current) => ({ ...current, [type]: { ...current[type], [field]: value } }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!selectedStory || !canManageStoryPolicy) return;
    const entries = STORY_VOCABULARY_ENTITY_TYPES.map((type) => [type, terms[type]] as const);
    if (entries.some(([, term]) => Boolean(term.singular.trim()) !== Boolean(term.plural.trim()))) {
      AppAlert.alert(t('error'), t('vocabulary_term_pair_required'));
      return;
    }
    const configured = Object.fromEntries(
      entries.flatMap(([type, term]) => {
        const singular = term.singular.trim();
        const plural = term.plural.trim();
        return singular && plural
          ? [[type, { singular, plural, grammaticalGender: term.grammaticalGender }]]
          : [];
      }),
    ) as StoryVocabulary['terms'];
    const vocabulary: StoryVocabulary | null =
      Object.keys(configured).length === 0 ? null : { version: 1, language, terms: configured };
    try {
      setSaving(true);
      await createStoryService(drizzleDb).updateStory(selectedStory.userId, selectedStory.id, {
        vocabulary,
      });
      setSelectedStory({ ...selectedStory, vocabulary });
      AppAlert.alert(t('success'), t('vocabulary_saved'));
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save story vocabulary:', error);
      AppAlert.alert(t('error'), t('vocabulary_save_failed'));
    } finally {
      setSaving(false);
    }
  }, [
    canManageStoryPolicy,
    drizzleDb,
    language,
    navigation,
    selectedStory,
    setSelectedStory,
    t,
    terms,
  ]);

  const common = getCommonContainerStyles(colors);
  if (!selectedStory) return <View style={common.container} />;

  return (
    <KeyboardAwareScreen contentContainerStyle={[common.container, styles.content]}>
      <Text style={styles.intro}>{t('vocabulary_intro')}</Text>
      <Text style={styles.languageLabel}>{t('vocabulary_language')}</Text>
      <Select
        value={language}
        onValueChange={(value) => setLanguage((value ?? 'en') as 'pt' | 'en')}
        options={[
          { value: 'pt', label: t('language_portuguese') },
          { value: 'en', label: t('language_english') },
        ]}
        disabled={!canManageStoryPolicy}
      />
      <Text style={styles.languageHint}>{t('vocabulary_language_hint')}</Text>
      {STORY_VOCABULARY_ENTITY_TYPES.map((type) => (
        <VocabularyTermCard
          key={type}
          type={type}
          term={terms[type]}
          language={language}
          editable={canManageStoryPolicy}
          onChange={setTerm}
        />
      ))}
      {canManageStoryPolicy && (
        <FormActions stackOnCompact style={styles.formActions}>
          <Button
            style={styles.secondaryButton}
            onPress={() => setTerms(draftFromVocabulary(null))}
          >
            <Text style={styles.secondaryButtonText}>{t('vocabulary_use_defaults')}</Text>
          </Button>
          <Button style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>{t('cancel')}</Text>
          </Button>
          <Button onPress={handleSave} disabled={saving}>
            {t('save')}
          </Button>
        </FormActions>
      )}
      <View testID="vocabulary-footer-spacer" style={styles.footerSpacer} />
    </KeyboardAwareScreen>
  );
};

export default VocabularyScreen;
