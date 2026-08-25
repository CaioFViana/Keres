/** O mínimo que a regra precisa saber de uma cena. */
export interface SceneStartFinishFlags {
  id: string;
  isStart?: boolean | null;
  isFinish?: boolean | null;
}

/**
 * Numa história linear existe no máximo uma cena de início e uma de fim; se o arquivo importado
 * trouxer mais de uma, a primeira vence e as demais perdem a marca.
 *
 * Importar acontece nos dois lados - o cliente lê um `.keres` do disco, o servidor recebe uma
 * história publicada - e os dois faziam a mesma varredura, linha por linha, cada um na sua
 * cópia. A decisão de quais cenas perdem a marca é a mesma; o que muda é só o `update` que cada
 * banco executa depois.
 */
export function scenesToUnflag(scenes: readonly SceneStartFinishFlags[]): {
  start: string[];
  finish: string[];
} {
  const start: string[] = [];
  const finish: string[] = [];
  let startSeen = false;
  let finishSeen = false;

  for (const scene of scenes) {
    if (scene.isStart) {
      if (startSeen) start.push(scene.id);
      else startSeen = true;
    }
    if (scene.isFinish) {
      if (finishSeen) finish.push(scene.id);
      else finishSeen = true;
    }
  }

  return { start, finish };
}
