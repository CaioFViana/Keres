import type { ShowcaseOwner } from '@keres/shared';

/**
 * O avatar do autor: a cor que a pessoa escolheu no app, com a inicial do nome por cima.
 *
 * O app desenha um glifo do Ionicons (`avatarIcon`) dentro desse círculo. Aqui não: trazer a
 * fonte de ícones inteira para o site só por isso custaria mais em download do que entrega, e
 * a cor - que é a metade reconhecível do avatar - continua sendo a mesma. Quando não há cor
 * escolhida, o círculo usa o realce do tema.
 */
export function OwnerAvatar({ owner, size = 32 }: { owner: ShowcaseOwner; size?: number }) {
  const initial = (owner.username[0] ?? '?').toUpperCase();
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: owner.avatarColor ?? 'var(--story-primary, var(--color-primary))',
        fontSize: Math.round(size * 0.45),
      }}
      title={`${owner.username}#${owner.tag}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
