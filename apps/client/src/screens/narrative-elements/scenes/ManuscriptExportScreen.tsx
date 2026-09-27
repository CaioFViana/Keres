import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import ManuscriptExportOptions from '../../../components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions';
import { MANUSCRIPT_EXPORT_FORMATS } from '../../../components/features/manuscript/export/manuscriptExport';
import { defaultExportSettings } from '../../../components/features/manuscript/export/manuscriptExportSettings';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useTheme } from '../../../theme';
import { useManuscriptExport } from './useManuscriptExport';

type ManuscriptExportRouteProp = RouteProp<NarrativeElementsStackParamList, 'ManuscriptExport'>;

/**
 * The manuscript export as a full screen, like a gallery item: every option the pipeline takes
 * (the same component the publish screen shows), then one export. A made file closes the screen
 * back to the manuscript; a failure keeps it open with the choices intact.
 */
const ManuscriptExportScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<ManuscriptExportRouteProp>();
  const { loading, exporting, isBranching, routeName, looseCount, arcs, storyAuthor, exportWith } =
    useManuscriptExport(route.params?.routeId ?? null);
  const [settings, setSettings] = useState(() => defaultExportSettings(storyAuthor));
  useScreenHeader({ target: 'parent', title: t('export_manuscript_title') });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          alignSelf: 'center',
          maxWidth: 720,
          paddingHorizontal: 20,
          paddingVertical: 16,
          width: '100%',
        },
        headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
        title: { color: colors.text, flex: 1, fontSize: 20, fontWeight: '700' },
        closeButton: { padding: 4 },
        actions: { marginTop: 24 },
        cancelButton: { backgroundColor: colors.textSecondary },
      }),
    [colors],
  );

  if (loading) return <ScreenLoading message={t('loading')} padded />;

  const handleExport = async () => {
    if (await exportWith(settings)) navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('export_manuscript_title')}</Text>
        <TouchableOpacity
          testID="export-close"
          accessibilityLabel={t('close')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={28} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ManuscriptExportOptions
        settings={settings}
        onChange={setSettings}
        formats={MANUSCRIPT_EXPORT_FORMATS}
        routeName={routeName}
        showLooseSwitch={!isBranching && looseCount > 0}
        looseCount={looseCount}
        chapterNumberingAvailable={!isBranching}
        arcs={arcs}
      />
      <FormActions stackOnCompact style={styles.actions}>
        <Button
          testID="export-cancel"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          {t('cancel')}
        </Button>
        <Button testID="export-confirm" onPress={() => void handleExport()} disabled={exporting}>
          {t('export_manuscript_export')}
        </Button>
      </FormActions>
    </ScrollView>
  );
};

export default ManuscriptExportScreen;
