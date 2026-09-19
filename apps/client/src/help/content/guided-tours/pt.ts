import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'guided-tours',
  title: 'Tours guiados',
  summary:
    'Tours curtos de primeira abertura percorrem cada tela uma vez — pule qualquer um deles, ou desligue todos em Configurações.',
  keywords: ['tour', 'tutorial', 'onboarding', 'guia', 'guia inicial', 'pular'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um tour guiado é uma sobreposição curta que aparece na primeira abertura de uma tela: destaca uma coisa de cada vez — uma lista, uma seção, um grupo do menu — e explica em uma ou duas frases. Tours nunca têm mais de quatro passos, e Pular está sempre visível.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você abre o painel da história pela primeira vez. Um tour aponta o painel-resumo, depois abre sozinho o menu lateral para mostrar onde histórias são construídas, onde são organizadas e onde ficam as configurações — quatro passos, e nunca mais aparece.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra qualquer tela pela primeira vez: o tour dela começa sozinho.',
        'Leia cada passo e avance com Próximo — ou Voltar para reler.',
        'Pule qualquer tour em qualquer passo; pular conta como visto, igual concluir.',
        'Cada passo também oferece esta ajuda, com a versão longa do mesmo assunto.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Um tour só some depois de concluído ou pulado. Sair do app no meio mantém como não visto, então ele aparece de novo na próxima vez.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Tours são por aparelho, como o resto das configurações: funcionam offline e nunca sincronizam. O interruptor geral e o botão de redefinir ficam nas configurações do app.',
    },
    { type: 'path', segments: ['Menu principal', 'Configurações', 'Mostrar tutoriais'] },
    {
      type: 'paragraph',
      text: 'Desligar o interruptor silencia todo tour sem apagar o histórico; redefinir limpa o histórico e religa os tours, para aparecerem de novo.',
    },
    { type: 'seeAlso', pages: ['first-story', 'using-this-help', 'app-settings'] },
  ],
};
export default page;
