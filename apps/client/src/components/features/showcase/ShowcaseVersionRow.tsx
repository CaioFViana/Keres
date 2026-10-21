import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ShowcaseVersion } from '@keres/shared';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '@/src/theme';
import { formatBytes } from '@/src/utils/format/formatBytes';
import { formatDateTime } from '@/src/utils/format/formatDateTime';

interface ShowcaseVersionRowProps {
  version: ShowcaseVersion;
  /** The first of the list, which the site calls the newest. */
  newest: boolean;
  /** What is happening to this version right now (and how far along, 0–1, when the server says). */
  busy: { action: 'read' | 'download' | 'import'; progress: number | null } | null;
  /** Another version is being worked on: this one waits. */
  disabled: boolean;
  onRead: () => void;
  onDownload: () => void;
  onImport: () => void;
}

/** One version of a published story and what can be done with it: read it, take its package, or import a copy. */
const ShowcaseVersionRow: React.FC<ShowcaseVersionRowProps> = ({
  version,
  newest,
  busy,
  disabled,
  onRead,
  onDownload,
  onImport,
}) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const hasPackage = version.packageIncluded !== false;
  const percent = busy?.progress != null ? ` ${Math.round(busy.progress * 100)}%` : '';
  const label = (action: 'download' | 'import', idle: string, working: string) =>
    busy?.action === action ? `${working}${percent}` : idle;

  return (
    <View
      testID={`showcase-version-${version.id}`}
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={styles.heading}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {version.label}
        </Text>
        {newest ? (
          <Text style={[styles.badge, { color: colors.primary, borderColor: colors.primary }]}>
            {t('showcase_version_newest')}
          </Text>
        ) : null}
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {[
          formatDateTime(version.createdAt, i18n.language),
          hasPackage ? formatBytes(version.byteSize) : null,
          hasPackage && version.mediaTotal > 0
            ? t('showcase_version_media', {
                included: version.mediaIncluded,
                total: version.mediaTotal,
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <View style={styles.actions}>
        {version.reader ? (
          <Button
            variant="secondary"
            icon="book-outline"
            onPress={onRead}
            disabled={disabled}
            testID={`showcase-read-${version.id}`}
          >
            {t('showcase_read_online')}
          </Button>
        ) : null}
        {hasPackage ? (
          <>
            <Button
              variant="secondary"
              icon="download-outline"
              onPress={onDownload}
              disabled={disabled}
              testID={`showcase-download-${version.id}`}
            >
              {label('download', t('showcase_download_package'), t('showcase_downloading'))}
            </Button>
            <Button
              icon="albums-outline"
              onPress={onImport}
              disabled={disabled}
              testID={`showcase-import-${version.id}`}
            >
              {label('import', t('showcase_import'), t('showcase_importing'))}
            </Button>
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, gap: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  meta: { fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});

export default ShowcaseVersionRow;
