import { z } from 'zod';

export const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones');
export const uuid = z.string().uuid();
export const acceso = z.enum(['general', 'restringido']);
export const prioridad = z.enum(['alta', 'media', 'baja']);
export const rol = z.enum(['general', 'admin_espacio']);
const texto = (max) => z.string().trim().max(max);
export const tituloT = z.string().trim().min(1).max(200);
export const md = z.string().max(500_000);
export const optText = (max = 2000) =>
  texto(max).transform((v) => (v === '' ? null : v)).nullable().optional();

export const urlHttp = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'La URL debe ser http o https');

export const ipSchema = z
  .string()
  .trim()
  .refine((v) => /^[0-9a-fA-F:.]+$/.test(v) && v.length <= 45, 'IP inválida');
