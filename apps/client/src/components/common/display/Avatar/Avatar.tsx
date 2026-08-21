import { avatarColorFromSeed, DEFAULT_AVATAR_ICON } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { isColorLight } from '../../../../theme/commonStyles';

/**
 * O ícone padrão, a paleta de reserva e a semente de cor moram em `@keres/shared`: o site
 * público desenha exatamente o mesmo avatar de quem publicou uma história, e duas cópias das
 * mesmas regras acabariam divergindo.
 */

/**
 * O cinza semi-transparente original ficava pouco visível em várias cores de fundo da paleta -
 * preto ou branco (também semi-transparentes, pro "cinza/transparente" do pedido original)
 * garantem contraste em qualquer cor escolhida, decidido pela mesma luminância que já orienta
 * texto sobre cor no resto do app (`isColorLight`, usado por Tag).
 */
const ICON_TINT_ON_LIGHT = 'rgba(0, 0, 0, 0.6)';
const ICON_TINT_ON_DARK = 'rgba(255, 255, 255, 0.75)';

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
  const backgroundColor = color || avatarColorFromSeed(seed);
  const iconName = (icon as keyof typeof Ionicons.glyphMap) || DEFAULT_AVATAR_ICON;
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
