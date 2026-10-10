import {
  countLineSyllables,
  lyricText,
  parseChordPro,
  type SectionWords,
  type SongLine,
  type SyllableLanguage,
} from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface LeadSheetViewProps {
  lyrics: string;
  /** What an unlabelled `{start_of_verse}` is called. */
  words: SectionWords;
  /** When given, each line of words shows how many syllables it has (an estimate in that language). */
  syllableLanguage?: SyllableLanguage | undefined;
  /** How many rows are drawn before the rest waits behind a button; a long ballad is hundreds. */
  firstRows?: number;
  /** The line being sung, while the tune plays: its section and its place among that section's lines. */
  activeLine?: { sectionIndex: number; sourceIndex: number } | null;
}

type Row =
  | { key: string; kind: 'heading'; label: string }
  | { key: string; kind: 'line'; line: SongLine };

/** Rows of the sheet in order: a heading for each labelled section, then its lines. */
function rowsOf(lyrics: string, words: SectionWords): Row[] {
  const rows: Row[] = [];
  parseChordPro(lyrics, words).sections.forEach((section, sectionIndex) => {
    if (section.label) {
      rows.push({ key: `h${sectionIndex}`, kind: 'heading', label: section.label });
    }
    section.lines.forEach((line, lineIndex) => {
      rows.push({ key: `l${sectionIndex}-${lineIndex}`, kind: 'line', line });
    });
  });
  return rows;
}

const SheetLine = React.memo(function SheetLine({
  line,
  syllableLanguage,
  active,
}: {
  line: SongLine;
  syllableLanguage: SyllableLanguage | undefined;
  active: boolean;
}) {
  const { colors } = useTheme();
  if (line.kind === 'blank') return <View style={styles.gap} />;
  if (line.kind === 'recall') {
    return (
      <Text style={[styles.note, { color: colors.textSecondary }]}>{`(${line.label ?? '↻'})`}</Text>
    );
  }
  if (line.kind === 'comment') {
    return (
      <Text
        style={[
          styles.note,
          { color: colors.textSecondary },
          line.italic && { fontStyle: 'italic' },
        ]}
      >
        {line.text}
      </Text>
    );
  }
  const hasChords = line.segments.some((segment) => segment.chord !== null);
  const syllables =
    syllableLanguage === undefined
      ? null
      : countLineSyllables(lyricText(line.segments, true), syllableLanguage);
  return (
    <View
      style={[styles.lineRow, active && { backgroundColor: colors.primaryContainer }]}
      testID={active ? 'lead-sheet-line-active' : 'lead-sheet-line'}
    >
      {hasChords ? (
        // One stack per chord: the chord over the words up to the next one, never one per syllable.
        <View style={styles.segments}>
          {line.segments.map((segment, index) => (
            <View key={index} style={styles.segment}>
              <Text style={[styles.chord, { color: colors.primary }]}>{segment.chord ?? ' '}</Text>
              <Text style={[styles.words, { color: colors.text }]}>
                {lyricText([segment]) || ' '}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.words, styles.plain, { color: colors.text }]}>
          {lyricText(line.segments)}
        </Text>
      )}
      {syllables !== null ? (
        <Text style={[styles.count, { color: colors.textSecondary }]} testID="syllable-count">
          {syllables}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * The lyrics as a lead sheet: the chords over the words they fall on, the sections under their names.
 * Drawn from the text and nothing else. A long song draws its first rows and keeps the rest behind a
 * button, so a ballad of hundreds of lines costs nothing until someone asks for the end of it.
 */
const LeadSheetView: React.FC<LeadSheetViewProps> = ({
  lyrics,
  words,
  syllableLanguage,
  firstRows = 80,
  activeLine = null,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rows = useMemo(() => rowsOf(lyrics, words), [lyrics, words]);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, firstRows);

  if (rows.length === 0) {
    return <ThemedText tone="secondary">{t('song_sheet_empty')}</ThemedText>;
  }
  return (
    <View testID="lead-sheet">
      {shown.map((row) =>
        row.kind === 'heading' ? (
          <Text
            key={row.key}
            accessibilityRole="header"
            style={[styles.heading, { color: colors.textSecondary }]}
          >
            {row.label}
          </Text>
        ) : (
          <SheetLine
            key={row.key}
            line={row.line}
            syllableLanguage={syllableLanguage}
            active={
              activeLine !== null &&
              row.key === `l${activeLine.sectionIndex}-${activeLine.sourceIndex}`
            }
          />
        ),
      )}
      {rows.length > shown.length ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setShowAll(true)}
          style={styles.more}
        >
          <ThemedText tone="primary">
            {t('song_sheet_show_all', { count: rows.length - shown.length })}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  gap: { height: 8 },
  note: { fontSize: 13, marginVertical: 2 },
  lineRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  segments: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1 },
  segment: { alignItems: 'flex-start' },
  chord: { fontSize: 13, fontWeight: '700', minHeight: 17 },
  words: { fontSize: 16, lineHeight: 22 },
  plain: { flexShrink: 1 },
  count: { fontSize: 12, marginLeft: 8, minWidth: 18, textAlign: 'right' },
  more: { paddingVertical: 12 },
});

export default LeadSheetView;
