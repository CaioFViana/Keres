import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';

interface RelationRowProps {
  /** Conteúdo do lado esquerdo da linha (nome + eventual subtítulo, ex.: tipo de relação). */
  children: React.ReactNode;
  /** Mostra o chevron e torna o conteúdo tocável quando presente. */
  onPress?: () => void;
  /** Slot entre o chevron e o botão de excluir, ex.: o ícone de editar do CharacterRelationManager. */
  extraActions?: React.ReactNode;
  /** Mostra o botão de lixeira quando presente. */
  onRemove?: () => void;
}

/**
 * `CharacterRelationManager` e `LocationRelationManager` (parent/child/connection, 3x)
 * reimplementavam cada um a mesma linha "conteúdo tocável + chevron + ações" na mão. Extraído
 * aqui, e não em `RelationManager`/`GenericRelationDisplay` (que já resolvem esse mesmo
 * problema para seus próprios 5+ call-sites) - aqueles têm uma regra de interação diferente
 * (chevron escondido quando `editable`) que não faz sentido forçar aqui.
 */
const RelationRow: React.FC<RelationRowProps> = ({ children, onPress, extraActions, onRemove }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
  });

  return (
    <View style={styles.relationItem}>
      <TouchableOpacity
        style={styles.relationItemContent}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
          style={styles.chevron}
        />
      )}
      {(extraActions || onRemove) && (
        <View style={styles.actionsRow}>
          {extraActions}
          {onRemove && (
            <TouchableOpacity onPress={onRemove}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default RelationRow;
