/**
 * Datas de gasto são "dia do calendário", não instantes. Para que o dia não
 * mude conforme o fuso de quem abre o app, toda data é normalizada para
 * meia-noite UTC e formatada manualmente (sem `toLocaleDateString`, que aplica
 * o fuso local).
 */

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

/** Data em meia-noite UTC a partir de ano/mês(1-12)/dia. */
export function dataUTC(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0));
}

/** Zera a hora mantendo o dia do calendário em UTC. */
export function normalizarData(data: Date): Date {
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Hoje, no fuso de quem está usando o app, como data UTC. */
export function hoje(): Date {
  const agora = new Date();
  return dataUTC(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
}

export function ontem(): Date {
  const d = hoje();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/** `dd/mm/aaaa` */
export function formatarData(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

/** `aaaa-mm-dd` — formato usado no tráfego da API. */
export function formatarDataISO(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${data.getUTCFullYear()}-${mes}-${dia}`;
}

/** `"12 de março"` / `"12 de março de 2024"` */
export function formatarDataExtenso(data: Date, comAno = false): string {
  const mes = MESES[data.getUTCMonth()] ?? '';
  const base = `${data.getUTCDate()} de ${mes}`;
  return comAno ? `${base} de ${data.getUTCFullYear()}` : base;
}

/** Cabeçalho dos grupos da lista: "Hoje", "Ontem" ou "sexta-feira, 12 de março". */
export function rotuloDoDia(data: Date, referencia: Date = hoje()): string {
  const diff = Math.round((normalizarData(data).getTime() - referencia.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === -1) return 'Ontem';
  const diaSemana = DIAS_SEMANA[data.getUTCDay()] ?? '';
  const mesmoAno = data.getUTCFullYear() === referencia.getUTCFullYear();
  return `${diaSemana}, ${formatarDataExtenso(data, !mesmoAno)}`;
}

export function nomeDoMes(mes: number): string {
  return MESES[mes - 1] ?? '';
}

export function nomeCurtoDoMes(mes: number): string {
  return MESES_CURTOS[mes - 1] ?? '';
}

export function inicioDoMes(ano: number, mes: number): Date {
  return dataUTC(ano, mes, 1);
}

/** Primeiro instante do mês seguinte — use como limite exclusivo em consultas. */
export function inicioDoProximoMes(ano: number, mes: number): Date {
  return mes === 12 ? dataUTC(ano + 1, 1, 1) : dataUTC(ano, mes + 1, 1);
}

export function fimDoMes(ano: number, mes: number): Date {
  const proximo = inicioDoProximoMes(ano, mes);
  proximo.setUTCDate(proximo.getUTCDate() - 1);
  return proximo;
}

export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

/**
 * O Excel guarda datas como "dias desde 30/12/1899". O sistema de 1900 tem o
 * bug histórico do 29/02/1900 inexistente, já embutido nessa origem.
 */
export function dataDeSerialExcel(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const origem = Date.UTC(1899, 11, 30);
  const dias = Math.floor(serial);
  return normalizarData(new Date(origem + dias * 86_400_000));
}

function ehDataValida(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const data = dataUTC(ano, mes, dia);
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

/**
 * Interpreta data vinda do usuário ou de planilha. Devolve `null` se não der.
 *
 * Aceita `dd/mm/aaaa`, `dd/mm/aa`, `dd-mm-aaaa`, `dd.mm.aaaa`, `aaaa-mm-dd`,
 * `Date` e o serial numérico do Excel. Ano de 2 dígitos: 00–68 vira 20xx,
 * 69–99 vira 19xx (mesma convenção do Excel).
 */
export function parseData(entrada: string | number | Date): Date | null {
  if (entrada instanceof Date) {
    return Number.isNaN(entrada.getTime()) ? null : normalizarData(entrada);
  }
  if (typeof entrada === 'number') return dataDeSerialExcel(entrada);

  const texto = entrada.trim();
  if (texto === '') return null;

  // aaaa-mm-dd (com hora opcional, como vem da API)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(texto);
  if (iso) {
    const ano = Number(iso[1]);
    const mes = Number(iso[2]);
    const dia = Number(iso[3]);
    return ehDataValida(ano, mes, dia) ? dataUTC(ano, mes, dia) : null;
  }

  // dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa
  const br = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(texto);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    let ano = Number(br[3]);
    if (br[3]?.length === 2) ano = ano <= 68 ? 2000 + ano : 1900 + ano;
    return ehDataValida(ano, mes, dia) ? dataUTC(ano, mes, dia) : null;
  }

  // Serial do Excel que chegou como texto ("45324")
  if (/^\d+(\.\d+)?$/.test(texto)) return dataDeSerialExcel(Number(texto));

  return null;
}
