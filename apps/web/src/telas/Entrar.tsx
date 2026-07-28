import { useState, type FormEvent, type ReactElement } from 'react';
import { Botao, CaixaDeErro, Campo, traduzirErro } from '../componentes/ui';
import { useSessao } from '../sessao';

/**
 * Uma tela só para entrar e criar conta: menos escolha, menos engano.
 * Quem recebeu convite cola o código e já cai na família certa.
 */
export function Entrar(): ReactElement {
  const { entrar, registrar } = useSessao();
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoConvite, setCodigoConvite] = useState('');

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setEnviando(true);
    setErro({ mensagem: '', campos: {} });

    try {
      if (modo === 'entrar') {
        await entrar(email, senha);
      } else {
        await registrar({
          nome,
          email,
          senha,
          ...(codigoConvite.trim() ? { codigoConvite: codigoConvite.trim().toUpperCase() } : {}),
        });
      }
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/icone-192.png" alt="" className="h-16 w-16 rounded-2xl shadow-sm" />
          <h1 className="text-2xl font-bold text-slate-900">Controle de Gastos</h1>
          <p className="text-base text-slate-600">Os gastos da família, organizados.</p>
        </div>

        <form onSubmit={(e) => void enviar(e)} className="cartao space-y-5 p-6">
          <CaixaDeErro mensagem={erro.mensagem || null} />

          {modo === 'criar' && (
            <Campo
              rotulo="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              erro={erro.campos.nome}
              required
            />
          )}

          <Campo
            rotulo="E-mail"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            erro={erro.campos.email}
            required
          />

          <Campo
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
            dica={modo === 'criar' ? 'Pelo menos 8 caracteres.' : undefined}
            erro={erro.campos.senha}
            required
          />

          {modo === 'criar' && (
            <Campo
              rotulo="Código do convite (opcional)"
              value={codigoConvite}
              onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              className="uppercase tracking-widest"
              dica="Recebeu um código de alguém da família? Cole aqui. Se não, deixe em branco."
              erro={erro.campos.codigoConvite}
            />
          )}

          <Botao type="submit" larguraTotal carregando={enviando}>
            {modo === 'entrar' ? 'Entrar' : 'Criar minha conta'}
          </Botao>

          <div className="border-t border-slate-200 pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setModo(modo === 'entrar' ? 'criar' : 'entrar');
                setErro({ mensagem: '', campos: {} });
              }}
              className="min-h-toque px-2 text-base font-semibold text-marca-700 hover:underline"
            >
              {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
