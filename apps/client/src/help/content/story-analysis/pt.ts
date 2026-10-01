import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-analysis',
  title: 'Análise da história',
  summary: 'Encontre ligações narrativas que podem precisar de revisão.',
  keywords: [
    'análise',
    'cena isolada',
    'escolha quebrada',
    'aviso',
    'alcançabilidade',
    'progresso',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A análise verifica a estrutura da história e mostra avisos sobre relações que parecem incompletas ou contraditórias. Um conjunto de checagens rápidas aparece assim que você abre a tela; uma checagem mais profunda, que verifica se cada cena e escolha realmente pode ser alcançada, só roda quando você pede.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Se uma escolha leva a uma cena removida, a análise aponta a escolha para que você escolha outro destino ou a exclua.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Análise da história'] },
    {
      type: 'steps',
      items: [
        'Abra a análise. Os avisos rápidos carregam na hora.',
        'Use o controle no topo para escolher se elementos não referenciados são relatados. Confirmar salva a escolha; Cancelar deixa a história sem alteração.',
        'Em uma história ramificada, toque em Verificar alcançabilidade e lógica das escolhas para também procurar cenas e escolhas que nunca podem ser alcançadas de verdade.',
        'Espere a barra de progresso terminar, ou toque em Cancelar para interromper.',
        'Leia cada aviso e abra o elemento indicado.',
        'Corrija a ligação, a cena, a escolha ou o campo quando a observação fizer sentido.',
        'Rode a verificação de novo para conferir o resultado.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A checagem mais profunda pode demorar em uma história ramificada grande, por isso ela não roda sozinha - toque no botão sempre que quiser um resultado atualizado. Só uma roda por vez, e sair da tela interrompe a checagem.',
    },
    { type: 'heading', level: 2, text: 'Quantas coisas a história tem' },
    {
      type: 'paragraph',
      text: 'O botão de gráfico no canto superior direito abre uma segunda tela que conta tudo o que há na história, tipo por tipo: personagens, cenas, escolhas, tags, arquivos de mídia e também as ligações entre eles, como uma tag aplicada a um personagem ou um personagem colocado em uma cena. Cada tipo tem seu ícone, e a barra ao lado mostra como ele se compara ao maior.',
    },
    {
      type: 'steps',
      items: [
        'Abra a análise da história e toque no botão de gráfico no canto superior direito.',
        'Leia o total no alto: são todos os itens da história, menos favoritos e comentários.',
        'Toque em NOME ou QUANTIDADE para ordenar a lista; toque no mesmo de novo para inverter a ordem.',
      ],
    },
    {
      type: 'paragraph',
      text: 'É a mesma contagem que o plano de um servidor usa para limitar quanto uma história pode ter. Para uma história que está só neste dispositivo, nada a limita e a tela apenas mostra o que existe. Para uma história ligada a um servidor, a tela mostra também o nome do plano e o quanto falta para os limites, por exemplo 251 / 500 para esta história, e o total de todas as histórias que o plano cobre, quando ele tem um. A barra muda para a cor de aviso perto do limite, e fica vermelha no limite.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'O plano vem do servidor, então não aparece enquanto você está sem conexão. A contagem em si aparece sempre, e inclui o que ainda não foi sincronizado.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Um aviso não muda nada por conta própria. Corrigir o elemento atualiza cenas, escolhas, mapas e buscas que usam essa informação.',
    },
    { type: 'heading', level: 2, text: 'O que o Keres relata, e o que ele deixa para você' },
    {
      type: 'paragraph',
      text: 'Alguns achados são sobre a história estar quebrada: uma escolha apontando para uma cena que não existe mais, uma cena que nada alcança, uma numeração de capítulos que o app não consegue reordenar. Esses são sempre relatados.',
    },
    {
      type: 'paragraph',
      text: 'Outros são sobre elementos que existem sem serem usados em lugar nenhum - um local em nenhuma cena, um personagem sem relações, uma etiqueta sem uso. Se isso é problema é decisão sua, não do Keres: numa bíblia de mundo, um lugar onde ninguém foi ainda é simplesmente um lugar. Vêm desligados e podem ser ligados em Relatar elementos não referenciados no topo desta tela. Confirme a alteração antes de sair.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Um campo que você marcou como obrigatório continua sendo relatado quando vazio, independente desse ajuste: essa é uma regra que você definiu, não uma opinião do app.',
    },
    { type: 'seeAlso', pages: ['scenes', 'choices', 'story-map', 'story-type'] },
  ],
};
export default page;
