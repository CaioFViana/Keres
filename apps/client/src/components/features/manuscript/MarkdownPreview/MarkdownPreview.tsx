import type { ManuscriptMark, ManuscriptSpan, TextRange } from '@keres/shared';
import {
  findAllCaseInsensitiveMatches,
  findAllFoldedMatches,
  parseMarkdownToDocument,
} from '@keres/shared';
import { useMemo } from 'react';
import type React from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import MarkedText from '../../../common/display/MarkedText/MarkedText';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

function decorationLine(marks: ManuscriptMark[]): TextStyle['textDecorationLine'] {
  const underline = marks.includes('underline');
  const strike = marks.includes('strikethrough');
  if (underline && strike) return 'underline line-through';
  if (underline) return 'underline';
  if (strike) return 'line-through';
  return 'none';
}

function InlineText({
  span,
  ranges,
  commentRanges,
  onCommentPress,
  activeRangeIndex,
  activeTextRef,
}: {
  span: ManuscriptSpan;
  ranges: TextRange[];
  commentRanges: TextRange[];
  onCommentPress?: () => void;
  activeRangeIndex: number | null;
  activeTextRef?: React.Ref<Text>;
}) {
  return (
    <MarkedText
      text={span.text}
      ranges={ranges}
      commentRanges={commentRanges}
      onCommentPress={onCommentPress}
      activeRanges={
        activeRangeIndex !== null && ranges[activeRangeIndex]
          ? [ranges[activeRangeIndex]]
          : undefined
      }
      activeRef={activeRangeIndex !== null ? activeTextRef : undefined}
      style={{
        fontWeight: span.marks.includes('bold') ? '700' : '400',
        fontStyle: span.marks.includes('italic') ? 'italic' : 'normal',
        textDecorationLine: decorationLine(span.marks),
        fontSize: manuscriptTextMetrics.fontSize,
      }}
    />
  );
}

/**
 * Read-mode renderer over the shared document model — the same model the
 * editor writes, so combined marks (`***both***`) render exactly as typed and
 * write mode and read mode can never diverge. The export pipeline owns its
 * own reader AST in `@keres/shared`.
 */
export function MarkdownPreview({
  text,
  testID,
  selectable = true,
  highlightQuery,
  activeMatchIndex,
  activeTextRef,
  commentExcerpts,
  onCommentPress,
}: {
  text: string;
  testID?: string;
  selectable?: boolean;
  /** Manuscript search query: every case-insensitive hit reads as a highlighter mark. */
  highlightQuery?: string | null;
  /** Comment excerpts: every occurrence reads as a tappable highlighter mark. */
  commentExcerpts?: string[];
  /** Fired when a comment-marked span is tapped (opens that field's thread). */
  onCommentPress?: () => void;
  /**
   * Body-global 0-based hit drawn as the current one (manuscript search's ordinal hit
   * within this body). Nullish draws every hit equally. Counted in mark order, which is
   * what the reader sees; a query spanning a mark boundary counts in the counter but
   * marks in no span, the same drift the plain marks already have.
   */
  activeMatchIndex?: number | null;
  /** Attached to the current hit's host, so the manuscript can scroll it into view. */
  activeTextRef?: React.Ref<Text>;
}) {
  const { colors } = useTheme();
  const doc = useMemo(() => parseMarkdownToDocument(text), [text]);
  // Trailing Enters are storage, not reading: a body ending in blank lines
  // would otherwise air the section end (and, between scenes, pile a blank
  // join onto the divider). Leading and interior blanks stay byte-honest.
  const blocks = useMemo(() => {
    const visible = [...doc.blocks];
    while (visible.length > 0 && visible[visible.length - 1].spans.length === 0) {
      visible.pop();
    }
    return visible;
  }, [doc]);
  const spanRanges = useMemo(
    () =>
      blocks.map((block) =>
        block.spans.map((span) =>
          highlightQuery ? findAllCaseInsensitiveMatches(span.text, highlightQuery) : [],
        ),
      ),
    [blocks, highlightQuery],
  );
  // Comment marks follow the per-span rule search uses: spans carry no raw offsets,
  // so each excerpt matches inside each span. Same fill as search, tappable.
  const spanCommentRanges = useMemo(
    () =>
      blocks.map((block) =>
        block.spans.map((span) =>
          (commentExcerpts ?? []).flatMap((excerpt) =>
            findAllFoldedMatches(span.text, excerpt),
          ),
        ),
      ),
    [blocks, commentExcerpts],
  );
  // Which span holds the current hit: spans partition the body in order, so the hits
  // count up across them exactly as the reader meets them.
  const activeRef = useMemo(() => {
    if (activeMatchIndex === null || activeMatchIndex === undefined || activeMatchIndex < 0) {
      return null;
    }
    let seen = 0;
    for (let blockIndex = 0; blockIndex < spanRanges.length; blockIndex += 1) {
      const blockRanges = spanRanges[blockIndex];
      for (let spanIndex = 0; spanIndex < blockRanges.length; spanIndex += 1) {
        const ranges = blockRanges[spanIndex];
        if (activeMatchIndex < seen + ranges.length) {
          return { blockIndex, spanIndex, rangeIndex: activeMatchIndex - seen };
        }
        seen += ranges.length;
      }
    }
    return null;
  }, [spanRanges, activeMatchIndex]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { marginBottom: manuscriptTextMetrics.paragraphSpacing },
        paragraph: {
          color: colors.text,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
        },
        // Blank lines read as full beats with no text node to pollute copies:
        // exactly one line-height, no margins, so each stored blank line
        // costs one line — the same beat as the editor's empty line.
        blankBlock: {
          height: manuscriptTextMetrics.lineHeight,
        },
      }),
    [colors],
  );
  return (
    <View testID={testID}>
      {blocks.map((block, index) =>
        block.spans.length === 0 ? (
          <View key={`block-${index}`} style={styles.blankBlock} />
        ) : (
          <View key={`block-${index}`} style={styles.block}>
            <Text selectable={selectable} style={styles.paragraph}>
              {block.spans.map((span, spanIndex) => (
                <InlineText
                  key={spanIndex}
                  span={span}
                  ranges={spanRanges[index][spanIndex]}
                  commentRanges={spanCommentRanges[index][spanIndex]}
                  onCommentPress={onCommentPress}
                  activeRangeIndex={
                    activeRef !== null &&
                    activeRef.blockIndex === index &&
                    activeRef.spanIndex === spanIndex
                      ? activeRef.rangeIndex
                      : null
                  }
                  activeTextRef={activeTextRef}
                />
              ))}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}
