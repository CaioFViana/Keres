# Plano — Canvas Virtual para Boards e Mapas de Localização

## Objetivo

Substituir o modelo atual de uma superfície SVG que cresce conforme o conteúdo por uma viewport
fisicamente finita e visualmente ilimitada. A pessoa poderá panear, dar zoom e mover elementos sem
que o tamanho de uma `View` ou de um SVG seja proporcional à distância entre os elementos.

O trabalho cobre os dois documentos espaciais que são editáveis livremente:

- **Board**: cards, notas e arestas próprias do Board.
- **Mapa de Localização**: imagens-base, pontos de Location, marcadores e relações cartográficas.

Ele não altera o formato conceitual desses documentos, seus fluxos de save nem a semântica de
conexões. Coordenadas continuam pertencendo ao conteúdo JSON do Board ou do Mapa.

## Diagnóstico que motiva a mudança

O código atual chama a superfície de extensível, mas ela ainda é um único canvas físico:

1. `boardCanvasBounds` e `locationMapCanvasBounds` calculam um retângulo que contém todos os
   elementos do documento.
2. `useGrowingCanvasBounds` aumenta esse retângulo em páginas de 256 unidades e não o reduz durante
   a vida do componente.
3. `GraphCanvasFrame` cria um `Animated.View` com a largura e a altura desse retângulo; Board e
   Mapa passam as mesmas dimensões aos seus SVGs.

O limitador adicionado em `aa5f4c5` impede que uma única amostra ruim do gesto atravesse todas as
páginas, mas limita **a coordenada de um elemento**, não a área total do desenho. Um Board pode
alcançar cerca de 34 mil unidades por lado com os limites atuais; um Mapa com imagens pode passar
de 37 mil. Além de exceder limites práticos de layout/SVG nativo, o zoom mínimo amplia cada pixel
do gesto em coordenadas de mundo e força várias mudanças de tamanho durante um arraste rápido.

A causa raiz, portanto, é modelar um mundo potencialmente grande como uma única superfície nativa
de tamanho potencialmente grande. Não é uma fila de páginas que simplesmente deveria carregar mais
rápido.

## Decisão de arquitetura

Criar uma infraestrutura compartilhada de **viewport espacial virtualizada**, destinada apenas a
canvases livres. Ela terá quatro conceitos separados:

| Conceito | Responsabilidade |
| --- | --- |
| Documento mundial | Dados persistidos: elementos, posições, dimensões e conexões. |
| Câmera | Posição e zoom temporários; não é salva no documento. |
| Janela de renderização | Retângulo mundial atualmente visível, com margem de pré-renderização. |
| Origem local | Âncora próxima da câmera que converte posições mundiais em valores pequenos de tela. |

A `View` raiz e a camada SVG terão sempre dimensões derivadas da viewport do aparelho, nunca do
bounds completo do documento. A origem local evita também paths ou `left`/`top` gigantes, mesmo
quando uma coordenada mundial é distante.

O nome sugerido para a base é `FreeformCanvasViewport`; ela não deve ser uma modificação implícita
de todos os consumidores de `GraphCanvasFrame`, pois os demais grafos são derivados e possuem um
tamanho total naturalmente conhecido.

## Contrato de renderização

### Câmera sem render React por pixel

Durante pan e pinch, a câmera ficará em `ref`s e valores `Animated`, como já ocorre em
`usePanZoomCanvas`. O gesto atualiza somente a transformação nativa/animada; não chama `setState`
para cada movimento.

A janela virtual será atualizada no máximo uma vez por frame e somente quando necessário:

- ao cruzar o limite da margem de pré-renderização;
- ao mudar materialmente o zoom;
- ao iniciar/finalizar um arraste de elemento;
- quando o conteúdo for salvo, revertido ou recebido por sincronização.

A janela deve conter a viewport mais uma margem de pelo menos uma tela em cada direção. Isso evita
montagem/desmontagem visível na borda e reduz o número de atualizações durante pan normal.

### Elementos visíveis

Cards, notas, imagens e pontos serão filtrados por interseção entre seu retângulo mundial e a
janela expandida. Cada elemento montado recebe posição **local de tela**, calculada a partir da
origem local e do zoom atual.

O arrastado fica sempre montado, mesmo se temporariamente sair da janela. A atualização visual do
elemento ativo continua limitada a uma por `requestAnimationFrame`; a persistência no documento
continua ocorrendo somente ao soltar.

### Conexões visíveis, mesmo sem os dois nós montados

Conexões serão calculadas a partir do documento completo, e não a partir dos componentes de nó
renderizados. Cada segmento será testado contra a janela de renderização:

| Situação | Renderização |
| --- | --- |
| Ambos os extremos visíveis | Conexão completa, rótulo e seta normais. |
| Um extremo visível | Linha até a borda da viewport; em conexão direcional, indicador apontando para fora. |
| Ambos fora, mas segmento atravessa a viewport | Apenas o trecho entre as bordas da viewport. |
| Segmento não cruza a viewport | Não renderizar. |

Os Mapas de Localização usam segmentos retos e podem usar um algoritmo de clip de linha contra
retângulo. Board deve expor geometria suficiente para obter o bounds/interseção de sua aresta; se
uma rota não for reta, o seu caminho deve ser clipado ou subdividido antes da projeção. Rótulos só
aparecem quando sua âncora estiver na janela expandida.

## Exportação SVG

A virtualização é exclusivamente interativa. A exportação deve continuar a consumir o documento
inteiro, sem culling e sem a câmera atual:

1. calcular bounds completos de todos os elementos;
2. normalizar a menor coordenada para uma margem positiva;
3. renderizar todas as imagens, nós, cards, rótulos e conexões;
4. gerar o SVG vetorial final como hoje.

Não reutilizar a janela virtual para exportar: ela deve representar a tela, enquanto o arquivo deve
representar o Board ou o Mapa completo. O exportador pode manter a escala espacial real; limites
de segurança do documento ainda se aplicam para impedir arquivos absurdamente extensos.

## Limites e validação de dados

A virtualização remove o limite físico da tela, mas não dispensa limites de dados. Coordenadas
infinitas ou spans de bilhões ainda são inválidos para cálculos, exportação e sincronização.

Adicionar em `packages/shared` regras explícitas para:

- coordenadas finitas dentro de um domínio mundial documentado;
- largura e altura dentro dos limites já apresentados pela interface;
- extensão máxima do documento (`maxX - minX`, `maxY - minY`) e, se necessário, sua área;
- mensagem de validação compreensível quando uma operação exceder o domínio.

Essas regras devem ser usadas pelos schemas de Board e Location Map, portanto serão aplicadas por
cliente, API, importação, sync e operações locais. Dados antigos fora do novo envelope precisam de
uma estratégia deliberada: recusar com explicação, ou normalizar coordenadas preservando a posição
relativa. A decisão deve ser tomada antes de tornar a validação obrigatória.

## Implementação em fases

### Fase 0 — Segurança imediata e instrumentação

1. Criar testes puros para o cálculo de span/área e para dados inválidos.
2. Aplicar o envelope compartilhado a Board e Mapa, sem alterar silenciosamente documentos salvos.
3. Registrar, em desenvolvimento, tamanho da superfície antiga e quantidade de elementos/arestas
   quando um limite for atingido, para confirmar o cenário em dispositivos reais.
4. Corrigir a assimetria dos bounds de pontos de Mapa: o círculo de 44 unidades termina 22 unidades
   após o centro, não 44. Isto não é a causa do crash, mas evita área e margem extras.

Esta fase é uma contenção. Ela reduz a chance de crash antes da viewport virtual existir, mas não é
o resultado final desejado.

### Fase 1 — Geometria compartilhada da viewport

1. Adicionar tipos puros: `WorldPoint`, `WorldRect`, `Camera`, `RenderWindow` e `LocalOrigin`.
2. Implementar projeção mundo → tela e tela → mundo, considerando zoom e origem local.
3. Implementar interseção de retângulos para cards e imagens.
4. Implementar clip de segmento contra retângulo, com testes para todas as quatro situações de
   conexão descritas acima.
5. Definir margem de overscan e tamanho lógico de célula como constantes configuráveis, sem
   expô-las à interface inicialmente.

Todo este código deve ser puro e preferencialmente viver em `packages/shared/graphs` quando não
depender de React Native.

### Fase 2 — Base React Native da viewport

1. Criar `FreeformCanvasViewport` sobre uma `View` de `flex: 1` e tamanho medido da tela.
2. Adaptar a parte reaproveitável de `usePanZoomCanvas`, preservando pan, pinch, controles de zoom,
   acessibilidade e a regra de o filho manter seu próprio gesto durante arraste.
3. Manter transformação animada durante movimentos dentro da janela atual.
4. Recalcular a origem local e o conjunto visível apenas ao cruzar os limites de overscan, sempre
   com compensação para que nada pule sob o ponteiro.
5. Garantir cleanup de frames pendentes ao desmontar a tela ou trocar de documento.

### Fase 3 — Migração de Board

1. Trocar o uso de `useGrowingCanvasBounds` em `BoardCanvas` pela viewport virtual.
2. Projetar `BoardNodeView` para coordenadas locais, sem depender de um SVG de tamanho mundial.
3. Criar uma camada de arestas virtualizadas, usando a geometria de Board e clip para a janela.
4. Preservar seleção, resize, conexão por arraste, ordem `zIndex`, cards de Gallery e ghost pins.
5. Confirmar que adicionar um pin ainda o posiciona próximo ao centro mundial atualmente visível.

### Fase 4 — Migração de Mapa de Localização

1. Trocar o uso de `useGrowingCanvasBounds` em `LocationMapCanvas` pela mesma viewport.
2. Virtualizar imagens, pontos e marcadores por interseção de retângulo.
3. Migrar relações `connected_to`, `contains`, textos de relação e conexões de marcadores para a
   camada de linhas clipadas.
4. Preservar imagem travada, resize proporcional, destinos por pressionar e segurar, camadas e
   abertura dos sheets.
5. Confirmar que uma imagem grande parcialmente visível continua recebendo toque corretamente.

### Fase 5 — Remoção do modelo antigo

1. Remover `useGrowingCanvasBounds`, `growingCanvasBounds` e o limitador cuja única finalidade é
   avançar páginas físicas, depois de migrados os dois consumidores.
2. Manter um limite de domínio mundial de dados, mas remover a associação entre esse domínio e o
   tamanho de uma `View`.
3. Atualizar comentários, help técnico e testes que ainda chamem a solução de “canvas infinito por
   páginas”.

## Testes e critérios de aceite

### Testes puros

- Projeção e inversão de coordenadas para múltiplos zooms e origens negativas.
- Seleção de elementos visíveis com overscan.
- Clip de linhas: dentro, fora, cruzando, tangente e direcional.
- Bounds/exportação normalizados com elementos positivos e negativos.
- Validação de coordenadas, dimensões e spans de Board e Mapa.

### Testes de componente

- Pan não altera a quantidade de renders React por pixel.
- Cruzar uma fronteira de célula mantém o elemento visualmente fixo sob o ponteiro.
- Nó/imagem arrastado não desmonta ao sair da janela original.
- Conexão para elemento fora da tela termina corretamente na borda.
- Pinch permanece funcional quando iniciado sobre card, ponto ou imagem.

### Testes de integração/manual

- Arrastar rapidamente em zoom mínimo, em todas as direções, sem crash ou salto visual.
- Documento com elementos muito separados permanece navegável e não cria uma `View`/SVG maior que
  a viewport acrescida da margem interna definida.
- Board com até 500 nós/1000 arestas e Mapa com limites máximos de elementos mantêm resposta
  aceitável em dispositivo móvel alvo.
- Salvar, reabrir, sincronizar, importar, clonar, reverter e resolver conflito preservam posições.
- Exportações SVG incluem todo o documento, inclusive conteúdo fora da viewport no momento do
  export.

## Não objetivos

- Alterar o modelo de sincronização de `content` como documento único.
- Tornar a posição da câmera um dado compartilhado ou persistido.
- Introduzir edição colaborativa em tempo real.
- Alterar a semântica de relações reais de Location ou arestas particulares de Board.
- Substituir os demais grafos derivados por uma viewport virtual sem necessidade demonstrada.

## Ordem recomendada

Entregar Fase 0 em uma alteração pequena e verificável; em seguida implementar Fases 1 e 2 com
testes puros antes de migrar qualquer tela. Migrar Board primeiro, por ter um único tipo de
conexão visual, e então o Mapa de Localização. A remoção da infraestrutura de páginas só acontece
depois que os dois estiverem sobre a nova base.
