import { z } from 'zod';
import { zAno, zMes } from './comuns.js';

export const resumoMensalSchema = z.object({
  ano: zAno,
  mes: zMes,
});

export type ResumoMensalEntrada = z.infer<typeof resumoMensalSchema>;
