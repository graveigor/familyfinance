/** Formato único de erro da API — a interface nunca precisa adivinhar. */

export const CODIGOS_ERRO = [
  'VALIDACAO',
  'NAO_AUTENTICADO',
  'SEM_PERMISSAO',
  'NAO_ENCONTRADO',
  'CONFLITO',
  'LIMITE_EXCEDIDO',
  'INTERNO',
] as const;

export type CodigoErro = (typeof CODIGOS_ERRO)[number];

export interface CorpoErro {
  erro: {
    codigo: CodigoErro;
    mensagem: string;
    /** Mensagem por campo do formulário, quando o erro é de validação. */
    campos?: Record<string, string>;
  };
}

/** Status HTTP correspondente a cada código. */
export const STATUS_POR_CODIGO: Record<CodigoErro, number> = {
  VALIDACAO: 400,
  NAO_AUTENTICADO: 401,
  SEM_PERMISSAO: 403,
  NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  LIMITE_EXCEDIDO: 429,
  INTERNO: 500,
};

/**
 * Texto exibido quando o cliente não tem nada melhor a dizer. Sem jargão:
 * o usuário precisa saber o que fazer, não o que quebrou.
 */
export const MENSAGENS_PADRAO: Record<CodigoErro, string> = {
  VALIDACAO: 'Confira os campos destacados e tente de novo.',
  NAO_AUTENTICADO: 'Sua sessão expirou. Entre novamente para continuar.',
  SEM_PERMISSAO: 'Você não tem permissão para fazer isso.',
  NAO_ENCONTRADO: 'Não encontramos o que você procura.',
  CONFLITO: 'Esses dados já existem.',
  LIMITE_EXCEDIDO: 'Muitas tentativas seguidas. Aguarde um instante.',
  INTERNO: 'Não conseguimos concluir agora. Tente novamente em instantes.',
};

export function ehCorpoErro(valor: unknown): valor is CorpoErro {
  if (typeof valor !== 'object' || valor === null) return false;
  const possivel = valor as { erro?: { codigo?: unknown; mensagem?: unknown } };
  return (
    typeof possivel.erro === 'object' &&
    possivel.erro !== null &&
    typeof possivel.erro.mensagem === 'string' &&
    typeof possivel.erro.codigo === 'string'
  );
}

/** Erro já traduzido, pronto para virar resposta HTTP ou aviso na tela. */
export class ErroApp extends Error {
  readonly codigo: CodigoErro;
  readonly campos?: Record<string, string>;
  readonly status: number;

  constructor(codigo: CodigoErro, mensagem?: string, campos?: Record<string, string>) {
    super(mensagem ?? MENSAGENS_PADRAO[codigo]);
    this.name = 'ErroApp';
    this.codigo = codigo;
    this.status = STATUS_POR_CODIGO[codigo];
    if (campos) this.campos = campos;
  }

  paraCorpo(): CorpoErro {
    return {
      erro: {
        codigo: this.codigo,
        mensagem: this.message,
        ...(this.campos ? { campos: this.campos } : {}),
      },
    };
  }
}

export const erroValidacao = (mensagem?: string, campos?: Record<string, string>): ErroApp =>
  new ErroApp('VALIDACAO', mensagem, campos);
export const erroNaoEncontrado = (mensagem?: string): ErroApp =>
  new ErroApp('NAO_ENCONTRADO', mensagem);
export const erroSemPermissao = (mensagem?: string): ErroApp => new ErroApp('SEM_PERMISSAO', mensagem);
export const erroNaoAutenticado = (mensagem?: string): ErroApp =>
  new ErroApp('NAO_AUTENTICADO', mensagem);
export const erroConflito = (mensagem?: string): ErroApp => new ErroApp('CONFLITO', mensagem);
