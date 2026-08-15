/**
 * Um valor de `AttributeType.DATE` é uma data civil *flutuante*: não carrega fuso horário
 * nenhum, de propósito. `15/01/2024 10:30` é a hora interna da história, não um instante no
 * tempo real - tem que renderizar igual em Brasília, Tóquio e Londres.
 *
 * Isso obriga três cuidados que este arquivo centraliza, e que nenhum outro ponto do código
 * deve reimplementar:
 *
 * 1. O valor NUNCA é parseado por `new Date(string)`. `new Date('2024-01-15')` é interpretado
 *    como meia-noite UTC e imprime 14/01 em qualquer fuso negativo - o bug clássico. Aqui o
 *    parser é uma regex que extrai os componentes.
 * 2. `Date` só é construído em UTC (`Date.UTC` + `getUTC*`), inclusive para descobrir o dia da
 *    semana, e toda formatação passa `timeZone: 'UTC'`. Assim o fuso do dispositivo não
 *    consegue deslocar nada.
 * 3. `Date.UTC(15, 0, 1)` significa 1915, não ano 15 - por isso o ano é sempre reaplicado com
 *    `setUTCFullYear` depois da construção.
 */

export interface AttributeDateParts {
  /** 1 a 9999. */
  year: number;
  /** 1 a 12 (não é índice de mês do JS). */
  month: number;
  day: number;
  /** `null` nos dois campos significa "só data, sem hora". */
  hour: number | null;
  minute: number | null;
}

/** `YYYY-MM-DD`, opcionalmente seguido de `THH:mm` (ou ` HH:mm`, aceito na entrada). */
const CANONICAL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/;

export const MIN_ATTRIBUTE_DATE_YEAR = 1;
export const MAX_ATTRIBUTE_DATE_YEAR = 9999;

/**
 * `Date` em UTC representando os componentes recebidos. Separado porque é o único jeito seguro
 * de alimentar o `Intl` sem que o fuso do dispositivo entre na conta.
 */
export function toUtcDate(parts: AttributeDateParts): Date {
  const date = new Date(
    Date.UTC(2000, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0),
  );
  // Anos de 1 a 99 seriam remapeados para 1901-1999 por `Date.UTC` - reaplicar é o que evita.
  date.setUTCFullYear(parts.year);
  return date;
}

/**
 * Componentes de uma string canônica, ou `null` se a string não for uma data válida. Rejeita
 * data impossível (30 de fevereiro) por round-trip, não só por faixa numérica.
 */
export function parseAttributeDate(raw: string | null | undefined): AttributeDateParts | null {
  if (!raw) {
    return null;
  }
  const match = CANONICAL_DATE_REGEX.exec(raw.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hasTime = match[4] !== undefined;
  const hour = hasTime ? Number(match[4]) : null;
  const minute = hasTime ? Number(match[5]) : null;

  if (year < MIN_ATTRIBUTE_DATE_YEAR || year > MAX_ATTRIBUTE_DATE_YEAR) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  if (hasTime && (hour! > 23 || minute! > 59)) {
    return null;
  }

  const parts: AttributeDateParts = { year, month, day, hour, minute };
  const utc = toUtcDate(parts);
  // 2024-02-30 vira 2024-03-01 na construção; se os componentes não voltarem iguais, a data
  // simplesmente não existe no calendário.
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return parts;
}

export function isValidAttributeDate(raw: string | null | undefined): boolean {
  return parseAttributeDate(raw) !== null;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** Componentes → string canônica (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm`). */
export function formatAttributeDate(parts: AttributeDateParts): string {
  const date = `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
  if (parts.hour === null || parts.minute === null) {
    return date;
  }
  return `${date}T${pad(parts.hour, 2)}:${pad(parts.minute, 2)}`;
}

/** Dia da semana, 0 (domingo) a 6 (sábado). Imune a fuso por ser lido em UTC. */
export function attributeDateWeekday(parts: AttributeDateParts): number {
  return toUtcDate(parts).getUTCDay();
}

/** Quantos dias tem o mês (`month` de 1 a 12), respeitando ano bissexto. */
export function daysInMonth(year: number, month: number): number {
  const date = new Date(Date.UTC(2000, 0, 1));
  // Índice `month` já é o mês SEGUINTE (a API é 0-based), e dia 0 dele é o último deste.
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function safeFormat(
  language: string,
  options: Intl.DateTimeFormatOptions,
  date: Date,
  fallback: string,
): string {
  try {
    return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(date);
  } catch {
    // Runtime sem ICU completo: a string canônica ainda é legível, melhor que quebrar a tela.
    return fallback;
  }
}

/**
 * Data no idioma da APLICAÇÃO (não do dispositivo), sempre com o dia da semana, e com a hora
 * só quando o valor tem hora. `null` quando a string não é uma data canônica - o chamador
 * decide o que fazer (as telas mostram o valor cru, para não sumir com texto legado).
 */
export function formatAttributeDateForDisplay(
  raw: string | null | undefined,
  language: string,
): string | null {
  const parts = parseAttributeDate(raw);
  if (!parts) {
    return null;
  }

  const utc = toUtcDate(parts);
  const canonical = formatAttributeDate(parts);
  const hasTime = parts.hour !== null && parts.minute !== null;

  return safeFormat(
    language,
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    },
    utc,
    canonical,
  );
}

/** Rótulo curto do mês + ano para o cabeçalho do calendário ("janeiro de 2024"). */
export function formatAttributeDateMonthLabel(
  year: number,
  month: number,
  language: string,
): string {
  const utc = toUtcDate({ year, month, day: 1, hour: null, minute: null });
  return safeFormat(
    language,
    { year: 'numeric', month: 'long' },
    utc,
    `${pad(year, 4)}-${pad(month, 2)}`,
  );
}

/**
 * Iniciais/abreviações dos 7 dias da semana no idioma do app, começando no domingo (mesma
 * ordem de `attributeDateWeekday`). Derivadas do `Intl` em vez de escritas à mão em cada
 * arquivo de tradução.
 */
export function attributeDateWeekdayLabels(language: string): string[] {
  // 2023-01-01 foi um domingo - âncora arbitrária só para varrer os 7 dias.
  return Array.from({ length: 7 }, (_, index) => {
    const utc = new Date(Date.UTC(2023, 0, 1 + index));
    return safeFormat(language, { weekday: 'short' }, utc, String(index));
  });
}
