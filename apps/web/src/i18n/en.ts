/**
 * Português -> inglês.
 *
 * A chave é o próprio texto em português, e não um código como
 * `gastos.titulo`: o código das telas continua legível para quem trabalha
 * nele, e um texto sem tradução cai no português em vez de aparecer como
 * chave crua na cara do usuário.
 *
 * O contrato é garantido por teste: `i18n.test.ts` varre as telas atrás de
 * `t('...')` e falha se alguma chave usada não estiver aqui.
 *
 * Trechos entre chaves (`{nome}`) são substituídos em tempo de execução e
 * precisam aparecer igual nos dois idiomas.
 */
export const EN: Record<string, string> = {
  // --- Navegação e telas ----------------------------------------------------
  Início: 'Home',
  Gastos: 'Expenses',
  Resumo: 'Summary',
  Família: 'Family',
  Ajustes: 'Settings',
  'Navegação principal': 'Main navigation',
  'Family Finance': 'Family Finance',
  'Os gastos da família, com privacidade para cada um.':
    'Family spending, private for each person.',

  // --- Entrar / criar conta -------------------------------------------------
  'E-mail': 'Email',
  Senha: 'Password',
  Entrar: 'Sign in',
  'Criar minha conta': 'Create my account',
  'Ainda não tenho conta': "I don't have an account yet",
  'Já tenho conta': 'I already have an account',
  'Seu nome': 'Your name',
  'Pelo menos 8 caracteres.': 'At least 8 characters.',
  'Código do grupo (opcional)': 'Group code (optional)',
  'Recebeu um código como FF-9A3K2? Cole aqui. Se não, criamos um grupo só seu.':
    'Got a code like FF-9A3K2? Paste it here. If not, we create a group just for you.',
  'Mostrar senha': 'Show password',
  'Esconder senha': 'Hide password',

  // --- Início ---------------------------------------------------------------
  'Olá, {nome}': 'Hi, {nome}',
  'Gastos deste mês': 'This month',
  'Últimos gastos': 'Latest expenses',
  'Ver todos': 'See all',
  'Nenhum gasto ainda': 'No expenses yet',
  'Toque no botão + para lançar o primeiro. Leva menos de dez segundos.':
    'Tap the + button to add the first one. It takes less than ten seconds.',
  'Adicionar gasto': 'Add expense',
  'Primeiro mês com gastos registrados.': 'First month with expenses recorded.',
  '{quantidade} gasto registrado': '{quantidade} expense recorded',
  '{quantidade} gastos registrados': '{quantidade} expenses recorded',

  // --- Lista de gastos ------------------------------------------------------
  Filtrar: 'Filter',
  'Buscar por onde foi o gasto': 'Search by where you spent',
  'Buscar gastos': 'Search expenses',
  'Filtrar gastos': 'Filter expenses',
  Período: 'Period',
  'Este mês': 'This month',
  'Mês passado': 'Last month',
  Tudo: 'All',
  De: 'From',
  Até: 'To',
  Categoria: 'Category',
  'Todas as categorias': 'All categories',
  'Sem categoria': 'No category',
  Pessoa: 'Person',
  'Todas as pessoas': 'Everyone',
  Cartão: 'Card',
  'Todos os cartões': 'All cards',
  'Sem cartão': 'No card',
  'Nenhum cartão': 'No card',
  Limpar: 'Clear',
  Aplicar: 'Apply',
  'Limpar filtros': 'Clear filters',
  'Remover filtro': 'Remove filter',
  'Nenhum gasto encontrado': 'No expenses found',
  'Tente mudar o período ou limpar os filtros.': 'Try another period or clear the filters.',
  Anterior: 'Previous',
  Próxima: 'Next',
  'Página {pagina} de {total}': 'Page {pagina} of {total}',
  'Quem gastou': 'Who spent',
  Data: 'Date',
  Observação: 'Note',
  Origem: 'Source',
  'Lançado por uma conta fixa': 'Added by a recurring bill',
  Editar: 'Edit',
  Excluir: 'Delete',
  'Excluir este gasto?': 'Delete this expense?',
  '"{descricao}" de {valor} será removido e o total do mês vai mudar. Não dá para desfazer.':
    '"{descricao}" for {valor} will be removed and the month total will change. This cannot be undone.',
  'Gasto excluído.': 'Expense deleted.',
  'Ver comprovante': 'View receipt',
  'Anexar comprovante': 'Attach receipt',
  Trocar: 'Replace',
  Remover: 'Remove',
  'Comprovante anexado.': 'Receipt attached.',
  'Comprovante removido.': 'Receipt removed.',
  '{quantidade} gasto': '{quantidade} expense',
  '{quantidade} gastos': '{quantidade} expenses',

  // --- Novo gasto -----------------------------------------------------------
  'Novo gasto': 'New expense',
  'Editar gasto': 'Edit expense',
  Voltar: 'Back',
  'Quanto foi?': 'How much?',
  'Informe um valor maior que zero.': 'Enter an amount greater than zero.',
  'Onde foi?': 'Where?',
  'Supermercado, farmácia, posto...': 'Supermarket, pharmacy, gas station...',
  'Categoria (opcional)': 'Category (optional)',
  'Carregando categorias...': 'Loading categories...',
  'Quando foi?': 'When?',
  Hoje: 'Today',
  Ontem: 'Yesterday',
  'Escolher outra data': 'Pick another date',
  'Data escolhida: {data}': 'Date: {data}',
  'Cartão (opcional)': 'Card (optional)',
  'Cadastre seus cartões para saber quanto foi em cada um — "Itaú", "Bradesco".':
    'Add your cards to see how much went on each one — "Itaú", "Bradesco".',
  'Cadastrar um cartão': 'Add a card',
  'Foi parcelado?': 'Paid in instalments?',
  'Não, à vista': 'No, paid in full',
  'Sim, em {n}x': 'Yes, {n} instalments',
  'Teve juros?': 'With interest?',
  'Não, sem juros': 'No interest',
  'Sim, teve juros': 'Yes, with interest',
  'Juros ao mês': 'Monthly interest',
  'A taxa mensal que a loja ou o cartão informou. O valor lá em cima é o preço à vista.':
    'The monthly rate the shop or card told you. The amount above is the cash price.',
  '{parcelas}x de {valor}': '{parcelas} x {valor}',
  'Total de {total}, sendo {juros} de juros. Cada parcela entra num mês, a partir da data escolhida.':
    '{total} in total, {juros} of it interest. One instalment per month, starting on the date you chose.',
  'Digite a taxa acima para eu calcular as parcelas.':
    'Enter the rate above and I will work out the instalments.',
  'O valor informado é o total da compra. Cada parcela entra num mês, a partir da data escolhida.':
    'The amount you entered is the full price. One instalment per month, starting on the date you chose.',
  'Quem gastou?': 'Who spent it?',
  ' (você)': ' (you)',
  'Mais detalhes': 'More details',
  'Forma de pagamento': 'Payment method',
  'Algo que ajude a lembrar depois.': 'Anything that helps you remember later.',
  'Salvar gasto': 'Save expense',
  'Salvar alterações': 'Save changes',
  'Gasto de {valor} salvo.': 'Expense of {valor} saved.',
  'Gasto atualizado.': 'Expense updated.',
  'Compra de {valor} salva em {parcelas} parcelas.':
    'Purchase of {valor} saved in {parcelas} instalments.',
  'Salvo em {parcelas}x de {valor} — total {total}.':
    'Saved as {parcelas} x {valor} — {total} in total.',
  'Compra de {valor} em {parcelas}x com juros de {taxa}% ao mês (total {total}).':
    'Purchase of {valor} in {parcelas} instalments at {taxa}% monthly interest ({total} in total).',
  'As {feitas} primeiras parcelas já foram salvas — lance só as que faltam, da {proxima}ª em diante.':
    'The first {feitas} instalments were saved — add only the remaining ones, from number {proxima} on.',

  // --- Resumo ---------------------------------------------------------------
  'Mês anterior': 'Previous month',
  'Próximo mês': 'Next month',
  'Total do mês': 'Month total',
  'Por categoria': 'By category',
  'Por pessoa': 'By person',
  'Últimos 6 meses': 'Last 6 months',
  'Ainda não há gastos para comparar.': 'No expenses to compare yet.',
  'Nenhum gasto em {mes}': 'No expenses in {mes}',
  'Escolha outro mês nas setas acima.': 'Pick another month with the arrows above.',
  '{nome}: {parte}% do total': '{nome}: {parte}% of the total',
  '{quantidade} gastos · {mes} foi {valor}': '{quantidade} expenses · {mes} was {valor}',

  // --- Família --------------------------------------------------------------
  'Seus gastos são privados': 'Your expenses are private',
  'Seus gastos aparecem para o grupo': 'Your expenses are visible to the group',
  'Ninguém do grupo vê o que você lança — nem quem administra.':
    'Nobody in the group sees what you add — not even the moderator.',
  'As pessoas do grupo veem o que você lança. Você pode desligar quando quiser.':
    'People in the group can see what you add. You can turn this off whenever you want.',
  'Compartilhar meus gastos': 'Share my expenses',
  'Voltar a esconder meus gastos': 'Make my expenses private again',
  'Seus gastos agora aparecem para o grupo.': 'Your expenses are now visible to the group.',
  'Seus gastos voltaram a ser privados.': 'Your expenses are private again.',
  'Convidar para o grupo': 'Invite to the group',
  'Gere um código e mande para quem você quer no grupo. Convidar não mostra seus gastos a ninguém.':
    'Generate a code and send it to whoever you want in the group. Inviting shows your expenses to nobody.',
  'Gerar código do grupo': 'Generate group code',
  'Código do grupo (vale por 7 dias)': 'Group code (valid for 7 days)',
  Copiar: 'Copy',
  'Enviar no WhatsApp': 'Send on WhatsApp',
  'Código copiado.': 'Code copied.',
  'Entrar em outro grupo': 'Join another group',
  'Criar novo grupo': 'Create new group',
  'Sair do grupo': 'Leave group',
  'Quem está no grupo': 'Who is in the group',
  'Modera o grupo · ': 'Moderates the group · ',
  'Compartilha os gastos com o grupo': 'Shares expenses with the group',
  'Gastos privados': 'Private expenses',
  'Remover {nome} do grupo': 'Remove {nome} from the group',
  'Tirar {nome} do grupo?': 'Remove {nome} from the group?',
  '{nome} deixa de ver este grupo e passa a usar um grupo só dela. O que ela lançou aqui continua aqui — nada é apagado.':
    '{nome} loses access to this group and moves to a group of their own. What they added here stays here — nothing is deleted.',
  'Tirar do grupo': 'Remove from group',
  '{nome} saiu do grupo.': '{nome} left the group.',
  'Sair deste grupo?': 'Leave this group?',
  'Você deixa de ver este grupo. O que você lançou nele fica lá — voltando com um código, está tudo no lugar. O que é das outras pessoas não é afetado.':
    'You lose access to this group. What you added stays there — come back with a code and it will all be in place. Other people are not affected.',
  'Você saiu do grupo.': 'You left the group.',
  'Metas do grupo': 'Group goals',
  'Nova meta': 'New goal',
  'Nenhuma meta ainda. "Viagem de férias", "Reserva de emergência" — o grupo inteiro vê.':
    'No goals yet. "Holiday trip", "Emergency fund" — the whole group can see them.',
  'Nova meta do grupo': 'New group goal',
  'Metas aparecem para todo o grupo, mesmo para quem mantém os gastos privados.':
    'Goals are visible to the whole group, even to people who keep their expenses private.',
  'Qual é a meta': 'What is the goal',
  'Viagem de férias, reserva de emergência...': 'Holiday trip, emergency fund...',
  'Valor (opcional)': 'Amount (optional)',
  'Pode deixar em branco se ainda não tem um número.':
    'You can leave this blank if you have no number yet.',
  'Criar meta': 'Create goal',
  'Meta criada para o grupo.': 'Goal created for the group.',
  'Remover meta {nome}': 'Remove goal {nome}',
  'Remover "{nome}"?': 'Remove "{nome}"?',
  'A meta some para todo o grupo. Nenhum gasto é afetado.':
    'The goal disappears for the whole group. No expense is affected.',
  'Meta removida.': 'Goal removed.',
  'Criada por {nome}': 'Created by {nome}',
  '{valor} · criada por {nome}': '{valor} · created by {nome}',
  'Entrar em um grupo': 'Join a group',
  'Digite o código que você recebeu. Você entra neste grupo sem sair dos outros, e o que lançar aqui continua privado até você decidir compartilhar.':
    'Enter the code you were given. You join this group without leaving the others, and what you add here stays private until you decide to share.',
  'Código do grupo': 'Group code',
  'Entrar no grupo': 'Join group',
  'Você entrou no grupo.': 'You joined the group.',
  'Você passa a participar de mais um grupo, como administrador, e começa a usá-lo. Os grupos que você já tem continuam lá, cada um com os seus lançamentos.':
    'You join one more group as its moderator and start using it. The groups you already have stay put, each with its own expenses.',
  'Nome do grupo': 'Group name',
  'Casa da Ana, Família Silva...': 'Ana’s place, the Silva family...',
  'Criar grupo': 'Create group',
  'Grupo criado. Seus lançamentos vieram junto.': 'Group created.',

  // --- Ajustes --------------------------------------------------------------
  'Meu perfil': 'My profile',
  Nome: 'Name',
  'O e-mail não pode ser alterado.': 'The email cannot be changed.',
  'Trocar minha senha': 'Change my password',
  'Senha atual': 'Current password',
  'Nova senha': 'New password',
  Salvar: 'Save',
  'Perfil atualizado.': 'Profile updated.',
  Idioma: 'Language',
  'Português e inglês. Muda na hora, em todas as telas.':
    'Portuguese and English. Changes instantly, on every screen.',
  'Meus grupos': 'My groups',
  'Criar, trocar e compartilhar códigos': 'Create, switch and share codes',
  '{total} grupos · em uso: {nome}': '{total} groups · in use: {nome}',
  Categorias: 'Categories',
  '{total} categorias': '{total} categories',
  Cartões: 'Cards',
  'Separe os gastos por cartão': 'Split expenses by card',
  'Contas fixas': 'Recurring bills',
  'O que se repete todo mês': 'What repeats every month',
  'Importar planilha': 'Import spreadsheet',
  'Trazer os gastos de um arquivo do Excel': 'Bring expenses in from an Excel file',
  'Exportar meus dados': 'Export my data',
  'Baixar tudo em Excel ou csv': 'Download everything as Excel or csv',
  'Instalar o app': 'Install the app',
  'No celular ou no computador': 'On your phone or computer',
  'Sair da conta': 'Sign out',
  'Você saiu da sua conta.': 'You signed out.',
  'Family Finance · versão 1.0.0': 'Family Finance · version 1.0.0',

  // --- Categorias -----------------------------------------------------------
  'Nova categoria': 'New category',
  Ícone: 'Icon',
  Cor: 'Colour',
  'Cor {cor}': 'Colour {cor}',
  'Ícone {nome}': 'Icon {nome}',
  'Adicionar categoria': 'Add category',
  'Categoria criada.': 'Category created.',
  'Excluir categoria {nome}': 'Delete category {nome}',
  'Excluir "{nome}"?': 'Delete "{nome}"?',
  'Os gastos dessa categoria NÃO serão apagados — eles apenas ficam sem categoria e continuam somando no total.':
    'Expenses in this category will NOT be deleted — they simply lose the category and keep counting towards the total.',
  'Categoria excluída.': 'Category deleted.',
  'Categoria excluída. {total} gasto(s) ficaram sem categoria.':
    'Category deleted. {total} expense(s) are now without a category.',
  selecionada: 'selected',
  'Categoria {nome}': 'Category {nome}',

  // --- Categorias padrão (traduzidas só na tela; no banco seguem em português)
  Alimentação: 'Dining out',
  Casa: 'Home',
  Educação: 'Education',
  Lazer: 'Leisure',
  Mercado: 'Groceries',
  Outros: 'Other',
  Saúde: 'Health',
  Transporte: 'Transport',
  Vestuário: 'Clothing',

  // --- Cartões --------------------------------------------------------------
  'Separe os gastos por cartão para saber quanto foi em cada um. Dê o nome que você usa no dia a dia — "Itaú", "Bradesco", "Vale-refeição".':
    'Split expenses by card to see how much went on each one. Use the name you actually say — "Itaú", "Bradesco", "Meal voucher".',
  'Nenhum cartão ainda. Enquanto não houver nenhum, o campo de cartão nem aparece ao lançar um gasto.':
    'No cards yet.',
  'Novo cartão': 'New card',
  'Nome ou apelido': 'Name or nickname',
  'Itaú, Bradesco, Nubank da Ana...': 'Itaú, Bradesco, Ana’s Nubank...',
  Tipo: 'Type',
  Crédito: 'Credit',
  Débito: 'Debit',
  'Adicionar cartão': 'Add card',
  'Cartão adicionado.': 'Card added.',
  'Excluir cartão {nome}': 'Delete card {nome}',
  'Os gastos desse cartão NÃO serão apagados — eles apenas ficam sem cartão e continuam somando no total.':
    'Expenses on this card will NOT be deleted — they simply lose the card and keep counting towards the total.',
  'Cartão removido.': 'Card removed.',
  'Cartão removido. {total} gasto(s) ficaram sem cartão.':
    'Card removed. {total} expense(s) are now without a card.',
  '{nome} · {tipo}': '{nome} · {tipo}',

  // --- Meus grupos ----------------------------------------------------------
  'Você pode participar de vários grupos — "Casa", "Família da mãe", "Casa da praia". Cada um tem os próprios gastos e o próprio código.':
    'You can be in several groups — "Home", "Mum’s family", "Beach house". Each one has its own expenses and its own code.',
  'Em uso agora · ': 'In use now · ',
  ' · você modera': ' · you moderate',
  '{quantidade} pessoa': '{quantidade} person',
  '{quantidade} pessoas': '{quantidade} people',
  'Usar este grupo': 'Use this group',
  'Gerar código': 'Generate code',
  'Gerar outro código': 'Generate another code',
  'Vale até {data}': 'Valid until {data}',
  Ativo: 'Active',
  Enviar: 'Send',
  'Apagar grupo {nome}': 'Delete group {nome}',
  'Apagar "{nome}"?': 'Delete "{nome}"?',
  'Isto apaga o grupo e {lancamentos}. Não dá para desfazer.':
    'This deletes the group and {lancamentos}. It cannot be undone.',
  'o lançamento feito nele': 'the expense added to it',
  'os lançamentos feitos nele': 'the expenses added to it',
  'Apagar grupo': 'Delete group',
  'Grupo "{nome}" apagado.': 'Group "{nome}" deleted.',
  'Grupo "{nome}" criado e em uso.': 'Group "{nome}" created and in use.',
  'Agora você está em "{nome}".': 'You are now in "{nome}".',
  'Código novo gerado.': 'New code generated.',
  'Novo grupo': 'New group',
  'Casa da praia, Família da mãe...': 'Beach house, Mum’s family...',

  // --- Contas fixas ---------------------------------------------------------
  'Contas que se repetem todo mês. O lançamento entra sozinho na data escolhida — você não precisa digitar de novo.':
    'Bills that repeat every month. The expense is added on the chosen day — you never type it again.',
  'Nenhuma conta fixa ainda.': 'No recurring bills yet.',
  'Nova conta fixa': 'New recurring bill',
  'O que é': 'What it is',
  'Aluguel, internet, mensalidade...': 'Rent, internet, subscription...',
  Valor: 'Amount',
  'Todo dia': 'Every month on day',
  'Dia 31 cai no último dia dos meses curtos.':
    'Day 31 falls on the last day in shorter months.',
  'Adicionar conta fixa': 'Add recurring bill',
  'Conta fixa criada e já lançada neste mês.': 'Recurring bill created and already added this month.',
  'todo dia {dia}': 'every month on day {dia}',
  'próximo em {data}': 'next on {data}',
  pausada: 'paused',
  Ativa: 'Active',
  Pausada: 'Paused',
  'Pausar {nome}': 'Pause {nome}',
  'Retomar {nome}': 'Resume {nome}',
  'Excluir {nome}': 'Delete {nome}',
  'Conta fixa removida.': 'Recurring bill removed.',
  'Conta fixa removida. Os {total} lançamentos já feitos continuam.':
    'Recurring bill removed. The {total} expenses already added stay.',

  // --- Exportar -------------------------------------------------------------
  'Baixe seus gastos a qualquer momento. O arquivo abre no Excel e nos programas de planilha.':
    'Download your expenses whenever you want. The file opens in Excel and other spreadsheet apps.',
  Formato: 'Format',
  'Excel (.xlsx)': 'Excel (.xlsx)',
  'Texto (.csv)': 'Text (.csv)',
  'De (opcional)': 'From (optional)',
  'Até (opcional)': 'To (optional)',
  'Sem período escolhido, baixa o histórico inteiro.':
    'With no period chosen, it downloads the whole history.',
  'Baixar arquivo': 'Download file',
  'Arquivo baixado.': 'File downloaded.',

  // --- Importar -------------------------------------------------------------
  'Passo {etapa} de 3 — {nome}': 'Step {etapa} of 3 — {nome}',
  'Escolher a planilha': 'Choose the spreadsheet',
  'Conferir as colunas': 'Check the columns',
  'Conferir os gastos': 'Check the expenses',

  // --- Tutorial e ajuda -----------------------------------------------------
  'Ajuda desta tela': 'Help for this screen',
  'Fechar ajuda': 'Close help',
  Pular: 'Skip',
  Próximo: 'Next',
  Entendi: 'Got it',
  Avançar: 'Continue',
  'Passo {atual} de {total}': 'Step {atual} of {total}',
  'Ajuda: {titulo}': 'Help: {titulo}',

  // --- Passo a passo das telas ----------------------------------------------
  'Quanto você gastou no mês':
    'How much you spent this month',
  'Este é o número que resume o mês, com a comparação com o mês passado logo abaixo. Só entra aqui o que é seu e o de quem escolheu compartilhar com o grupo.':
    'This is the number that sums up the month, with the comparison to last month right below. It only includes what is yours and what people chose to share with the group.',
  'Seus últimos lançamentos':
    'Your latest entries',
  'Os gastos mais recentes ficam aqui. Toque em "Ver todos" para buscar e filtrar.':
    'Your most recent expenses live here. Tap "See all" to search and filter.',
  'Lançar um gasto':
    'Add an expense',
  'Este botão abre o lançamento. São dois campos obrigatórios: quanto foi e onde foi — leva menos de dez segundos.':
    'This button opens the form. Only two fields are required: how much and where — it takes less than ten seconds.',
  'Procurar um gasto':
    'Find an expense',
  'Digite parte do nome do lugar. A busca só olha os lançamentos que você pode ver.':
    'Type part of the place name. The search only looks at entries you are allowed to see.',
  'Filtrar por período e pessoa':
    'Filter by period and person',
  'Aqui você escolhe o mês, a categoria e a pessoa. Os filtros ligados viram etiquetas, e dá para remover uma a uma.':
    'Here you pick the month, the category and the person. Active filters become tags you can remove one by one.',
  'O total do que está filtrado':
    'The total of what is filtered',
  'Este valor soma tudo que o filtro alcança, não só o que está na tela.':
    'This adds up everything the filter reaches, not just what is on screen.',
  'Seus gastos são só seus':
    'Your expenses are yours alone',
  'Por padrão, ninguém do grupo vê o que você lança — nem quem administra. Ligue a chave aqui se quiser que o grupo acompanhe seus gastos. Dá para desligar quando quiser.':
    'By default nobody in the group sees what you add — not even the moderator. Turn it on here if you want the group to follow your spending. You can turn it off whenever you want.',
  'Convide quem você quiser':
    'Invite whoever you like',
  'Gere um código como FF-9A3K2 e mande pelo WhatsApp. Quem receber usa esse código ao criar a conta e entra no seu grupo.':
    'Generate a code like FF-9A3K2 and send it on WhatsApp. Whoever gets it uses the code when creating their account and joins your group.',
  'Aqui aparecem as pessoas do grupo e quem escolheu compartilhar os gastos. O cadeado indica que os lançamentos daquela pessoa são privados.':
    'Here you see the people in the group and who chose to share their expenses. The padlock means that person\'s entries are private.',
  'Metas de todo mundo':
    'Everyone\'s goals',
  'Metas conjuntas, como "Viagem de férias", aparecem para o grupo inteiro. É o único valor que todos veem junto.':
    'Shared goals, like "Holiday trip", are visible to the whole group. It is the only amount everyone sees together.',
  'Seus grupos':
    'Your groups',
  'Você pode participar de vários grupos, cada um com os próprios gastos. Aqui você cria, troca o que está em uso, compartilha o código e apaga os que não usa mais.':
    'You can be in several groups, each with its own expenses. Here you create them, switch the one in use, share the code and delete the ones you no longer need.',
  'Crie e apague categorias do jeito da sua casa. Apagar uma categoria nunca apaga gasto — os lançamentos só ficam sem etiqueta.':
    'Create and delete categories to suit your home. Deleting a category never deletes an expense — the entries simply lose their label.',
  'Seus cartões':
    'Your cards',
  'Cadastre os cartões pelo apelido que você usa — "Itaú", "Bradesco" — e marque se é crédito ou débito. Depois dá para lançar o gasto no cartão certo e filtrar por ele.':
    'Add your cards using the nickname you actually use — "Itaú", "Bradesco" — and mark whether it is credit or debit. You can then put each expense on the right card and filter by it.',
  'Contas que se repetem':
    'Bills that repeat',
  'Aluguel, internet, mensalidade: cadastre uma vez e o lançamento entra sozinho todo mês, na data escolhida.':
    'Rent, internet, subscriptions: add it once and the expense appears on its own every month, on the day you chose.',
  'Trazer de uma planilha':
    'Bring in from a spreadsheet',
  'Já tem os gastos no Excel? Envie o arquivo e o app importa, deixando você conferir antes de confirmar.':
    'Already have your expenses in Excel? Send the file and the app imports it, letting you check everything before confirming.',
  'Levar seus dados embora':
    'Take your data with you',
  'Baixe tudo em Excel quando quiser. Seus dados são seus — nada aqui prende você ao aplicativo.':
    'Download everything as Excel whenever you want. Your data is yours — nothing here locks you into the app.',
  'Quanto foi':
    'How much',
  'Digite só os números: o app põe a vírgula sozinho. É o único campo que sempre precisa ser preenchido, junto com o lugar.':
    'Just type the numbers: the app places the decimal point for you. It is the only field always required, along with the place.',
  'Onde foi o gasto':
    'Where you spent',
  'O nome do lugar. Conforme você digita, aparecem sugestões do que já lançou antes — toque para reaproveitar.':
    'The name of the place. As you type, suggestions from what you added before appear — tap one to reuse it.',
  'Categoria, se quiser':
    'Category, if you like',
  'Serve para o Resumo separar os gastos por tipo. Pode deixar em branco e escolher depois.':
    'It lets the Summary split expenses by type. You can leave it blank and choose later.',
  'Em qual cartão caiu':
    'Which card it went on',
  'Escolha o cartão para saber depois quanto foi em cada um. Se ainda não cadastrou nenhum, dá para criar aqui mesmo.':
    'Pick the card so you can see later how much went on each one. If you have not added any yet, you can create one right here.',
  'Compra parcelada':
    'Purchase in instalments',
  'Diga em quantas vezes foi e, se teve juros, a taxa ao mês. O app cria um lançamento por mês com o valor certo, então a conta de cada mês fica correta.':
    'Say how many instalments it was and, if there was interest, the monthly rate. The app creates one entry per month with the right amount, so each month adds up correctly.',
  'Escolha o mês':
    'Pick the month',
  'As setas andam para trás e para frente no calendário. Tudo nesta tela fala do mês que estiver aqui.':
    'The arrows move back and forth through the calendar. Everything on this screen is about the month shown here.',
  'Quanto foi no mês':
    'How much the month was',
  'O total e a comparação com o mês passado. Só entra o que é seu e o de quem escolheu compartilhar com o grupo.':
    'The total and the comparison with last month. It only includes what is yours and what people chose to share with the group.',
  'Para onde foi o dinheiro':
    'Where the money went',
  'A rosca e a lista mostram o peso de cada categoria. É onde costuma aparecer a surpresa do mês.':
    'The ring and the list show the weight of each category. This is usually where the surprise of the month shows up.',
  'Quem gastou quanto':
    'Who spent how much',
  'A divisão por pessoa, para quem divide as contas da casa.':
    'The split by person, for households that share the bills.',
  'Os últimos seis meses':
    'The last six months',
  'Responde "estou gastando mais que antes?" sem precisar abrir mês por mês.':
    'Answers "am I spending more than before?" without opening month by month.',
  'Três passos':
    'Three steps',
  'Enviar o arquivo, dizer o que é cada coluna e conferir antes de gravar. Nada entra nos seus gastos até o último passo.':
    'Send the file, say what each column is and check before saving. Nothing enters your expenses until the last step.',
  'A planilha':
    'The spreadsheet',
  'Vale Excel (.xlsx) ou .csv. Pode arrastar o arquivo para cá ou tocar para procurar no celular.':
    'Excel (.xlsx) or .csv both work. Drag the file here or tap to browse on your phone.',
  'O que é cada coluna':
    'What each column is',
  'O app tenta adivinhar sozinho olhando os títulos. Onde ele errar, corrija aqui — só data, valor e descrição são obrigatórios.':
    'The app tries to guess by looking at the headers. Fix whatever it got wrong here — only date, amount and description are required.',
  'Confira antes de gravar':
    'Check before saving',
  'Desmarque o que não quiser trazer e corrija o que estiver estranho. Linhas com erro ficam de fora sozinhas.':
    'Untick anything you do not want to bring in and fix whatever looks odd. Rows with errors are left out automatically.',

  // --- Peças comuns ---------------------------------------------------------
  Cancelar: 'Cancel',
  Confirmar: 'Confirm',
  Fechar: 'Close',
  'Carregando...': 'Loading...',
  'Não conseguimos concluir agora. Tente novamente em instantes.':
    'We could not finish just now. Please try again in a moment.',
};
