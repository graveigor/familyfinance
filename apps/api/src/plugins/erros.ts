import {
  ErroApp,
  MENSAGENS_PADRAO,
  idiomaDoCabecalho,
  traduzirMensagemDoServidor,
  type CorpoErro,
} from '@gastos/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ehProducao } from '../ambiente.js';

/** Primeira mensagem de cada campo — o formulário só exibe uma por vez. */
function camposDoZod(erro: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const chave = problema.path.length > 0 ? problema.path.join('.') : 'formulario';
    if (!(chave in campos)) campos[chave] = problema.message;
  }
  return campos;
}

function ehErroPrisma(erro: unknown): erro is { code: string; meta?: { target?: string[] } } {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    typeof (erro as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((erro as { code: string }).code)
  );
}

/**
 * Traduz a mensagem geral e a de cada campo, no idioma que o cliente pediu.
 * Fica aqui, e não nas rotas: cada rota continua escrevendo em português.
 */
function traduzirCorpo(corpo: CorpoErro, request: FastifyRequest): CorpoErro {
  const idioma = idiomaDoCabecalho(request.headers['accept-language']);
  if (idioma === 'pt') return corpo;

  const campos = corpo.erro.campos
    ? Object.fromEntries(
        Object.entries(corpo.erro.campos).map(([campo, texto]) => [
          campo,
          traduzirMensagemDoServidor(texto, idioma),
        ]),
      )
    : undefined;

  return {
    erro: {
      ...corpo.erro,
      mensagem: traduzirMensagemDoServidor(corpo.erro.mensagem, idioma),
      ...(campos ? { campos } : {}),
    },
  };
}

/**
 * Todo erro sai da API no mesmo formato, sem jargão técnico, no idioma pedido.
 * Detalhe de stack só vai para o log, nunca para a resposta.
 */
export function configurarErros(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const corpo: CorpoErro = {
      erro: {
        codigo: 'NAO_ENCONTRADO',
        mensagem: `Não encontramos o endereço ${request.method} ${request.url}.`,
      },
    };
    void reply.status(404).send(traduzirCorpo(corpo, request));
  });

  app.setErrorHandler((erro: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (erro instanceof ErroApp) {
      return reply.status(erro.status).send(traduzirCorpo(erro.paraCorpo(), request));
    }

    if (erro instanceof ZodError) {
      const corpo: CorpoErro = {
        erro: {
          codigo: 'VALIDACAO',
          mensagem: MENSAGENS_PADRAO.VALIDACAO,
          campos: camposDoZod(erro),
        },
      };
      return reply.status(400).send(traduzirCorpo(corpo, request));
    }

    if (ehErroPrisma(erro)) {
      if (erro.code === 'P2002') {
        const alvo = erro.meta?.target?.join(', ');
        const corpo: CorpoErro = {
          erro: {
            codigo: 'CONFLITO',
            mensagem: alvo?.includes('email')
              ? 'Já existe uma conta com esse e-mail.'
              : 'Esses dados já existem.',
          },
        };
        return reply.status(409).send(traduzirCorpo(corpo, request));
      }
      if (erro.code === 'P2025') {
        const corpo: CorpoErro = {
          erro: { codigo: 'NAO_ENCONTRADO', mensagem: MENSAGENS_PADRAO.NAO_ENCONTRADO },
        };
        return reply.status(404).send(traduzirCorpo(corpo, request));
      }
    }

    // Corpo JSON malformado ou ausente: culpa do cliente, mas a mensagem é amigável.
    const comCodigo = erro as { statusCode?: number; code?: string; message?: string };
    if (typeof comCodigo.statusCode === 'number' && comCodigo.statusCode < 500) {
      const corpo: CorpoErro = {
        erro: { codigo: 'VALIDACAO', mensagem: 'Não entendemos os dados enviados.' },
      };
      return reply.status(comCodigo.statusCode).send(traduzirCorpo(corpo, request));
    }

    request.log.error({ erro }, 'Erro não tratado');
    const corpo: CorpoErro = {
      erro: {
        codigo: 'INTERNO',
        mensagem: ehProducao
          ? MENSAGENS_PADRAO.INTERNO
          : `${MENSAGENS_PADRAO.INTERNO} (${comCodigo.message ?? 'sem detalhe'})`,
      },
    };
    return reply.status(500).send(traduzirCorpo(corpo, request));
  });
}
