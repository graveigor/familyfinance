import { ambiente, ehProducao } from '../ambiente.js';

/**
 * Envio de e-mail pela API do Resend, com `fetch` — sem biblioteca: é uma
 * requisição HTTP só.
 *
 * Sem `RESEND_API_KEY`, fora de produção, o e-mail sai no log do servidor.
 * Isso deixa a recuperação de senha testável na máquina de quem desenvolve sem
 * contratar provedor. Em produção o mesmo caso vira erro: fingir que enviou
 * deixaria a pessoa esperando um e-mail que nunca chega.
 */
export async function enviarEmail(opcoes: {
  para: string;
  assunto: string;
  texto: string;
}): Promise<void> {
  if (!ambiente.RESEND_API_KEY) {
    if (ehProducao) {
      throw new Error('RESEND_API_KEY não configurada: não há como enviar e-mail.');
    }
    console.info(
      `\n--- E-mail (sem provedor configurado) ---\nPara: ${opcoes.para}\n${opcoes.assunto}\n\n${opcoes.texto}\n---\n`,
    );
    return;
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ambiente.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: ambiente.EMAIL_REMETENTE,
      to: opcoes.para,
      subject: opcoes.assunto,
      text: opcoes.texto,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Resend recusou o envio (${resposta.status}): ${await resposta.text()}`);
  }
}
