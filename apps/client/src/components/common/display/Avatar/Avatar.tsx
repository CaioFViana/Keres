import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { isColorLight } from '../../../../theme/commonStyles';
import { CHAPTER_PALETTE } from '../../../../utils/storyGraphLayout';

/** Ícone padrão para quem ainda não escolheu um (perfil recém-criado). */
const DEFAULT_ICON: keyof typeof Ionicons.glyphMap = 'person';

/**
 * O cinza semi-transparente original ficava pouco visível em várias cores de fundo da paleta -
 * preto ou branco (também semi-transparentes, pro "cinza/transparente" do pedido original)
 * garantem contraste em qualquer cor escolhida, decidido pela mesma luminância que já orienta
 * texto sobre cor no resto do app (`isColorLight`, usado por Tag).
 */
const ICON_TINT_ON_LIGHT = 'rgba(0, 0, 0, 0.6)';
const ICON_TINT_ON_DARK = 'rgba(255, 255, 255, 0.75)';

/**
 * Deriva uma cor estável a partir de uma string (id ou username), para quem ainda não
 * escolheu uma cor de avatar - reaproveita a mesma paleta já usada para colorir capítulos no
 * Mapa da História (`CHAPTER_PALETTE`, `storyGraphLayout.ts`), escolhida para funcionar bem
 * em fundo claro e escuro, em vez de inventar uma paleta nova só para isto.
 */
function colorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CHAPTER_PALETTE.length;
  return CHAPTER_PALETTE[index];
}

export interface AvatarProps {
  /** Cor de fundo escolhida pelo usuário; `null`/ausente cai no fallback determinístico. */
  color?: string | null;
  /** Nome do ícone Ionicons escolhido; `null`/ausente cai no ícone padrão. */
  icon?: string | null;
  /** Usado só quando `color` não foi escolhido, para gerar um fallback estável (id ou username). */
  seed: string;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ color, icon, seed, size = 40 }) => {
  const backgroundColor = color || colorFromSeed(seed);
  const iconName = (icon as keyof typeof Ionicons.glyphMap) || DEFAULT_ICON;
  const iconTint = isColorLight(backgroundColor) ? ICON_TINT_ON_LIGHT : ICON_TINT_ON_DARK;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={iconName} size={size * 0.58} color={iconTint} />
    </View>
  );
};

export default Avatar;
