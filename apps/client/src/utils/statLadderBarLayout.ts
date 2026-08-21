import { formatStatNumber, OVERSHOOT_RATIO, type StatTier } from './statLadder';

/**
 * Geometria da régua de tiers: uma barra de 0 até o piso do degrau mais alto, com uma marca em
 * cada degrau e, opcionalmente, a posição do valor do personagem.
 *
 * O eixo aqui é **numérico**, e não um degrau por fatia igual como no radar. São perguntas
 * diferentes: o radar compara personagens entre eixos (cada anel é um degrau), a régua mostra o
 * formato da própria escada enquanto o autor digita um número. Com F em 0, C em 50 e A em 400, é
 * a régua que deixa ver que C é uma faixa estreita e A é quase toda a barra.
 *
 * Puro de propósito, como os outros layouts do app.
 */

export interface LadderBarSegment {
  x: number;
  width: number;
  /** Índice do degrau, para alternar o preenchimento e manter a leitura das faixas. */
  index: number;
  label: string;
}

export interface LadderBarMarker {
  x: number;
  label: string;
  /** O rótulo cabe sem encostar no vizinho já desenhado. */
  showLabel: boolean;
}

export interface LadderBarValue {
  x: number;
  display: string;
  /** O valor passou do último degrau e está desenhado na faixa de transbordo. */
  isOverflow: boolean;
}

export interface StatLadderBarLayout {
  width: number;
  /** Onde termina a escada; depois disso vem a faixa de transbordo. */
  ladderWidth: number;
  segments: LadderBarSegment[];
  /** A faixa além do topo da escada, desenhada à parte para não passar por degrau. */
  overflow: { x: number; width: number };
  markers: LadderBarMarker[];
  value: LadderBarValue | null;
}

export interface StatLadderBarInput {
  ladder: readonly StatTier[];
  /** Valor do personagem, ou `null` quando ainda não há um. */
  value: number | null;
  width: number;
  /** Largura média de um caractere do rótulo, para decidir o que cabe. */
  characterWidth?: number;
  /** Margem em que o marcador de valor não pode entrar, para o desenho dele não ser cortado. */
  inset?: number;
}

const DEFAULT_CHARACTER_WIDTH = 6.2;
/** Respiro mínimo entre dois rótulos vizinhos. */
const LABEL_GAP = 6;

/**
 * `null` quando não há régua a desenhar: uma escada de um degrau só (ou nenhum) não tem faixa
 * nenhuma para mostrar, e uma escada cujo topo é zero não tem eixo.
 */
export function buildStatLadderBar(input: StatLadderBarInput): StatLadderBarLayout | null {
  const { ladder, value, width } = input;
  if (ladder.length < 2 || width <= 0) return null;

  const top = ladder[ladder.length - 1]!.minValue;
  if (top <= 0) return null;

  const characterWidth = input.characterWidth ?? DEFAULT_CHARACTER_WIDTH;
  // A faixa de transbordo ocupa a mesma proporção do raio extra do radar, para os dois
  // desenhos contarem a mesma história sobre "acima da escala".
  const ladderWidth = width / (1 + OVERSHOOT_RATIO);
  const positionOf = (raw: number) => (Math.max(0, raw) / top) * ladderWidth;

  const segments: LadderBarSegment[] = ladder.map((tier, index) => {
    const start = positionOf(tier.minValue);
    const next = ladder[index + 1];
    // O último degrau para onde a escada acaba: a faixa de transbordo é desenhada à parte,
    // senão a barra pareceria ir até o fim e ninguém veria onde o topo está.
    const end = next ? positionOf(next.minValue) : ladderWidth;
    return { x: start, width: Math.max(0, end - start), index, label: tier.label };
  });

  /**
   * Onde o rótulo realmente ocupa espaço.
   *
   * As pontas não são desenhadas centradas - o primeiro sai da marca para a direita e o último
   * para a esquerda, senão os dois vazariam da barra. A conta de colisão precisa usar a mesma
   * regra do desenho: supor tudo centrado deixava o penúltimo e o último se sobreporem numa
   * escada numérica ("90" colado em "100").
   */
  const labelExtent = (index: number, x: number, label: string) => {
    const full = label.length * characterWidth;
    if (index === 0) return { start: x, end: x + full };
    if (index === ladder.length - 1) return { start: x - full, end: x };
    return { start: x - full / 2, end: x + full / 2 };
  };

  // Rótulos da esquerda para a direita, pulando os que encostariam no último desenhado. As duas
  // pontas entram sempre: são elas que dizem onde a escada começa e onde ela termina.
  let lastLabelEnd = Number.NEGATIVE_INFINITY;
  const markers: LadderBarMarker[] = ladder.map((tier, index) => {
    const x = positionOf(tier.minValue);
    const extent = labelExtent(index, x, tier.label);
    const isEnd = index === 0 || index === ladder.length - 1;
    const showLabel = isEnd || extent.start >= lastLabelEnd + LABEL_GAP;
    if (showLabel) lastLabelEnd = extent.end;
    return { x, label: tier.label, showLabel };
  });

  // O último tem prioridade: quem já foi aceito antes dele e ficaria por baixo sai.
  const lastIndex = markers.length - 1;
  if (lastIndex > 0) {
    const lastStart = labelExtent(
      lastIndex,
      markers[lastIndex]!.x,
      markers[lastIndex]!.label,
    ).start;
    for (let index = lastIndex - 1; index > 0; index -= 1) {
      const marker = markers[index]!;
      if (!marker.showLabel) continue;
      if (labelExtent(index, marker.x, marker.label).end + LABEL_GAP > lastStart) {
        marker.showLabel = false;
      } else break;
    }
  }

  const inset = input.inset ?? 0;
  const clamp = (x: number) => Math.min(width - inset, Math.max(inset, x));

  return {
    width,
    ladderWidth,
    segments,
    overflow: { x: ladderWidth, width: width - ladderWidth },
    markers,
    value:
      value === null
        ? null
        : {
            x: clamp(Math.min(width, positionOf(value))),
            display: formatStatNumber(value),
            isOverflow: value > top,
          },
  };
}
