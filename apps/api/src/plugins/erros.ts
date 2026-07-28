import { ErroApp, MENSAGENS_PADRAO, type CorpoErro } from '@gastos/core';
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
 * Todo erro sai da API no mesmo formato e em português, sem jargão técnico.
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
    void reply.status(404).send(corpo);
  });

  app.setErrorHandler((erro: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (erro instanceof ErroApp) {
      return reply.status(erro.status).send(erro.paraCorpo());
    }

    if (erro instanceof ZodError) {
      const corpo: CorpoErro = {
        erro: {
          codigo: 'VALIDACAO',
          mensagem: MENSAGENS_PADRAO.VALIDACAO,
          campos: camposDoZod(erro),
        },
      };
      return reply.status(400).send(corpo);
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
        return reply.status(409).send(corpo);
      }
      if (erro.code === 'P2025') {
        const corpo: CorpoErro = {
          erro: { codigo: 'NAO_ENCONTRADO', mensagem: MENSAGENS_PADRAO.NAO_ENCONTRADO },
        };
        return reply.status(404).send(corpo);
      }
    }

    // Corpo JSON malformado ou ausente: culpa do cliente, mas a mensagem é amigável.
    const comCodigo = erro as { statusCode?: number; code?: string; message?: string };
    if (typeof comCodigo.statusCode === 'number' && comCodigo.statusCode < 500) {
      const corpo: CorpoErro = {
        erro: { codigo: 'VALIDACAO', mensagem: 'Não entendemos os dados enviados.' },
      };
      return reply.status(comCodigo.statusCode).send(corpo);
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
    return reply.status(500).send(corpo);
  });
}
