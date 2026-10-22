import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '@/src/theme';

export type ShowcaseLinkTone = 'neutral' | 'good' | 'bad';

interface ShowcaseLinkFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Reads the clipboard into the field and opens the link when it is one. */
  onPaste: () => void;
  onOpen: () => void;
  /** Nothing to open: the text is empty or is not a link the app can use. */
  canOpen: boolean;
  busy: boolean;
  /** What the app understood of the text, or why it did not: said under the field as the person types. */
  status: string | null;
  statusTone: ShowcaseLinkTone;
  /** A way out for a link that is an address but not a showcase page: opens it in the browser. */
  onOpenInBrowser?: () => void;
}

/** Where a link to a story, an author or a pack of a server's public site is pasted. */
const ShowcaseLinkField: React.FC<ShowcaseLinkFieldProps> = ({
  value,
  onChangeText,
  onPaste,
  onOpen,
  canOpen,
  busy,
  status,
  statusTone,
  onOpenInBrowser,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const toneColor =
    statusTone === 'bad'
      ? colors.error
      : statusTone === 'good'
        ? colors.primary
        : colors.textSecondary;

  return (
    <View testID="showcase-link-field">
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onOpen}
          placeholder={t('showcase_link_placeholder')}
          accessibilityLabel={t('showcase_link_label')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          testID="showcase-link-input"
        />
      </View>

      {status ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: toneColor }]}
          testID="showcase-link-status"
        >
          {status}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon="clipboard-outline"
          onPress={onPaste}
          testID="showcase-link-paste"
        >
          {t('showcase_link_paste')}
        </Button>
        <Button
          icon="arrow-forward-outline"
          onPress={onOpen}
          disabled={!canOpen || busy}
          testID="showcase-link-open"
        >
          {t('showcase_link_open')}
        </Button>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {onOpenInBrowser ? (
          <Button
            variant="secondary"
            icon="open-outline"
            onPress={onOpenInBrowser}
            testID="showcase-link-browser"
          >
            {t('showcase_link_in_browser')}
          </Button>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1 },
  status: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12 },
});

export default ShowcaseLinkField;
