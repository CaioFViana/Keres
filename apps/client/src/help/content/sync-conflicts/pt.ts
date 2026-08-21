import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-conflicts',
  title: 'Revisando conflitos de sincronização',
  summary:
    'Uma faixa no painel da história permite conciliar mudanças locais e do servidor sem interromper o que você estava fazendo.',
  keywords: ['conflito', 'manter meu', 'servidor', 'sincronização', 'faixa', 'revisão'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um conflito é registrado quando o aplicativo não consegue aplicar automaticamente uma mudança local e uma mudança do servidor no mesmo elemento. Ele nunca aparece sozinho: uma faixa vermelha surge no painel da história aberta mostrando quantos conflitos aguardam revisão, e tocar nela abre a folha de revisão de conflitos.',
    },
    {
      type: 'paragraph',
      text: 'Muitas alterações que antes apareciam aqui não aparecem mais: se você e o servidor mudaram campos diferentes do mesmo elemento, o aplicativo mescla as duas mudanças automaticamente e só pergunta quando o mesmo campo foi realmente alterado dos dois lados.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você renomeia uma relação entre personagens offline enquanto outra pessoa exclui um desses personagens no servidor. O painel mostra a faixa com um conflito pendente; a folha de revisão nomeia os dois personagens em vez de mostrar ids crus.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra o painel da história e toque na faixa de conflitos quando ela aparecer.',
        'A folha de revisão lista os conflitos em dois grupos: relações e conteúdo.',
        'Para uma relação, ou para um conflito sem nenhum campo realmente disputado (como uma exclusão), toque no ícone de check para manter sua cópia ou no ícone de nuvem para manter a do servidor - sem precisar abrir outra tela.',
        'Para um conflito de conteúdo com vários campos disputados, toque na linha para abrir a comparação campo a campo, escolha Minha ou Servidor em cada campo, e confirme com Manter o meu (ou Aplicar mesclagem, quando os campos são mistos) ou Manter o servidor.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A escolha define a versão que volta a sincronizar. Um conflito ainda não revisado continua pendente e pode impedir que aquela alteração específica seja enviada, mas nunca bloqueia o resto do aplicativo.',
    },
    {
      type: 'seeAlso',
      pages: ['story-dashboard', 'sync-basics', 'activity-log', 'account-limits'],
    },
  ],
};
export default page;
