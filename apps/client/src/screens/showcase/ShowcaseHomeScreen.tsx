import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import ShowcaseLinkField from '@/src/components/features/showcase/ShowcaseLinkField';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { type ThemeColors } from '@/src/theme';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { useShowcaseLink } from './useShowcaseLink';

/**
 * The public sites of servers, from inside the app: a story, an author or a pack somebody linked to is pasted
 * here and opened, whether the server is one of the person's or not.
 */
const ShowcaseHomeScreen = () => {
  const { t } = useTranslation();
  useScreenHeader({ target: 'parent', title: t('showcase_title') });
  useBackButtonHandler();
  const link = useShowcaseLink();
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.description}>{t('showcase_description')}</Text>
      <ShowcaseLinkField
        value={link.text}
        onChangeText={link.changeText}
        onPaste={link.pasteFromClipboard}
        onOpen={link.open}
        canOpen={link.canOpen}
        busy={link.busy}
        status={link.status.text}
        statusTone={link.status.tone}
        onOpenInBrowser={link.openInBrowser}
      />
      <Text style={styles.note}>{t('showcase_link_note')}</Text>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { ...typography.body, color: colors.textSecondary, marginBottom: 14 },
    note: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 18 },
  });

export default ShowcaseHomeScreen;
