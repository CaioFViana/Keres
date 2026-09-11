import { Button, SingleSelectPill } from '@/src/components/common';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { useStoryServerCollaboration } from '@/src/hooks/useStoryServerCollaboration';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

interface StoryCollaborationSectionProps {
  storyId: string;
  allowReaderComments: boolean;
  onAllowReaderCommentsChange: (value: boolean) => void;
  canManageStoryPolicy: boolean;
}

export default function StoryCollaborationSection({
  storyId,
  allowReaderComments,
  onAllowReaderCommentsChange,
  canManageStoryPolicy,
}: StoryCollaborationSectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const collaboration = useStoryServerCollaboration(storyId);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const permissionTypeOptions = [
    { label: t('permission_reader'), value: 'reader' },
    { label: t('permission_writer'), value: 'writer' },
  ];

  const linked = collaboration.serverId !== null;
  const isOwner = collaboration.isOwnerOnServer === true;
  const hasCollaborators =
    collaboration.collaborators !== null && collaboration.collaborators.length > 0;
  const unlinkBlocked =
    collaboration.serverActionLoading || collaboration.collaborators === null || hasCollaborators;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t('server')}</Text>

      {!linked ? (
        collaboration.uploadServerOptions.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.muted}>{t('send_to_server_description')}</Text>
            <SingleSelectPill
              options={collaboration.uploadServerOptions}
              value={collaboration.uploadTargetServerId}
              onValueChange={collaboration.setUploadTargetServerId}
              placeholder={t('select_server')}
              style={styles.pillFlush}
            />
            <Button
              onPress={collaboration.handleSendToServer}
              disabled={!collaboration.uploadTargetServerId || collaboration.serverActionLoading}
            >
              {t('send_to_server')}
            </Button>
          </View>
        ) : (
          <Text style={styles.muted}>{t('no_registered_servers')}</Text>
        )
      ) : (
        <View style={styles.block}>
          <View style={styles.serverStatus}>
            <View style={styles.serverStatusIcon}>
              <Ionicons name="cloud-done-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.serverStatusBody}>
              <Text style={styles.serverStatusLabel}>{t('server')}</Text>
              <Text style={styles.serverStatusName} numberOfLines={1}>
                {collaboration.linkedServer?.name ?? collaboration.serverId}
              </Text>
            </View>
          </View>

          {isOwner && (
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceBody}>
                <Text style={styles.preferenceTitle}>{t('allow_reader_comments')}</Text>
                <Text style={styles.muted}>{t('allow_reader_comments_description')}</Text>
              </View>
              <ThemedSwitch
                value={allowReaderComments}
                onValueChange={onAllowReaderCommentsChange}
                disabled={!canManageStoryPolicy}
              />
            </View>
          )}
        </View>
      )}

      {linked && isOwner && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>{t('collaborators_title')}</Text>

          {collaboration.addableFriendOptions.length > 0 ? (
            <View style={[styles.addForm, isCompact && styles.addFormStacked]}>
              <View
                style={[styles.addField, isCompact ? styles.addFieldFull : styles.addFieldFriend]}
              >
                <SingleSelectPill
                  options={collaboration.addableFriendOptions}
                  value={collaboration.selectedFriendId}
                  onValueChange={collaboration.setSelectedFriendId}
                  placeholder={t('select_friend_to_add')}
                  style={styles.pillFlush}
                />
              </View>
              <View
                style={[
                  styles.addField,
                  isCompact ? styles.addFieldFull : styles.addFieldPermission,
                ]}
              >
                <SingleSelectPill
                  options={permissionTypeOptions}
                  value={collaboration.selectedPermissionType}
                  onValueChange={(value) =>
                    collaboration.setSelectedPermissionType(value as 'reader' | 'writer')
                  }
                  placeholder={t('select_permission_type')}
                  style={styles.pillFlush}
                />
              </View>
              <Button
                onPress={collaboration.handleAddCollaborator}
                disabled={!collaboration.selectedFriendId || collaboration.serverActionLoading}
                style={isCompact ? undefined : styles.addButtonWide}
              >
                {t('add')}
              </Button>
            </View>
          ) : (
            <Text style={styles.muted}>{t('no_addable_friends')}</Text>
          )}

          {collaboration.collaborators !== null && collaboration.collaborators.length === 0 && (
            <Text style={[styles.muted, styles.listEmpty]}>{t('no_collaborators')}</Text>
          )}

          <View style={styles.collaboratorList}>
            {(collaboration.collaborators ?? []).map((collaborator) => (
              <View key={collaborator.id} style={styles.collaboratorCard}>
                <Text style={styles.collaboratorName} numberOfLines={1}>
                  {collaborator.user?.username ?? collaborator.userId}
                </Text>
                <View style={styles.collaboratorPermission}>
                  <SingleSelectPill
                    options={permissionTypeOptions}
                    value={collaborator.permissionType}
                    onValueChange={(value) => {
                      if (value === 'reader' || value === 'writer') {
                        void collaboration.handleUpdateCollaboratorPermission(collaborator, value);
                      }
                    }}
                    disabled={collaboration.serverActionLoading}
                    style={styles.pillFlush}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => collaboration.handleRemoveCollaborator(collaborator)}
                  disabled={collaboration.serverActionLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('remove')}
                  style={[
                    styles.removeButton,
                    collaboration.serverActionLoading && styles.removeButtonDisabled,
                  ]}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.dangerZone}>
            {hasCollaborators && (
              <Text style={styles.muted}>{t('unlink_blocked_by_collaborators')}</Text>
            )}
            <Button
              onPress={collaboration.handleUnlinkFromServer}
              disabled={unlinkBlocked}
              style={{ backgroundColor: colors.error }}
            >
              {t('unlink_from_server_title')}
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginTop: 20,
      padding: 15,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    block: {
      gap: 12,
    },
    muted: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    pillFlush: {
      marginBottom: 0,
    },
    serverStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.primaryContainer,
    },
    serverStatusIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    serverStatusBody: {
      flex: 1,
      minWidth: 0,
    },
    serverStatusLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onPrimaryContainer,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
      opacity: 0.8,
    },
    serverStatusName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
    },
    preferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 4,
    },
    preferenceBody: {
      flex: 1,
      minWidth: 0,
    },
    preferenceTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    addForm: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 12,
    },
    addFormStacked: {
      flexDirection: 'column',
    },
    addField: {
      minWidth: 0,
    },
    addFieldFull: {
      width: '100%',
    },
    addFieldFriend: {
      flex: 2,
    },
    addFieldPermission: {
      flex: 1,
      minWidth: 120,
    },
    addButtonWide: {
      alignSelf: 'stretch',
      paddingHorizontal: 14,
    },
    listEmpty: {
      marginBottom: 8,
    },
    collaboratorList: {
      gap: 8,
    },
    collaboratorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    collaboratorName: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    collaboratorPermission: {
      width: 130,
      flexShrink: 0,
    },
    removeButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeButtonDisabled: {
      opacity: 0.4,
    },
    dangerZone: {
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 10,
    },
  });
