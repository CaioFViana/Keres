import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '@/src/theme';

export interface GraphNodeSheetBadge {
  label: string;
  color: string;
}

export interface GraphNodeSheetItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  /** An extra compact line (a Choice's checks/effects) - it only takes up space when it exists. */
  extra?: string;
  italicLabel?: boolean;
  onPress: () => void;
}

export interface GraphNodeSheetSection {
  title: string;
  description?: string;
  emptyMessage?: string;
  items?: GraphNodeSheetItem[];
}

interface GraphNodeSheetProps {
  title: string;
  subtitle?: { text: string; color?: string };
  badges?: GraphNodeSheetBadge[];
  sections: GraphNodeSheetSection[];
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}

/** The shared frame for the node details shown in the graphs. */
const GraphNodeSheet: React.FC<GraphNodeSheetProps> = ({
  title,
  subtitle,
  badges,
  sections,
  actionLabel,
  onAction,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 24,
          maxHeight: '78%',
        },
        handle: {
          alignSelf: 'center',
          width: 42,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 14,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        headerText: {
          flex: 1,
          marginRight: 12,
        },
        title: {
          fontSize: 19,
          fontWeight: 'bold',
          color: colors.text,
        },
        closeButton: { padding: 4 },
        subtitle: {
          fontSize: 13,
          marginTop: 2,
        },
        badgeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 10,
          // Spacing between badges belongs to the container: with it on each badge, the last row still charged
          // its bottom margin and left dead space under the row.
          columnGap: 8,
          rowGap: 6,
        },
        badge: {
          borderRadius: 12,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 3,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: '600',
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: 'bold',
          color: colors.text,
          marginTop: 18,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        description: {
          fontSize: 14,
          color: colors.text,
          lineHeight: 20,
        },
        emptyText: {
          fontSize: 13,
          color: colors.textSecondary,
          fontStyle: 'italic',
        },
        item: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 9,
          paddingHorizontal: 11,
          marginBottom: 7,
        },
        itemText: {
          flex: 1,
          marginRight: 8,
        },
        itemLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.text,
        },
        itemDetail: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
        },
        itemExtra: {
          fontSize: 11.5,
          color: colors.primary,
          marginTop: 3,
        },
        actionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingVertical: 13,
          marginTop: 22,
        },
        actionText: {
          color: colors.onPrimary,
          fontSize: 15,
          fontWeight: 'bold',
          marginLeft: 8,
        },
      }),
    [colors],
  );

  return (
    <ResponsiveModal
      visible
      onClose={onClose}
      placement="adaptive"
      contentStyle={styles.sheet}
      maxHeight="78%"
    >
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: subtitle.color || colors.textSecondary }]}>
              {subtitle.text}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {!!badges?.length && (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <View key={badge.label} style={[styles.badge, { borderColor: badge.color }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          ))}
        </View>
      )}
      <ScrollView>
        {sections.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.description && <Text style={styles.description}>{section.description}</Text>}
            {section.items &&
              (section.items.length === 0 ? (
                <Text style={styles.emptyText}>{section.emptyMessage}</Text>
              ) : (
                section.items.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.item} onPress={item.onPress}>
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={colors.textSecondary}
                      style={{ marginRight: 9 }}
                    />
                    <View style={styles.itemText}>
                      <Text
                        style={[
                          styles.itemLabel,
                          item.italicLabel && { fontStyle: 'italic', color: colors.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {!!item.detail && (
                        <Text style={styles.itemDetail} numberOfLines={1}>
                          {item.detail}
                        </Text>
                      )}
                      {!!item.extra && (
                        <Text style={styles.itemExtra} numberOfLines={2}>
                          {item.extra}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              ))}
          </View>
        ))}
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Ionicons name="open-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ResponsiveModal>
  );
};

export default GraphNodeSheet;
