# Sketch v2 — prancheta de esboço (traços + preenchimentos, sem raster)

**Status:** implementado (Fases 1–5 de código); falta medir desempenho em aparelho (ver "Riscos em aberto").
**Origem:** o v1 (commit `820ecc60`) era uma terceira variante de Board/Mapa: cada traço virava um
`CanvasOverlay` selecionável, ferramenta momentânea, sem borracha nem balde, teto de 200 objetos.
**Objetivo:** ferramenta básica e rica de esboço — pincel, borracha, balde, camadas, seleção/mover, tamanho de
folha, export e Galeria — leve o bastante para guardar muitos, útil para roteiro e rascunho de quadrinhos.

## Decisões congeladas

- **Sem bitmap persistido.** Cada camada guarda uma lista de *itens* (traços e preenchimentos) num único
  string compacto dentro do JSON do sketch. O único PNG é o export que o usuário pede.
- **Itens autocontidos e transformáveis.** A borracha é **geométrica** (corta o traço e o divide), nunca
  `BlendMode.Clear`; por isso mover/escalar/girar um trecho do desenho é só aplicar uma matriz aos pontos.
- **Balde = contorno vetorial.** O flood fill roda em memória sobre o que o usuário vê; o que se guarda são os
  anéis (even-odd) da região, não pixels. Resultado idêntico em toda plataforma. Preenchimentos ficam num bloco
  *abaixo dos traços* da camada (a linha sempre cobre a borda da cor).
- **Objetos (texto, balão, carimbo) continuam vetoriais** e ficam sempre acima das camadas de desenho.
- **Sem migração:** o v1 nunca saiu em release; o schema foi reescrito no lugar (sem `version`, sem compat).
- Borracha corta traços na hora (geométrica) e preenchimentos ao levantar a caneta: o preenchimento é pintado numa máscara, o caminho é apagado e a região restante é rastreada de volta em anéis. Durante o gesto, o caminho aparece como um traço Clear sobre a camada.
- Seleção por laço: modo "traços inteiros" (≥ 50% dentro) ou "cortar no laço". Preenchimentos sempre inteiros.

## Formato (`packages/shared/sketch/`)

```
layer.data = base64( deflate( bytes ) )          // '' = camada vazia
bytes      = u8 fmt(1) | varint nItens | itens
traço      = u8 0 | u8 pincel | rgb | alpha | varint tamanho*4 | varint n | n pontos (delta, zigzag, 1/4 px)
preench.   = u8 1 | rgb | alpha | varint nAnéis | por anel: varint n | n pontos (delta)
```

- Pincéis: `pen`, `marker`, `highlighter` (traço sólido com opacidade; sem texturas, sem blend modes).
- Tetos: itens/camada, pontos/traço, **bytes por sketch** (`MAX_SKETCH_TOTAL_DATA_LENGTH`) e um teto de bytes
  *depois* de descomprimir (`MAX_SKETCH_LAYER_DECODED_BYTES`) contra bomba de descompressão no servidor.
- O editor guarda os itens por referência (imutáveis): snapshots do histórico compartilham tudo, o histórico
  tem 300 entradas e `doc !== savedDoc` é o dirty check (O(1)).
- **Compactação no save:** itens degenerados saem e os traços são re-simplificados (só na cópia persistida;
  o undo da sessão continua exato). A borracha geométrica já não deixa lixo, então não há "botão compactar".
- Rascunho (WIP): grava só `content` codificado + `baseVersion`, com atraso de 1,2 s (a codificação é a parte
  cara) e flush ao ir para background. Não há segunda cópia do sketch salvo.

## Experiência

- Ferramenta fica **armada** (modo, não gesto). Um dedo desenha; dois dedos movem/ampliam/giram a visão; a
  ferramenta mão devolve o dedo único à câmera.
- Faixa de ferramentas rolável (mão, seleção, pincel, borracha, balde, conta-gotas, linha, retângulo,
  elipse, texto, balão, carimbo | desfazer, refazer, camadas, folha) e faixa de opções contextual logo abaixo
  (tipo de pincel, cor, tamanho, opacidade; tolerância e escopo do balde; ações da seleção).
- Atalhos no computador: `B E G I V H L R O T`, `[` `]` (tamanho), `Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y`.
- Camadas: ordenar, ocultar, bloquear, opacidade, duplicar, mesclar com a de baixo, limpar, apagar.
- Folha: presets (A4, A5, quadrado, wide, webtoon) ou tamanho livre, orientação, fundo (papel, branco,
  transparente). Mudar o tamanho nunca move o desenho.
- Export: SVG (traços como paths), PNG (inclusive transparente) e "salvar na Galeria" (vincula a capa).
- Avisos: camada oculta/bloqueada/cheia, sketch perto de 80% do limite e no limite.

## O que foi verificado e como

- Motor puro (`packages/shared`): codec (round-trip, bomba, truncado), geometria (alisamento com cantos,
  borracha, laço, transformações, compactação), balde (flood fill + contornos com furos), seleção, documento.
- Renderização checada contra **CanvasKit real** (`canvaskit-wasm`, o mesmo motor do web): paths, fills even-odd,
  flood fill sobre pixels reais e borracha. Achou e corrigiu o arredondamento de cantos.
- Cliente: gestos (`SketchInputLayer`), camadas/pictures, barra de opções, slider, rascunho, SVG e a tela
  inteira (histórico, borracha, balde, laço, mover, duplicar, salvar, reverter, rascunho).
- API: sync de sketch com desenho real e rejeição de dado corrompido.

## Riscos em aberto (não medidos — dependem de aparelho)

1. **Desempenho do pan/zoom com páginas muito cheias:** cada frame reproduz todas as `Picture`s. Se pesar,
   mitigar com um cache raster descartável durante o gesto de câmera.
2. **Tempo de abrir** um sketch grande (reproduzir milhares de traços): hoje síncrono.
3. **Memória:** só `Picture`s em RAM, sem bitmaps; o `SkSurface` do balde é temporário (≤ 1800 px de lado).
4. **Skia no web:** `createPicture`, `MakeOffscreen` e `readPixels` não foram exercitados no navegador real
   (só o CanvasKit direto). Validar no build web e em Android/iOS.
5. **Sync:** o `content` inteiro vai a cada save (um sketch grande = alguns centenas de KB por entrada do log).
   Save manual mantém isso baixo; se virar problema, dividir o dado por camada.

## Fora do escopo desta versão
Multi-página (livro de esboço), pressão/inclinação de caneta, texturas de pincel,
miniatura automática na lista, export com camadas (ORA).
