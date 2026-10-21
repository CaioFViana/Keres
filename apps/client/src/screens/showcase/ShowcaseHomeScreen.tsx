import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ShowcaseLinkField from '@/src/components/features/showcase/ShowcaseLinkField';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import type { ShowcaseStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { type ThemeColors, useTheme } from '@/src/theme';
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
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ShowcaseStackParamList, 'ShowcaseHome'>>();
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

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('showcase_servers_title')}
      </Text>
      {link.servers.length === 0 ? (
        <Text style={styles.note} testID="showcase-servers-empty">
          {t('showcase_servers_empty')}
        </Text>
      ) : (
        link.servers.map((server) => (
          <TouchableOpacity
            key={server.id}
            accessibilityRole="button"
            onPress={() => navigation.navigate('ShowcaseBrowse', { serverId: server.id })}
            style={[styles.server, { borderColor: colors.border, backgroundColor: colors.surface }]}
            testID={`showcase-server-${server.id}`}
          >
            <Ionicons name="storefront-outline" size={22} color={colors.primary} />
            <View style={styles.serverTexts}>
              <Text style={[styles.serverName, { color: colors.text }]} numberOfLines={1}>
                {server.name ?? server.url}
              </Text>
              <Text style={[styles.serverUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                {server.url}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { ...typography.body, color: colors.textSecondary, marginBottom: 14 },
    note: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 18 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 28,
      marginBottom: 10,
    },
    server: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    serverTexts: { flex: 1, minWidth: 0 },
    serverName: { fontSize: 16, fontWeight: '600' },
    serverUrl: { fontSize: 13, marginTop: 2 },
  });

export default ShowcaseHomeScreen;
