import { z } from "zod";

const num = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Informe ${label}.` })
    .refine(Number.isFinite, `Informe ${label}.`)
    .min(min, `Use um valor entre ${min} e ${max}.`)
    .max(max, `Use um valor entre ${min} e ${max}.`);

export const alarmSettingsSchema = z
  .object({
    tempMinC: num("a temperatura mínima", 30, 42),
    tempMaxC: num("a temperatura máxima", 30, 42),
    humidityMinPct: num("a umidade mínima", 0, 100),
    humidityMaxPct: num("a umidade máxima", 0, 100),
    waterMinPct: num("o nível mínimo de água", 0, 100).pipe(z.number().int("Use um número inteiro.")),
    alarmDelayS: num("o tempo de confirmação", 0, 1800).pipe(z.number().int("Use um número inteiro.")),
    offlineTimeoutS: num("a tolerância de comunicação", 60, 3600).pipe(z.number().int("Use um número inteiro.")),
    preset: z.string().max(60).nullable().optional(),
  })
  .refine((d) => d.tempMinC < d.tempMaxC, {
    message: "A mínima deve ser menor que a máxima.",
    path: ["tempMaxC"],
  })
  .refine((d) => d.humidityMinPct < d.humidityMaxPct, {
    message: "A mínima deve ser menor que a máxima.",
    path: ["humidityMaxPct"],
  });

export type AlarmSettingsInput = z.infer<typeof alarmSettingsSchema>;

export interface AlarmPreset {
  id: string;
  label: string;
  description: string;
  tempMinC: number;
  tempMaxC: number;
  humidityMinPct: number;
  humidityMaxPct: number;
}

/**
 * Faixas de referência para ovos de galinha em chocadeira com ventilação
 * forçada (serviços de extensão das universidades de Kentucky e Minnesota).
 * Devem ser validadas pela equipe de zootecnia antes do uso em campo.
 */
export const ALARM_PRESETS: AlarmPreset[] = [
  {
    id: "galinha-incubacao",
    label: "Galinha: incubação (dias 0 a 17)",
    description: "Temperatura entre 37,2 e 37,8 °C e umidade entre 50 e 60%.",
    tempMinC: 37.2,
    tempMaxC: 37.8,
    humidityMinPct: 50,
    humidityMaxPct: 60,
  },
  {
    id: "galinha-eclosao",
    label: "Galinha: eclosão (dias 18 a 21)",
    description: "Viragem suspensa; temperatura entre 37,0 e 37,6 °C e umidade elevada, entre 62 e 72%.",
    tempMinC: 37.0,
    tempMaxC: 37.6,
    humidityMinPct: 62,
    humidityMaxPct: 72,
  },
];
