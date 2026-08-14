import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HelpBlock } from '@/src/help/types';
import { useTheme } from '@/src/theme';
import { HelpFieldTable } from '../HelpFieldTable/HelpFieldTable';

export function HelpBlockRenderer({
  block,
  onOpenPage,
  pageTitle,
}: {
  block: HelpBlock;
  onOpenPage: (id: string) => void;
  pageTitle: (id: string) => string;
}) {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    text: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 12 },
    heading2: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      marginTop: 14,
      marginBottom: 8,
    },
    heading3: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 6,
    },
    box: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    muted: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    infoCallout: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
    warningCallout: { borderColor: colors.error, borderWidth: 1 },
    tableRow: {
      flexDirection: 'row',
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: 8,
    },
    tableCell: { color: colors.text, flex: 1, fontSize: 13, paddingRight: 8 },
    tableHeader: { fontWeight: '700' },
  });
  if (block.type === 'paragraph') return <Text style={styles.text}>{block.text}</Text>;
  if (block.type === 'heading')
    return <Text style={block.level === 2 ? styles.heading2 : styles.heading3}>{block.text}</Text>;
  if (block.type === 'fields') return <HelpFieldTable rows={block.rows} />;
  if (block.type === 'steps' || block.type === 'list')
    return (
      <View>
        {block.items.map((item, index) => (
          <Text key={item} style={styles.text}>
            {block.type === 'steps' || block.ordered ? `${index + 1}. ` : '• '}
            {item}
          </Text>
        ))}
      </View>
    );
  if (block.type === 'path') return <Text style={styles.muted}>{block.segments.join(' › ')}</Text>;
  if (block.type === 'callout' || block.type === 'example')
    return (
      <View
        style={[
          styles.box,
          block.type === 'callout' &&
            (block.tone === 'warning' ? styles.warningCallout : styles.infoCallout),
        ]}
      >
        {block.type === 'example' && block.title ? (
          <Text style={[styles.text, { fontWeight: '700' }]}>{block.title}</Text>
        ) : null}
        <Text style={styles.muted}>{block.text}</Text>
      </View>
    );
  if (block.type === 'faq')
    return (
      <View>
        {block.items.map((item) => (
          <View key={item.question} style={styles.box}>
            <Text style={[styles.text, { fontWeight: '700' }]}>{item.question}</Text>
            <Text style={styles.muted}>{item.answer}</Text>
          </View>
        ))}
      </View>
    );
  if (block.type === 'table')
    return (
      <View style={styles.box}>
        <View style={styles.tableRow}>
          {block.headers.map((header) => (
            <Text key={header} style={[styles.tableCell, styles.tableHeader]}>
              {header}
            </Text>
          ))}
        </View>
        {block.rows.map((row, index) => (
          <View key={index} style={styles.tableRow}>
            {row.map((cell, cellIndex) => (
              <Text key={cellIndex} style={styles.tableCell}>
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  return (
    <View>
      {block.pages.map((id) => (
        <TouchableOpacity key={id} onPress={() => onOpenPage(id)}>
          <Text style={[styles.text, { color: colors.primary }]}>→ {pageTitle(id)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
