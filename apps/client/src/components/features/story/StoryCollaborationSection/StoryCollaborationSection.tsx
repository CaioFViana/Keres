import { Button, SingleSelectPill } from '@/src/components/common';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useStoryServerCollaboration } from '@/src/hooks/useStoryServerCollaboration';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
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
  const collaboration = useStoryServerCollaboration(storyId);
  const permissionTypeOptions = [
    { label: t('permission_reader'), value: 'reader' },
    { label: t('permission_writer'), value: 'writer' },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {collaboration.serverId && (
        <View
          style={[
            styles.preferenceRow,
            styles.preferenceRowDivider,
            { borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.preferenceBody}>
            <Text style={[styles.preferenceTitle, { color: colors.text }]}>
              {t('allow_reader_comments')}
            </Text>
            <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
              {t('allow_reader_comments_description')}
            </Text>
          </View>
          <ThemedSwitch
            value={allowReaderComments}
            onValueChange={onAllowReaderCommentsChange}
            disabled={!canManageStoryPolicy}
          />
        </View>
      )}

      <View>
        <Text style={[styles.preferenceTitle, { color: colors.text }]}>{t('server')}</Text>
        {collaboration.serverId === null ? (
          collaboration.uploadServerOptions.length > 0 ? (
            <>
              <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
                {t('send_to_server_description')}
              </Text>
              <SingleSelectPill
                options={collaboration.uploadServerOptions}
                value={collaboration.uploadTargetServerId}
                onValueChange={collaboration.setUploadTargetServerId}
                placeholder={t('select_server')}
              />
              <Button
                onPress={collaboration.handleSendToServer}
                disabled={!collaboration.uploadTargetServerId || collaboration.serverActionLoading}
                style={styles.serverActionButton}
              >
                {t('send_to_server')}
              </Button>
            </>
          ) : (
            <Text style={{ color: colors.textSecondary }}>{t('no_registered_servers')}</Text>
          )
        ) : (
          <>
            <Text style={{ color: colors.text, marginBottom: 10 }}>
              {collaboration.linkedServer?.name ?? collaboration.serverId}
            </Text>
            {collaboration.isOwnerOnServer === true && (
              <View style={[styles.collaboratorsSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.preferenceTitle, { color: colors.text }]}>
                  {t('collaborators_title')}
                </Text>
                {collaboration.addableFriendOptions.length > 0 ? (
                  <View style={styles.addCollaboratorRow}>
                    <View style={styles.addCollaboratorFriendSelect}>
                      <SingleSelectPill
                        options={collaboration.addableFriendOptions}
                        value={collaboration.selectedFriendId}
                        onValueChange={collaboration.setSelectedFriendId}
                        placeholder={t('select_friend_to_add')}
                      />
                    </View>
                    <View style={styles.addCollaboratorPermissionSelect}>
                      <SingleSelectPill
                        options={permissionTypeOptions}
                        value={collaboration.selectedPermissionType}
                        onValueChange={(value) =>
                          collaboration.setSelectedPermissionType(value as 'reader' | 'writer')
                        }
                        placeholder={t('select_permission_type')}
                      />
                    </View>
                    <Button
                      onPress={collaboration.handleAddCollaborator}
                      disabled={
                        !collaboration.selectedFriendId || collaboration.serverActionLoading
                      }
                      style={styles.addCollaboratorButton}
                    >
                      {t('add')}
                    </Button>
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, marginBottom: 5 }}>
                    {t('no_addable_friends')}
                  </Text>
                )}
                {collaboration.collaborators !== null &&
                  collaboration.collaborators.length === 0 && (
                    <Text style={{ color: colors.textSecondary }}>{t('no_collaborators')}</Text>
                  )}
                {(collaboration.collaborators ?? []).map((collaborator) => (
                  <View key={collaborator.id} style={styles.collaboratorRow}>
                    <Text
                      style={[styles.collaboratorName, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {collaborator.user?.username ?? collaborator.userId}
                    </Text>
                    <View style={styles.collaboratorPermissionSelect}>
                      <SingleSelectPill
                        options={permissionTypeOptions}
                        value={collaborator.permissionType}
                        onValueChange={(value) => {
                          if (value === 'reader' || value === 'writer') {
                            void collaboration.handleUpdateCollaboratorPermission(
                              collaborator,
                              value,
                            );
                          }
                        }}
                        disabled={collaboration.serverActionLoading}
                      />
                    </View>
                    <Button
                      onPress={() => collaboration.handleRemoveCollaborator(collaborator)}
                      disabled={collaboration.serverActionLoading}
                      style={styles.removeCollaboratorButton}
                    >
                      {t('remove')}
                    </Button>
                  </View>
                ))}
                {collaboration.collaborators !== null && collaboration.collaborators.length > 0 && (
                  <Text style={{ color: colors.textSecondary, marginTop: 5 }}>
                    {t('unlink_blocked_by_collaborators')}
                  </Text>
                )}
                <Button
                  onPress={collaboration.handleUnlinkFromServer}
                  disabled={
                    collaboration.serverActionLoading ||
                    collaboration.collaborators === null ||
                    collaboration.collaborators.length > 0
                  }
                  style={[styles.serverActionButton, { backgroundColor: colors.error }]}
                >
                  {t('unlink_from_server_title')}
                </Button>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, marginTop: 20, padding: 15 },
  preferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  preferenceRowDivider: { borderBottomWidth: 1, marginBottom: 10, paddingBottom: 14 },
  preferenceBody: { flex: 1 },
  preferenceTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  preferenceDescription: { marginTop: 3 },
  collaboratorsSection: { borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  serverActionButton: { marginTop: 12, minHeight: 50 },
  addCollaboratorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  addCollaboratorFriendSelect: { flex: 2, marginRight: 5 },
  addCollaboratorPermissionSelect: { flex: 1, marginRight: 5 },
  addCollaboratorButton: { marginBottom: 10, minHeight: 50, paddingHorizontal: 12 },
  collaboratorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  collaboratorName: { flex: 1, minWidth: 120 },
  collaboratorPermissionSelect: { width: 140, marginLeft: 8 },
  removeCollaboratorButton: { marginLeft: 10, paddingHorizontal: 12 },
});
