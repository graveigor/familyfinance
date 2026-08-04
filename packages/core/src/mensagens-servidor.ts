import type { Idioma } from './datas.js';

/**
 * Tradução das mensagens que o servidor devolve — erros e validação de campo.
 *
 * A chave é a frase em português, como no dicionário da interface. Aqui isso
 * vale ainda mais: as frases nascem espalhadas por rotas e schemas, e trocar
 * todas por códigos exigiria mexer em mais de cem pontos só para traduzir.
 * O preço é que uma frase reescrita perde a tradução — e o efeito disso é
 * aparecer em português, nunca quebrar.
 *
 * A tradução acontece num lugar só, no handler de erro: nenhuma rota precisa
 * saber que existe idioma.
 */

const EXATAS: Record<string, string> = {
  // --- Genéricas ------------------------------------------------------------
  'Confira os campos destacados e tente de novo.': 'Check the highlighted fields and try again.',
  'Sua sessão expirou. Entre novamente para continuar.':
    'Your session has expired. Sign in again to continue.',
  'Você não tem permissão para fazer isso.': "You don't have permission to do that.",
  'Não encontramos o que você procura.': "We couldn't find what you're looking for.",
  'Esses dados já existem.': 'That already exists.',
  'Muitas tentativas seguidas. Aguarde um instante.':
    'Too many attempts in a row. Please wait a moment.',
  'Não conseguimos concluir agora. Tente novamente em instantes.':
    'We could not finish just now. Please try again in a moment.',
  'Não entendemos os dados enviados.': "We couldn't read the data that was sent.",
  'Entre na sua conta para continuar.': 'Sign in to continue.',

  // --- Conta ----------------------------------------------------------------
  'E-mail ou senha incorretos.': 'Wrong email or password.',
  'Já existe uma conta com esse e-mail.': 'An account with that email already exists.',
  'A senha atual não confere.': 'Your current password is wrong.',
  'Informe a senha atual para trocar de senha.':
    'Enter your current password to change your password.',
  'Informe o e-mail.': 'Enter your email.',
  'Esse e-mail não parece válido.': "That email doesn't look right.",
  'E-mail muito longo.': 'That email is too long.',
  'Informe a senha.': 'Enter your password.',
  'A senha precisa ter pelo menos 8 caracteres.': 'Your password needs at least 8 characters.',
  'Senha muito longa.': 'That password is too long.',
  'Informe o nome.': 'Enter a name.',
  'O nome precisa ter pelo menos 2 letras.': 'The name needs at least 2 letters.',
  'O nome pode ter no máximo 80 letras.': 'The name can have at most 80 letters.',

  // --- Grupos e convites ----------------------------------------------------
  'Informe o código do grupo.': 'Enter the group code.',
  'O código tem o formato FF-XXXXX.': 'The code looks like FF-XXXXX.',
  'Esse código não é mais válido. Peça um novo para quem te convidou.':
    'That code is no longer valid. Ask whoever invited you for a new one.',
  'Código inválido ou expirado.': 'Invalid or expired code.',
  'Esse convite não é mais válido. Peça um novo para quem te convidou.':
    'That invite is no longer valid. Ask whoever invited you for a new one.',
  'Convite inválido ou expirado.': 'Invalid or expired invite.',
  'Não conseguimos gerar o convite. Tente de novo.':
    "We couldn't generate the invite. Please try again.",
  'Você não participa desse grupo.': "You're not a member of that group.",
  'Essa pessoa não está no seu grupo.': "That person isn't in your group.",
  'O grupo precisa de pelo menos uma pessoa administradora.':
    'The group needs at least one moderator.',
  'Só quem administra a família pode fazer isso.': 'Only a group moderator can do that.',
  'Só quem administra o grupo pode apagá-lo.': 'Only a group moderator can delete it.',
  'Este é o seu único grupo. Crie outro antes de apagar este.':
    'This is your only group. Create another one before deleting this.',
  'Para sair do grupo, use "Sair do grupo" — assim ninguém fica sem dono.':
    'To leave the group use "Leave group" — that way nobody is left without an owner.',
  'Você é a única pessoa deste grupo. Para se livrar dele, use "Meus grupos" e apague-o.':
    'You are the only person in this group. To get rid of it, use "My groups" and delete it.',
  'Escolha um papel válido.': 'Choose a valid role.',

  // --- Gastos, categorias e cartões -----------------------------------------
  'Informe onde foi o gasto.': 'Say where you spent it.',
  'Use no máximo 120 caracteres.': 'Use at most 120 characters.',
  'Informe o valor.': 'Enter the amount.',
  'Informe um valor válido.': 'Enter a valid amount.',
  'O valor precisa estar em centavos (número inteiro).':
    'The amount must be in cents (a whole number).',
  'Informe um valor maior que zero.': 'Enter an amount greater than zero.',
  'Esse valor é alto demais. Confira se está certo.':
    "That amount is very high. Check that it's right.",
  'Informe a data.': 'Enter the date.',
  'Use uma data no formato dia/mês/ano.': 'Use a date in day/month/year format.',
  'Essa data não existe no calendário.': "That date doesn't exist on the calendar.",
  'Data inválida.': 'Invalid date.',
  'Esse gasto não existe mais.': "That expense doesn't exist any more.",
  'Você só pode alterar os gastos que você lançou.':
    'You can only change expenses you added yourself.',
  'Nada para alterar.': 'Nothing to change.',
  'Essa pessoa não faz parte da família.': "That person isn't part of the family.",
  'Pessoa inválida.': 'Invalid person.',
  'Essa categoria não existe.': "That category doesn't exist.",
  'Essa categoria não existe mais.': "That category doesn't exist any more.",
  'Categoria inválida.': 'Invalid category.',
  'Informe o nome da categoria.': 'Enter the category name.',
  'Esse cartão não existe.': "That card doesn't exist.",
  'Esse cartão não existe mais.': "That card doesn't exist any more.",
  'Cartão inválido.': 'Invalid card.',
  'Dê um nome ao cartão.': 'Give the card a name.',
  'Escolha entre crédito e débito.': 'Choose between credit and debit.',
  'Use no máximo 40 caracteres.': 'Use at most 40 characters.',
  'Escolha uma cor válida.': 'Choose a valid colour.',
  'Escolha um ícone.': 'Choose an icon.',
  'Escolha uma forma de pagamento válida.': 'Choose a valid payment method.',

  // --- Contas fixas ---------------------------------------------------------
  'Essa conta fixa não existe mais.': "That recurring bill doesn't exist any more.",
  'Você só pode alterar as contas fixas que você criou.':
    'You can only change recurring bills you created yourself.',
  'Informe o dia do mês.': 'Enter the day of the month.',
  'Informe um dia válido.': 'Enter a valid day.',
  'O dia precisa ser entre 1 e 31.': 'The day must be between 1 and 31.',

  // --- Comprovantes e importação --------------------------------------------
  'Escolha uma foto ou um PDF do comprovante.': 'Choose a photo or PDF of the receipt.',
  'Esse gasto não tem comprovante.': "That expense doesn't have a receipt.",
  'O arquivo enviado está vazio.': 'The file you sent is empty.',
  'Esse arquivo passa de 3 MB. Tire a foto com qualidade menor.':
    'That file is over 3 MB. Take the photo at a lower quality.',
};

/**
 * Mensagens que carregam nome, valor ou contagem. Casam por posição do trecho
 * variável, que é reaproveitado na tradução.
 */
const PADROES: Array<{ de: RegExp; para: (...partes: string[]) => string }> = [
  {
    de: /^Já existe uma categoria chamada "(.+)"\.$/,
    para: (nome) => `There's already a category called "${nome}".`,
  },
  {
    de: /^Já existe um cartão "(.+)" de (crédito|débito)\.$/,
    para: (nome, tipo) =>
      `There's already a "${nome}" ${tipo === 'crédito' ? 'credit' : 'debit'} card.`,
  },
  {
    de: /^Esse código foi gerado por (.+), aqui no grupo "(.+)" — que já é o seu\. Para entrar em outra família, peça o código a alguém de lá\.$/,
    para: (quem, grupo) =>
      `That code was created by ${quem}, here in the "${grupo}" group — which is already yours. To join another family, ask someone there for their code.`,
  },
  {
    de: /^Não encontramos o endereço (.+)\.$/,
    para: (endereco) => `We couldn't find the address ${endereco}.`,
  },
  {
    de: /^Ainda há mais uma pessoa neste grupo\. Tire ela do grupo antes de apagá-lo — o que elas lançaram aqui seria apagado junto\.$/,
    para: () =>
      'There is still one more person in this group. Remove them before deleting it — what they added here would be deleted too.',
  },
  {
    de: /^Ainda há mais (\d+) pessoas neste grupo\. Tire todas do grupo antes de apagá-lo — o que elas lançaram aqui seria apagado junto\.$/,
    para: (total) =>
      `There are still ${total} more people in this group. Remove them all before deleting it — what they added here would be deleted too.`,
  },
  {
    de: /^A pessoa da linha (\d+) não faz parte da família\.$/,
    para: (linha) => `The person on row ${linha} isn't part of the family.`,
  },
  {
    de: /^A categoria da linha (\d+) não existe\.$/,
    para: (linha) => `The category on row ${linha} doesn't exist.`,
  },
  {
    de: /^A data da linha (\d+) não é válida\.$/,
    para: (linha) => `The date on row ${linha} isn't valid.`,
  },
  {
    de: /^Use no máximo (\d+) caracteres\.$/,
    para: (max) => `Use at most ${max} characters.`,
  },
];

/**
 * Devolve a mensagem no idioma pedido. Sem tradução, devolve o original —
 * português a mais é um incômodo; texto sumido seria um defeito.
 */
export function traduzirMensagemDoServidor(mensagem: string, idioma: Idioma): string {
  if (idioma !== 'en') return mensagem;

  const exata = EXATAS[mensagem];
  if (exata) return exata;

  for (const { de, para } of PADROES) {
    const achado = de.exec(mensagem);
    if (achado) return para(...achado.slice(1));
  }
  return mensagem;
}

/** Lê o idioma pedido pelo cliente no cabeçalho `Accept-Language`. */
export function idiomaDoCabecalho(valor: string | undefined): Idioma {
  return valor?.toLowerCase().startsWith('en') ? 'en' : 'pt';
}
