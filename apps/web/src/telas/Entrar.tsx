import { useState, type FormEvent, type ReactElement } from 'react';
import { api } from '../api';
import { Botao, CaixaDeErro, Campo, traduzirErro } from '../componentes/ui';
import { SeletorDeIdioma, useT } from '../i18n';
import { useSessao } from '../sessao';

/**
 * Uma tela só para entrar e criar conta: menos escolha, menos engano.
 * Quem recebeu convite cola o código e já cai na família certa.
 */
export function Entrar(): ReactElement {
  const t = useT();
  const { entrar, registrar, redefinirSenha } = useSessao();
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci' | 'codigo'>('entrar');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoConvite, setCodigoConvite] = useState('');
  const [codigo, setCodigo] = useState('');

  function trocarModo(novo: typeof modo): void {
    setModo(novo);
    setErro({ mensagem: '', campos: {} });
    setCodigo('');
  }

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setEnviando(true);
    setErro({ mensagem: '', campos: {} });

    try {
      if (modo === 'entrar') {
        await entrar(email, senha);
      } else if (modo === 'esqueci') {
        await api.auth.esqueciSenha({ email });
        setSenha('');
        setModo('codigo');
      } else if (modo === 'codigo') {
        await redefinirSenha({ email, codigo: codigo.trim(), novaSenha: senha });
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
          <h1 className="text-2xl font-bold text-slate-900">{t('Family Finance')}</h1>
          <p className="text-base text-slate-600">
            {t('Os gastos da família, com privacidade para cada um.')}
          </p>
          {/* Antes de ter conta a pessoa já escolhe o idioma. */}
          <SeletorDeIdioma className="mt-1" />
        </div>

        <form onSubmit={(e) => void enviar(e)} className="cartao space-y-5 p-6">
          <CaixaDeErro mensagem={erro.mensagem || null} />

          {modo === 'esqueci' && (
            <p className="text-base text-slate-700">
              {t('Digite o e-mail da sua conta. Vamos mandar um código de 6 números para você criar uma senha nova.')}
            </p>
          )}

          {modo === 'codigo' && (
            <p className="text-base text-slate-700">
              {t('Se existe uma conta com esse e-mail, o código chegou lá. Ele vale por 15 minutos.')}
            </p>
          )}

          {modo === 'criar' && (
            <Campo
              rotulo={t('Seu nome')}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              erro={erro.campos.nome}
              required
            />
          )}

          <Campo
            rotulo={t('E-mail')}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            erro={erro.campos.email}
            required
          />

          {modo === 'codigo' && (
            <Campo
              rotulo={t('Código do e-mail')}
              inputMode="numeric"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="tracking-[0.4em]"
              erro={erro.campos.codigo}
              required
            />
          )}

          {modo !== 'esqueci' && (
          <Campo
            rotulo={modo === 'codigo' ? t('Nova senha') : t('Senha')}
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            dica={modo === 'entrar' ? undefined : t('Pelo menos 8 caracteres.')}
            erro={erro.campos.senha || erro.campos.novaSenha}
            required
          />
          )}

          {modo === 'criar' && (
            <Campo
              rotulo={t('Código do grupo (opcional)')}
              value={codigoConvite}
              onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
              className="uppercase tracking-widest"
              dica={t('Recebeu um código como FF-9A3K2? Cole aqui. Se não, criamos um grupo só seu.')}
              erro={erro.campos.codigoConvite}
            />
          )}

          <Botao type="submit" larguraTotal carregando={enviando}>
            {modo === 'entrar'
              ? t('Entrar')
              : modo === 'criar'
                ? t('Criar minha conta')
                : modo === 'esqueci'
                  ? t('Enviar código')
                  : t('Trocar senha e entrar')}
          </Botao>

          <div className="flex flex-col items-center gap-1 border-t border-slate-200 pt-4">
            {modo === 'entrar' && (
              <button
                type="button"
                onClick={() => trocarModo('esqueci')}
                className="min-h-toque px-2 text-base font-semibold text-marca-700 hover:underline"
              >
                {t('Esqueci minha senha')}
              </button>
            )}

            <button
              type="button"
              onClick={() => trocarModo(modo === 'entrar' ? 'criar' : 'entrar')}
              className="min-h-toque px-2 text-base font-semibold text-marca-700 hover:underline"
            >
              {modo === 'entrar' ? t('Ainda não tenho conta') : t('Já tenho conta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
