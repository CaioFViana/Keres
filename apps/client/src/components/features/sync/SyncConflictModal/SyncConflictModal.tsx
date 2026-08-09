import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../../db';
import { PendingConflict } from '../../../../services/SyncConflictService';
import { useSyncConflictStore } from '../../../../state/syncConflictStore';
import { useTheme } from '../../../../theme';
import Button from '@/src/components/common/controls/Button/Button';

/** De qual lado vem o valor escolhido para um campo em disputa. */
type FieldChoice = 'local' | 'server';

/**
 * Nome da entidade no protocolo de sincronização para a chave de tradução já existente.
 * Evita duplicar quinze rótulos que o resto do app também usa.
 */
const ENTITY_LABEL_KEYS: Record<string, string> = {
  Chapter: 'chapter',
  Character: 'character',
  CharacterRelation: 'character_relation',
  CharacterScene: 'character_scene_relation',
  Choice: 'choice',
  Item: 'item',
  ItemJourney: 'item_journey',
  Location: 'location',
  Note: 'note',
  NoteRelation: 'note_relation',
  Scene: 'scene',
  Story: 'story',
  Tag: 'tag',
  TagRelation: 'tag_relation',
  WorldRule: 'world_rule',
};

/** Texto legível para qualquer valor vindo de um payload de sincronização. */
function formatValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === '') {
    return emptyLabel;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

const SyncConflictModal: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();

  const conflicts = useSyncConflictStore(state => state.conflicts);
  const activeIndex = useSyncConflictStore(state => state.activeIndex);
  const isVisible = useSyncConflictStore(state => state.isVisible);
  const isResolving = useSyncConflictStore(state => state.isResolving);
  const close = useSyncConflictStore(state => state.close);
  const setActiveIndex = useSyncConflictStore(state => state.setActiveIndex);
  const keepLocal = useSyncConflictStore(state => state.keepLocal);
  const keepServer = useSyncConflictStore(state => state.keepServer);

  const conflict: PendingConflict | undefined = conflicts[activeIndex];

  /**
   * Escolha por campo. Começa toda em `local` porque preservar o que a pessoa escreveu é
   * o padrão: quem abriu a tela já tem o trabalho dela em risco, e o caminho de menor
   * arrependimento é não perdê-lo.
   */
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({});

  const conflictId = conflict?.id;
  const contestedFieldsKey = conflict?.contestedFields.join(',') ?? '';

  useEffect(() => {
    if (!contestedFieldsKey) {
      setFieldChoices({});
      return;
    }
    const defaults: Record<string, FieldChoice> = {};
    for (const field of contestedFieldsKey.split(',')) {
      defaults[field] = 'local';
    }
    setFieldChoices(defaults);
  }, [conflictId, contestedFieldsKey]);

  const hasServerChoice = useMemo(
    () => Object.values(fieldChoices).some(choice => choice === 'server'),
    [fieldChoices]
  );

  const handleKeepMine = useCallback(async () => {
    if (!conflict) return;
    // Mistura só é enviada quando o usuário realmente trocou algum campo para o servidor;
    // caso contrário vale a intenção local inteira.
    const chosenValues = hasServerChoice
      ? Object.fromEntries(
          Object.entries(conflict.localValues).map(([field, localValue]) => [
            field,
            fieldChoices[field] === 'server' ? conflict.serverValues?.[field] : localValue,
          ])
        )
      : undefined;
    await keepLocal(drizzleDb, conflict.id, chosenValues);
  }, [conflict, fieldChoices, hasServerChoice, keepLocal, drizzleDb]);

  const handleKeepServer = useCallback(async () => {
    if (!conflict) return;
    await keepServer(drizzleDb, conflict.id);
  }, [conflict, keepServer, drizzleDb]);

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      padding: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerText: {
      flex: 1,
      marginLeft: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    body: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    reasonBox: {
      backgroundColor: colors.primaryContainer,
      borderRadius: 8,
      padding: 12,
      marginBottom: 14,
    },
    reasonText: {
      color: colors.onPrimaryContainer,
      fontSize: 14,
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    fieldBlock: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    fieldName: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 6,
      marginBottom: 4,
    },
    optionSelected: {
      backgroundColor: colors.primaryContainer,
    },
    optionLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    optionValue: {
      fontSize: 14,
      color: colors.text,
    },
    optionTextWrapper: {
      flex: 1,
      marginLeft: 8,
    },
    noFieldsText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pagerLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    closeButton: {
      padding: 4,
    },
  });

  if (!isVisible || !conflict) {
    return null;
  }

  const entityLabel = t(ENTITY_LABEL_KEYS[conflict.entityType] || conflict.entityType, { defaultValue: conflict.entityType });
  const entityName = formatValue(
    conflict.localValues.name ?? conflict.localValues.title ?? conflict.serverValues?.name ?? conflict.serverValues?.title,
    conflict.entityId
  );

  const emptyLabel = t('conflict_empty_value');
  const reasonText = t(`conflict_reason_${conflict.reason}`, {
    defaultValue: t('conflict_reason_unknown'),
    entity: entityLabel,
  });

  /**
   * `limit_exceeded` não é uma disputa entre duas versões - a operação nunca chegou a ser
   * aplicada no servidor porque o plano do usuário não permite mais. Não há campos para
   * comparar (por isso `showFieldPicker` já dava false para este caso, via
   * `serverValues === null`), mas o texto/rótulos genéricos de "servidor não tem cópia" e
   * "manter/usar servidor" seriam enganosos aqui, então ganham texto próprio.
   */
  const isLimitExceeded = conflict.reason === 'limit_exceeded';

  /**
   * A escolha campo a campo só ajuda quando os dois lados têm valores concretos para
   * comparar. Numa exclusão (de qualquer um dos lados) ou quando o servidor não tem mais a
   * entidade, a decisão é binária, e oferecer rádios com "(vazio)" do outro lado só
   * atrapalharia.
   */
  const showFieldPicker = !conflict.isDeletedOnServer
    && !conflict.isLocalDelete
    && conflict.serverValues !== null
    && conflict.contestedFields.length > 0;

  const fieldPickerFallbackText = isLimitExceeded
    ? t('conflict_limit_exceeded_note')
    : conflict.serverValues === null
      ? t('conflict_server_has_no_copy')
      : conflict.isDeletedOnServer || conflict.isLocalDelete
        ? t('conflict_binary_choice_note')
        : t('conflict_no_contested_fields');

  /** Rótulo do botão principal: no caso de exclusão remota, ele restaura a entidade. */
  const keepMineLabel = isLimitExceeded
    ? t('conflict_retry_mine')
    : conflict.isDeletedOnServer
      ? t('conflict_restore_mine')
      : hasServerChoice
        ? t('conflict_apply_merge')
        : t('conflict_keep_mine');

  const keepServerLabel = isLimitExceeded
    ? t('conflict_discard_mine')
    : conflict.isDeletedOnServer
      ? t('conflict_accept_deletion')
      : t('conflict_keep_server');

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="git-compare-outline" size={26} color={colors.accent} />
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('conflict_modal_title')}</Text>
              <Text style={styles.subtitle}>{`${entityLabel} — ${entityName}`}</Text>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeButton} accessibilityLabel={t('conflict_postpone')}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{reasonText}</Text>
            </View>

            {!showFieldPicker ? (
              <Text style={styles.noFieldsText}>{fieldPickerFallbackText}</Text>
            ) : (
              <>
                <Text style={styles.sectionTitle}>{t('conflict_choose_per_field')}</Text>
                {conflict.contestedFields.map(field => {
                  const choice = fieldChoices[field] || 'local';
                  const fieldLabel = t(field, { defaultValue: field });
                  return (
                    <View key={field} style={styles.fieldBlock}>
                      <Text style={styles.fieldName}>{fieldLabel}</Text>

                      <TouchableOpacity
                        style={[styles.option, choice === 'local' && styles.optionSelected]}
                        onPress={() => setFieldChoices(prev => ({ ...prev, [field]: 'local' }))}
                      >
                        <Ionicons
                          name={choice === 'local' ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={choice === 'local' ? colors.primary : colors.textSecondary}
                        />
                        <View style={styles.optionTextWrapper}>
                          <Text style={styles.optionLabel}>{t('conflict_side_mine')}</Text>
                          <Text style={styles.optionValue}>{formatValue(conflict.localValues[field], emptyLabel)}</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.option, choice === 'server' && styles.optionSelected]}
                        onPress={() => setFieldChoices(prev => ({ ...prev, [field]: 'server' }))}
                      >
                        <Ionicons
                          name={choice === 'server' ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={choice === 'server' ? colors.primary : colors.textSecondary}
                        />
                        <View style={styles.optionTextWrapper}>
                          <Text style={styles.optionLabel}>{t('conflict_side_server')}</Text>
                          <Text style={styles.optionValue}>{formatValue(conflict.serverValues?.[field], emptyLabel)}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button onPress={handleKeepMine} disabled={isResolving}>
              {keepMineLabel}
            </Button>
            <Button onPress={handleKeepServer} disabled={isResolving} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{keepServerLabel}</Text>
            </Button>
          </View>

          {conflicts.length > 1 && (
            <View style={styles.pager}>
              <TouchableOpacity
                onPress={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                disabled={activeIndex === 0}
              >
                <Ionicons name="chevron-back" size={24} color={activeIndex === 0 ? colors.border : colors.text} />
              </TouchableOpacity>
              <Text style={styles.pagerLabel}>
                {t('conflict_pager_position', { current: activeIndex + 1, total: conflicts.length })}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveIndex(Math.min(conflicts.length - 1, activeIndex + 1))}
                disabled={activeIndex >= conflicts.length - 1}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={activeIndex >= conflicts.length - 1 ? colors.border : colors.text}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default SyncConflictModal;
