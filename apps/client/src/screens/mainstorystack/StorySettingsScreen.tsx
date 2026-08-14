import { FavoriteBehavior, Story } from '@keres/shared/entities/Story';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'; // Removed BackHandler
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { Button, Select, TextInput } from '@/src/components/common';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler'; // Import useBackButtonHandler
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryRole } from '../../hooks/useStoryRole';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { isOfflineError } from '../../services/apiClient';
import { createFriendshipService } from '../../services/FriendshipService';
import { createServerService } from '../../services/ServerService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { StoryCollaborator, storyPermissionApi } from '../../services/StoryPermissionService';
import { SyncEngineService } from '../../services/SyncEngineService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { themeDisplayOptions } from '../../theme/palettes'; // Import themeDisplayOptions
import { setDocumentTitle } from '../../utils/documentTitle';
import { getLanguageOptions } from '../../utils/i18n';
import { AppAlert } from '../../utils/AppAlert';

type StorySettingsScreenNavigationProp = DrawerNavigationProp<
  MainSystemDrawerParamList,
  'MainDashboard'
>;

const StorySettingsScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const navigation = useNavigation<StorySettingsScreenNavigationProp>();
  // Removed useRoute and route.params
  const { selectedStory, setSelectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const serverService = useCallback(() => createServerService(drizzleDb), [drizzleDb]);
  const { userId } = useUserSettingsStore();

  useFocusEffect(
    useCallback(() => {
      // Direct Drawer screen (no nested Stack), so this is its own leaf-level title -
      // navigation.setOptions() here is correct, not navigation.getParent()?.setOptions().
      navigation.setOptions({ title: t('story_settings_title') });
      setDocumentTitle(t('story_settings_title'));
    }, [navigation, t]),
  );

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'linear' | 'branching'>('linear');
  const [description, setDescription] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBehavior, setFavoriteBehavior] = useState<FavoriteBehavior>('individual');
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [normalizeSceneTiming, setNormalizeSceneTiming] = useState(false);
  const [allowReaderComments, setAllowReaderComments] = useState(false);
  const [serverId, setServerId] = useState<string | null>(null); // Servidor vinculado (read-only aqui - ver handleSendToServer/handleUnlinkFromServer)
  const [availableServers, setAvailableServers] = useState<ServerSelect[]>([]); // New state for available servers
  const [uploadTargetServerId, setUploadTargetServerId] = useState<string | null>(null);
  const [isOwnerOnServer, setIsOwnerOnServer] = useState<boolean | null>(null); // null = ainda não checado / não foi possível checar
  const [collaborators, setCollaborators] = useState<StoryCollaborator[] | null>(null);
  const [serverActionLoading, setServerActionLoading] = useState(false);
  const [addableFriends, setAddableFriends] = useState<{ id: string; username: string }[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedPermissionType, setSelectedPermissionType] = useState<'reader' | 'writer'>(
    'reader',
  );
  const friendshipService = useCallback(() => createFriendshipService(drizzleDb), [drizzleDb]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) {
      setLoading(false);
      return;
    }
    const loadStoryAndServers = async () => {
      try {
        setLoading(true);
        // Fetch story
        const fetchedStory = await storyService().getStoryById(storyId, userId ?? undefined);

        if (!fetchedStory) {
          setError(t('story_not_found'));
          return;
        }

        setTitle(fetchedStory.title);
        setType(fetchedStory.type);
        setDescription(fetchedStory.description);
        setGenre(fetchedStory.genre);
        setLanguage(fetchedStory.language);
        setAuthor(fetchedStory.author);
        setIsFavorite(fetchedStory.isFavorite);
        setFavoriteBehavior(fetchedStory.favoriteBehavior);
        setExtraNotes(fetchedStory.extraNotes);
        setTheme(fetchedStory.theme);
        setNormalizeSceneTiming(fetchedStory.normalizeSceneTiming);
        setAllowReaderComments(fetchedStory.allowReaderComments);
        applyTheme(fetchedStory.theme || 'default');

        // Fetch servers
        const servers = await serverService().getAllServers();
        setAvailableServers(servers);

        // Check if fetchedStory.serverId exists in availableServers
        if (fetchedStory.serverId) {
          const foundServer = servers.find(
            (server: ServerSelect) => server.id === fetchedStory.serverId,
          ); // Typed server
          if (foundServer) {
            setServerId(fetchedStory.serverId);
          } else {
            // Server not found, set story.serverId to null in DB
            await storyService().updateStory(userId!, storyId, { serverId: null });
            setServerId(null);
            AppAlert.alert(t('warning'), t('server_not_found_for_story'));
          }
        } else {
          setServerId(null);
        }
      } catch (err) {
        console.error('Failed to load story or servers:', err);
        setError(t('failed_to_load_story_settings'));
      } finally {
        setLoading(false);
      }
    };
    loadStoryAndServers();
  }, [storyId, storyService, serverService, userId, t, applyTheme]);

  const linkedServer = availableServers.find((server) => server.id === serverId) ?? null;

  useEffect(() => {
    if (!storyId || !linkedServer) {
      setIsOwnerOnServer(null);
      setCollaborators(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fetchedCollaborators = await storyPermissionApi.getCollaborators(
          linkedServer,
          storyId,
        );
        if (!cancelled) {
          setIsOwnerOnServer(true);
          setCollaborators(fetchedCollaborators);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 403) {
          setIsOwnerOnServer(false);
        } else {
          // Erro de rede ou outro imprevisto - deixa como "não checado" em vez de assumir
          // que não é dono; o botão de desvincular fica escondido de qualquer forma até
          // conseguirmos confirmar.
          console.error('Failed to check story ownership/collaborators on server:', err);
          setIsOwnerOnServer(null);
        }
        setCollaborators(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, linkedServer]);

  // Friends already granted access are excluded so the picker only ever offers people who
  // can actually be added - re-adding an existing collaborator would just silently no-op
  // their permission type through the same upsert route, which isn't what "Add" implies here.
  useEffect(() => {
    if (!linkedServer || isOwnerOnServer !== true) {
      setAddableFriends([]);
      setSelectedFriendId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const allFriendships = await friendshipService().getAllFriendships();
        const collaboratorIds = new Set((collaborators ?? []).map((c) => c.userId));
        const friends = allFriendships
          .filter((f) => f.serverId === linkedServer.id && f.status === FriendStatus.FRIEND)
          .map((f) => ({ id: f.otherUserId, username: f.friendUsername }))
          .filter((f) => !collaboratorIds.has(f.id));
        if (!cancelled) setAddableFriends(friends);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load friends for collaborator picker:', err);
          setAddableFriends([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedServer, isOwnerOnServer, collaborators, friendshipService]);

  const handleSave = async () => {
    if (!storyId) return;

    if (!title.trim()) {
      AppAlert.alert(t('error'), t('title_required'));
      return;
    }

    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // `type` não entra aqui - converter tipo tem efeitos colaterais (gerar/apagar Choices,
      // reordenar cenas) que não fazem sentido como um campo de formulário comum; ver
      // `handleTypeChange`, que já persiste a conversão por conta própria.
      const storyData: Partial<
        Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>
      > = {
        title: title.trim(),
        description,
        genre,
        language,
        author,
        isFavorite,
        favoriteBehavior,
        extraNotes,
        theme,
        normalizeSceneTiming,
        allowReaderComments,
        // `serverId` não entra aqui - vincular/desvincular tem efeitos colaterais de rede
        // (enviar a história, avisar o servidor) que não fazem sentido como campo de
        // formulário comum; ver handleSendToServer/handleUnlinkFromServer.
      };

      await storyService().updateStory(userId, storyId, storyData);
      if (selectedStory) {
        setSelectedStory({ ...selectedStory, ...storyData });
      }
      AppAlert.alert(t('success'), t('story_updated_successfully'));
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save story settings:', err);
      setError(t('failed_to_save_story_settings'));
      AppAlert.alert(t('error'), t('failed_to_save_story_settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType: 'linear' | 'branching') => {
    if (!storyId || !userId || newType === type) return;

    if (newType === 'branching') {
      AppAlert.alert(
        t('convert_to_branching_title'),
        t('convert_to_branching_message'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('convert'),
            onPress: async () => {
              try {
                setLoading(true);
                await storyService().convertStoryType(userId, storyId, 'branching');
                setType('branching');
                AppAlert.alert(t('success'), t('story_type_converted_successfully'));
              } catch (err) {
                console.error('Failed to convert story to branching:', err);
                AppAlert.alert(t('error'), t('failed_to_convert_story_type'));
              } finally {
                setLoading(false);
              }
            },
          },
        ],
        { cancelable: true },
      );
      return;
    }

    // branching -> linear: valida antes de perguntar qualquer coisa, pra mostrar exatamente
    // o que está bloqueando em vez de deixar a conversão falhar sem explicação.
    (async () => {
      try {
        setLoading(true);
        const compatibility = await storyService().checkLinearCompatibility(storyId);
        setLoading(false);

        if (!compatibility.compatible) {
          const reasonLines = compatibility.reasons
            .map((r) => `• ${r.chapterName}: ${t(`linear_incompatibility_${r.kind}`)}`)
            .join('\n');
          AppAlert.alert(
            t('cannot_convert_to_linear_title'),
            `${t('cannot_convert_to_linear_message')}\n\n${reasonLines}`,
          );
          return;
        }

        AppAlert.alert(
          t('convert_to_linear_title'),
          t('convert_to_linear_message'),
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('convert'),
              style: 'destructive',
              onPress: async () => {
                try {
                  setLoading(true);
                  await storyService().convertStoryType(userId, storyId, 'linear');
                  setType('linear');
                  AppAlert.alert(t('success'), t('story_type_converted_successfully'));
                } catch (err) {
                  console.error('Failed to convert story to linear:', err);
                  AppAlert.alert(t('error'), t('failed_to_convert_story_type'));
                } finally {
                  setLoading(false);
                }
              },
            },
          ],
          { cancelable: true },
        );
      } catch (err) {
        setLoading(false);
        console.error('Failed to check linear compatibility:', err);
        AppAlert.alert(t('error'), t('failed_to_check_story_compatibility'));
      }
    })();
  };

  const handleSendToServer = async () => {
    if (!storyId || !userId || !uploadTargetServerId) return;
    const targetServer = availableServers.find((server) => server.id === uploadTargetServerId);
    if (!targetServer) return;

    setServerActionLoading(true);
    try {
      const result = await SyncEngineService.getInstance().uploadNewStoryToServer(
        storyId,
        targetServer,
        userId,
      );
      if (result.success) {
        setServerId(targetServer.id);
        setUploadTargetServerId(null);
        // `SyncInitializer` só (re)configura o motor de sync quando `selectedStory.serverId`
        // muda de verdade - sem atualizar a store aqui, ele continua achando que a história
        // é local e nunca liga a sincronização, mesmo com o vínculo já gravado no banco.
        if (selectedStory) {
          setSelectedStory({ ...selectedStory, serverId: targetServer.id });
        }
        AppAlert.alert(t('success'), t('send_to_server_success'));
      } else if (result.reason === 'already_exists') {
        AppAlert.alert(t('error'), t('send_to_server_already_exists'));
      } else {
        AppAlert.alert(t('error'), t('send_to_server_failed'));
      }
    } catch (err) {
      console.error('Failed to send story to server:', err);
      AppAlert.alert(t('error'), t('send_to_server_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!storyId || !linkedServer || !selectedFriendId) return;
    setServerActionLoading(true);
    try {
      await storyPermissionApi.grantCollaborator(
        linkedServer,
        storyId,
        selectedFriendId,
        selectedPermissionType,
      );
      const refreshedCollaborators = await storyPermissionApi.getCollaborators(
        linkedServer,
        storyId,
      );
      setCollaborators(refreshedCollaborators);
      setSelectedFriendId(null);
      setSelectedPermissionType('reader');
    } catch (err) {
      console.error('Failed to add collaborator:', err);
      AppAlert.alert(t('error'), t('add_collaborator_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleUpdateCollaboratorPermission = async (
    collaborator: StoryCollaborator,
    permissionType: 'reader' | 'writer',
  ) => {
    if (!storyId || !linkedServer || permissionType === collaborator.permissionType) return;

    setServerActionLoading(true);
    try {
      await storyPermissionApi.updateCollaboratorPermission(
        linkedServer,
        storyId,
        collaborator.userId,
        permissionType,
      );
      const refreshedCollaborators = await storyPermissionApi.getCollaborators(
        linkedServer,
        storyId,
      );
      setCollaborators(refreshedCollaborators);
    } catch (err) {
      console.error('Failed to update collaborator permission:', err);
      AppAlert.alert(t('error'), t('update_collaborator_permission_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleRemoveCollaborator = (collaborator: StoryCollaborator) => {
    if (!storyId || !linkedServer) return;
    AppAlert.alert(
      t('remove_collaborator_title'),
      t('remove_collaborator_message', {
        username: collaborator.user?.username ?? collaborator.userId,
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('remove'),
          style: 'destructive',
          onPress: async () => {
            setServerActionLoading(true);
            try {
              await storyPermissionApi.removeCollaborator(
                linkedServer,
                storyId,
                collaborator.userId,
              );
              setCollaborators((current) =>
                (current ?? []).filter((c) => c.userId !== collaborator.userId),
              );
            } catch (err) {
              console.error('Failed to remove collaborator:', err);
              AppAlert.alert(t('error'), t('remove_collaborator_failed'));
            } finally {
              setServerActionLoading(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleUnlinkFromServer = () => {
    if (!storyId || !userId) return;
    AppAlert.alert(
      t('unlink_from_server_title'),
      t('unlink_from_server_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('unlink'),
          style: 'destructive',
          onPress: async () => {
            setServerActionLoading(true);
            try {
              await storyService().unlinkFromServer(userId, storyId);
              setServerId(null);
              setIsOwnerOnServer(null);
              setCollaborators(null);
              // Mesma razão do handleSendToServer: sem isto o motor de sync continua rodando
              // com a configuração antiga (mesmo storyId/servidor) até algo mais disparar o
              // efeito do SyncInitializer de novo - e o próximo ciclo periódico encontraria a
              // história marcada como excluída no servidor e tentaria aplicar isso localmente,
              // exatamente o que "desvincular" deveria evitar.
              if (selectedStory) {
                setSelectedStory({ ...selectedStory, serverId: null });
              }
              AppAlert.alert(t('success'), t('unlink_from_server_success'));
            } catch (err) {
              console.error('Failed to unlink story from server:', err);
              AppAlert.alert(
                t('error'),
                isOfflineError(err)
                  ? t('unlink_from_server_offline')
                  : t('unlink_from_server_failed'),
              );
            } finally {
              setServerActionLoading(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleDelete = () => {
    if (!storyId) return;

    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    AppAlert.alert(
      t('delete_story_title'),
      t('delete_story_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            try {
              setLoading(true);
              await storyService().deleteStory(storyId);
              AppAlert.alert(t('success'), t('story_deleted_successfully'));

              // 'StorySelection' here is a dummy drawer route that only exists to intercept
              // the drawer sidebar's tap event (see MainSystemStack) - navigating to it
              // directly just shows a blank screen and never leaves MainSystemStack. Reaching
              // the real Story Selection screen means resetting the *root* stack, same as
              // MainDashboardScreen's double-back-press handler does.
              const rootStackNavigation = navigation.getParent();
              const resetToStorySelection = CommonActions.reset({
                index: 0,
                routes: [{ name: 'StorySelection' }],
              });
              if (rootStackNavigation) {
                rootStackNavigation.dispatch(resetToStorySelection);
              } else {
                console.error(
                  'Could not find root stack navigation to dispatch reset action. This is unexpected.',
                );
                navigation.dispatch(resetToStorySelection);
              }
            } catch (err) {
              console.error('Failed to delete story:', err);
              setError(t('failed_to_delete_story'));
              AppAlert.alert(t('error'), t('failed_to_delete_story'));
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  const storyTypeOptions = [
    { label: t('linear'), value: 'linear' },
    { label: t('branching'), value: 'branching' },
  ];

  const permissionTypeOptions = [
    { label: t('permission_reader'), value: 'reader' },
    { label: t('permission_writer'), value: 'writer' },
  ];

  const addableFriendOptions = addableFriends.map((f) => ({ label: f.username, value: f.id }));

  const languageOptions = getLanguageOptions(t);

  const themeOptions = themeDisplayOptions.map((theme) => ({
    label: t(theme.labelKey),
    value: theme.value,
  }));

  // Servidores disponíveis pra enviar uma história totalmente local pela primeira vez -
  // ver handleSendToServer. Diferente do antigo Select genérico, não tem opção "Nenhum
  // servidor": desvincular é uma ação própria (handleUnlinkFromServer), não um valor de campo.
  const uploadServerOptions = availableServers.map((server) => ({
    label: server.name,
    value: server.id,
  }));

  if (!storyId) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{t('no_story_selected_for_settings')}</Text>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>{t('loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{error}</Text>
        <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={[styles.scrollViewContent, { paddingBottom: scrollBottomPadding }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('story_settings_screen_title')}</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
        {t('story_settings_screen_description')}
      </Text>

      {!canEdit && (
        <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
          {t('story_read_only_error')}
        </Text>
      )}

      <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
      <TextInput
        placeholder={t('title_placeholder')}
        value={title}
        onChangeText={setTitle}
        style={commonInputStyles.input}
        editable={canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('type')}</Text>
      <Select
        options={storyTypeOptions}
        value={type}
        onValueChange={(value) => handleTypeChange(value as 'linear' | 'branching')}
        placeholder={t('select_story_type')}
        disabled={!canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
      <TextInput
        placeholder={t('description_placeholder')}
        value={description || ''}
        onChangeText={setDescription}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
        editable={canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('genre')}</Text>
      <TextInput
        placeholder={t('genre_placeholder')}
        value={genre || ''}
        onChangeText={setGenre}
        style={commonInputStyles.input}
        editable={canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('author')}</Text>
      <TextInput
        placeholder={t('author_placeholder')}
        value={author || ''}
        onChangeText={setAuthor}
        style={commonInputStyles.input}
        editable={canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('language')}</Text>
      <Select
        options={languageOptions}
        value={language}
        onValueChange={setLanguage}
        placeholder={t('select_language')}
        disabled={!canEdit}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_favorite')}
        </Text>
        <ThemedSwitch
          value={isFavorite}
          onValueChange={setIsFavorite}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
          disabled={!canEdit}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{t('favorite_behavior')}</Text>
      <Select
        options={[
          { label: t('favorite_behavior_global'), value: 'global' },
          { label: t('favorite_behavior_individual'), value: 'individual' },
          { label: t('favorite_behavior_individual_public'), value: 'individual_public' },
        ]}
        value={favoriteBehavior}
        onValueChange={(value) => setFavoriteBehavior(value as FavoriteBehavior)}
        placeholder={t('favorite_behavior')}
        disabled={!canEdit}
      />
      <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
        {t(`favorite_behavior_${favoriteBehavior}_description`)}
      </Text>

      <View style={styles.switchContainer}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[styles.label, { color: colors.text }]}>{t('normalize_scene_timing')}</Text>
          <Text style={{ color: colors.textSecondary }}>
            {t('normalize_scene_timing_description')}
          </Text>
        </View>
        <ThemedSwitch
          value={normalizeSceneTiming}
          onValueChange={setNormalizeSceneTiming}
          disabled={!canEdit}
        />
      </View>

      {/* Só existe distinção reader/writer para histórias vinculadas a um servidor - uma
              história local não tem colaboradores, então este ajuste não faria sentido. */}
      {serverId && (
        <View style={styles.switchContainer}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.label, { color: colors.text }]}>{t('allow_reader_comments')}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {t('allow_reader_comments_description')}
            </Text>
          </View>
          <ThemedSwitch
            value={allowReaderComments}
            onValueChange={setAllowReaderComments}
            disabled={!canEdit}
          />
        </View>
      )}

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes || ''}
        onChangeText={setExtraNotes}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
        editable={canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('theme')}</Text>
      <Select
        options={themeOptions}
        value={theme}
        onValueChange={(value) => {
          setTheme(value);
          applyTheme(value || 'default');
        }}
        placeholder={t('select_theme')}
        disabled={!canEdit}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('server')}</Text>
      {serverId === null ? (
        uploadServerOptions.length > 0 ? (
          <>
            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
              {t('send_to_server_description')}
            </Text>
            <Select
              options={uploadServerOptions}
              value={uploadTargetServerId}
              onValueChange={setUploadTargetServerId}
              placeholder={t('select_server')}
            />
            <Button
              onPress={handleSendToServer}
              disabled={!uploadTargetServerId || serverActionLoading}
              style={styles.saveButton}
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
            {linkedServer?.name ?? serverId}
          </Text>

          {isOwnerOnServer === true && (
            <View style={styles.collaboratorsSection}>
              <Text style={[styles.label, { color: colors.text }]}>{t('collaborators_title')}</Text>

              {addableFriendOptions.length > 0 ? (
                <View style={styles.addCollaboratorRow}>
                  <View style={styles.addCollaboratorFriendSelect}>
                    <Select
                      options={addableFriendOptions}
                      value={selectedFriendId}
                      onValueChange={setSelectedFriendId}
                      placeholder={t('select_friend_to_add')}
                    />
                  </View>
                  <View style={styles.addCollaboratorPermissionSelect}>
                    <Select
                      options={permissionTypeOptions}
                      value={selectedPermissionType}
                      onValueChange={(value) =>
                        setSelectedPermissionType(value as 'reader' | 'writer')
                      }
                      placeholder={t('select_permission_type')}
                    />
                  </View>
                  <Button
                    onPress={handleAddCollaborator}
                    disabled={!selectedFriendId || serverActionLoading}
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

              {collaborators !== null && collaborators.length === 0 && (
                <Text style={{ color: colors.textSecondary }}>{t('no_collaborators')}</Text>
              )}
              {(collaborators ?? []).map((collaborator) => (
                <View key={collaborator.id} style={styles.collaboratorRow}>
                  <Text style={[styles.collaboratorName, { color: colors.text }]} numberOfLines={2}>
                    {collaborator.user?.username ?? collaborator.userId}
                  </Text>
                  <View style={styles.collaboratorPermissionSelect}>
                    <Select
                      options={permissionTypeOptions}
                      value={collaborator.permissionType}
                      onValueChange={(value) => {
                        if (value === 'reader' || value === 'writer') {
                          void handleUpdateCollaboratorPermission(collaborator, value);
                        }
                      }}
                      disabled={serverActionLoading}
                    />
                  </View>
                  <Button
                    onPress={() => handleRemoveCollaborator(collaborator)}
                    disabled={serverActionLoading}
                    style={styles.removeCollaboratorButton}
                  >
                    {t('remove')}
                  </Button>
                </View>
              ))}

              {collaborators !== null && collaborators.length > 0 && (
                <Text style={{ color: colors.textSecondary, marginTop: 5 }}>
                  {t('unlink_blocked_by_collaborators')}
                </Text>
              )}

              <Button
                onPress={handleUnlinkFromServer}
                disabled={serverActionLoading || collaborators === null || collaborators.length > 0}
                style={[styles.saveButton, styles.deleteButton]}
              >
                {t('unlink_from_server_title')}
              </Button>
            </View>
          )}
        </>
      )}

      <Button onPress={handleSave} style={styles.saveButton} disabled={!canEdit}>
        {t('update_story')}
      </Button>

      <Button
        onPress={handleDelete}
        style={[styles.saveButton, styles.deleteButton]}
        disabled={!canEdit}
      >
        {t('delete_story_title')}
      </Button>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  scrollViewContent: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 5,
  },
  saveButton: {
    marginTop: 30,
    marginBottom: 20,
  },
  deleteButton: {
    backgroundColor: 'red', // Destructive color
  },
  collaboratorsSection: {
    marginTop: 15,
  },
  addCollaboratorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  addCollaboratorFriendSelect: {
    flex: 2,
    marginRight: 5,
  },
  addCollaboratorPermissionSelect: {
    flex: 1,
    marginRight: 5,
  },
  addCollaboratorButton: {
    paddingHorizontal: 12,
  },
  collaboratorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  collaboratorName: {
    flex: 1,
    minWidth: 120,
  },
  collaboratorPermissionSelect: {
    width: 140,
    marginLeft: 8,
  },
  removeCollaboratorButton: {
    marginLeft: 10,
    paddingHorizontal: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StorySettingsScreen;
