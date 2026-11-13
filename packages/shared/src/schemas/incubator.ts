import { z } from "zod";

/** Converte campos vazios de formulário em `null`. */
const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

/**
 * Dados editáveis de uma chocadeira. As mesmas regras existem como
 * restrições (CHECK) no banco, para que a validação não dependa só da tela.
 */
export const incubatorInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome para a chocadeira.")
    .max(80, "O nome deve ter no máximo 80 caracteres."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9_-]{1,32}$/,
      "Use até 32 caracteres: letras sem acento, números, hífen ou sublinhado.",
    ),
  model: z.preprocess(
    emptyToNull,
    z.string().trim().max(80, "O modelo deve ter no máximo 80 caracteres.").nullable(),
  ),
  eggCapacity: z.preprocess(
    emptyToNull,
    z.coerce
      .number({ error: "Informe um número inteiro." })
      .int("Informe um número inteiro.")
      .min(1, "A capacidade mínima é 1 ovo.")
      .max(10000, "A capacidade máxima é 10.000 ovos.")
      .nullable(),
  ),
  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000, "A descrição deve ter no máximo 1.000 caracteres.").nullable(),
  ),
});

export type IncubatorInput = z.infer<typeof incubatorInputSchema>;
