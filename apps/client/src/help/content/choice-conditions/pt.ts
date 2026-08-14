import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'choice-conditions',
  title: 'Condições para uma escolha aparecer',
  summary: 'Defina quando uma escolha fica bloqueada ou habilitada para o leitor.',
  keywords: ['condição', 'bloquear', 'habilitar', 'item', 'marcador', 'visita'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Condições definem quando uma escolha fica bloqueada ou habilitada. Elas podem verificar quantas vezes uma cena foi visitada, se o leitor tem um item e se um marcador está ligado ou desligado.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A escolha “Abrir o cofre” só deve estar disponível depois que o leitor encontrou a chave. Crie uma condição de inventário para a chave e marque-a como Habilitar. Sem a chave, a escolha não é liberada.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Escolhas e crie ou edite uma escolha em uma história ramificada.',
        'Salve a escolha primeiro. A seção Condições aparece depois que ela existe.',
        'Toque em Adicionar grupo de condições. Dentro de um grupo, escolha Todas (E) para exigir cada condição ou Qualquer uma (OU) para aceitar uma delas.',
        'Toque em Adicionar condição e escolha o Tipo: Visitas à cena, Inventário ou Marcador. Preencha a cena e o número de visitas, o item e se deve ter/não ter, ou o nome e estado do marcador.',
        'Escolha Bloquear para impedir a escolha quando a condição for atendida, ou Habilitar para torná-la disponível quando for atendida.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'As condições aparecem no detalhe da escolha e são consideradas na análise dos caminhos. Itens e marcadores usados nelas vêm do estado do leitor, que é alterado pelos efeitos de cenas e escolhas.',
    },
    { type: 'seeAlso', pages: ['choices', 'effects', 'story-state', 'story-analysis'] },
  ],
};

export default page;
