import {
  avatarColorFromSeed,
  DEFAULT_AVATAR_ICON,
  isColorLight,
  type ShowcaseOwner,
} from '@keres/shared';
import avatarIcons from 'virtual:keres-avatar-icons';

/**
 * O mesmo avatar que a pessoa escolheu no aplicativo: o ícone do Ionicons sobre a cor dela.
 *
 * Espelha `apps/client/src/components/common/display/Avatar/Avatar.tsx` - inclusive a cor de
 * reserva determinística por semente e o tom do ícone decidido pela luminância do fundo. As
 * regras vêm de `@keres/shared`, então as duas telas não podem divergir; o que é local aqui é
 * só o desenho em SVG, já que o site não tem a fonte de ícones do app.
 */

/** O ícone é semi-transparente sobre a cor, para o desenho não competir com ela. */
const ICON_TINT_ON_LIGHT = 'rgba(0, 0, 0, 0.6)';
const ICON_TINT_ON_DARK = 'rgba(255, 255, 255, 0.75)';

/** Os SVGs do Ionicons vêm no viewBox de 512. */
const ICON_VIEWBOX = 512;

export function OwnerAvatar({ owner, size = 32 }: { owner: ShowcaseOwner; size?: number }) {
  const background = owner.avatarColor || avatarColorFromSeed(owner.username);
  // Um ícone que este build não conhece (app mais novo) cai no padrão em vez de sumir.
  const iconMarkup = avatarIcons[owner.avatarIcon ?? ''] ?? avatarIcons[DEFAULT_AVATAR_ICON];
  const tint = isColorLight(background) ? ICON_TINT_ON_LIGHT : ICON_TINT_ON_DARK;
  const inset = size * 0.21;

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background }}
      title={`${owner.username}#${owner.tag}`}
      aria-hidden="true"
    >
      <svg
        width={size - inset * 2}
        height={size - inset * 2}
        viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
        fill={tint}
        // O conteúdo vem do pacote ionicons, recortado em tempo de build - não de dados
        // enviados por ninguém.
        dangerouslySetInnerHTML={{ __html: iconMarkup }}
      />
    </span>
  );
}
