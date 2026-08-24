import { Ionicons } from '@expo/vector-icons';
import type { SeeAlsoEntityType } from '@keres/shared';
import React, { forwardRef, useCallback, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  decodeSeeAlsoValue,
  encodeSeeAlsoValue,
  useSeeAlsoEntityOptions,
} from '../../../../hooks/useSeeAlsoEntityOptions';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useSeeAlsoRelations } from '../../../../hooks/useSeeAlsoRelations';
import { useTheme } from '../../../../theme';
import { ENTITY_TYPE_ICONS } from '../../../../utils/entityTypeIcons';

interface SeeAlsoManagerProps {
  storyId: string;
  entityType: SeeAlsoEntityType;
  entityId: string;
  editable: boolean;
}

/** Escape hatch pro form chamar depois do save principal, quando `entityId` passou de vazio
 * pro id de verdade - mesmo motivo do `PanZoomCanvasHandle`: o componente já possui o hook
 * (`useSeeAlsoRelations`) que guarda a seleção pendente, então só ele pode disparar o replay. */
export interface SeeAlsoManagerHandle {
  persistPending: (targetEntityId: string) => Promise<void>;
}

/**
 * Seção "Veja também" de uma tela de detalhe: lista, clicável, de outras entidades marcadas
 * como relacionadas a esta (vínculo mútuo - ver useSeeAlsoRelations), mais um picker
 * (`MultiSelectPill` em modo agrupado, o mesmo usado na Galeria) para adicionar/remover vínculos.
 *
 * Aplica a mudança imediatamente ao selecionar/desselecionar (sem botão "Salvar" separado) -
 * mesmo padrão de TagChipList/NoteManager/CharacterRelationManager nestas mesmas telas.
 */
const SeeAlsoManager = forwardRef<SeeAlsoManagerHandle, SeeAlsoManagerProps>(
  ({ storyId, entityType, entityId, editable }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const navigateToDetail = useNavigateToEntityDetail();
    const { relations, save, persistSeeAlsoRelations } = useSeeAlsoRelations(
      storyId,
      entityType,
      entityId,
    );

    useImperativeHandle(ref, () => ({ persistPending: persistSeeAlsoRelations }), [
      persistSeeAlsoRelations,
    ]);
    const { groupedOptions, optionsByValue } = useSeeAlsoEntityOptions(
      storyId,
      entityType,
      entityId,
    );

    const selectedValues = useMemo(
      () => relations.map((relation) => encodeSeeAlsoValue(relation.otherType, relation.otherId)),
      [relations],
    );

    const handleSelectionChange = useCallback(
      (selected: string[]) => {
        const targets = selected
          .map(decodeSeeAlsoValue)
          .filter((ref): ref is NonNullable<typeof ref> => ref !== null);
        save(targets);
      },
      [save],
    );

    const handlePress = useCallback(
      (otherType: SeeAlsoEntityType, otherId: string) => {
        navigateToDetail(otherType, otherId);
      },
      [navigateToDetail],
    );

    const styles = StyleSheet.create({
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      },
      rowLast: { borderBottomWidth: 0 },
      icon: { marginRight: 10 },
      name: { flex: 1, fontSize: 15, color: colors.text },
      emptyText: { color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 },
    });

    return (
      <CollapsibleCard
        title={`${t('see_also_title')} (${relations.length})`}
        initialExpanded={false}
      >
        {editable && (
          <MultiSelectPill
            groups={groupedOptions}
            selectedValues={selectedValues}
            onSelectionChange={handleSelectionChange}
            placeholder={t('see_also_select_placeholder')}
            noOptionsText={t('see_also_no_entities_available')}
          />
        )}
        {relations.length === 0 ? (
          <Text style={styles.emptyText}>{t('see_also_empty')}</Text>
        ) : (
          relations.map((relation, index) => {
            const option = optionsByValue.get(
              encodeSeeAlsoValue(relation.otherType, relation.otherId),
            );
            const rowStyle = [styles.row, index === relations.length - 1 && styles.rowLast];
            const rowContent = (
              <>
                <Ionicons
                  name={ENTITY_TYPE_ICONS[relation.otherType]}
                  size={20}
                  color={colors.primary}
                  style={styles.icon}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {option?.name || relation.otherId}
                </Text>
                {!editable && (
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                )}
              </>
            );
            // Em Forms (editable), a linha não navega - sair da tela perderia as alterações não
            // salvas do formulário. Só as telas de detalhe (view-only) navegam ao tocar.
            return editable ? (
              <View key={relation.relationId} style={rowStyle}>
                {rowContent}
              </View>
            ) : (
              <TouchableOpacity
                key={relation.relationId}
                style={rowStyle}
                onPress={() => handlePress(relation.otherType, relation.otherId)}
              >
                {rowContent}
              </TouchableOpacity>
            );
          })
        )}
      </CollapsibleCard>
    );
  },
);

SeeAlsoManager.displayName = 'SeeAlsoManager';

export default SeeAlsoManager;
