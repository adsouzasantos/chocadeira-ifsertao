"use client";

import { ALARM_PRESETS } from "@chocadeira/shared";
import { useActionState, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { num } from "@/lib/instrumentation";
import { initialFormState, type AlarmSettings, type FormState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const toText = (v: unknown) => (num(v) === null ? "" : String(num(v)).replace(".", ","));

export function AlarmSettingsForm({
  action,
  settings,
  cancelHref,
}: {
  action: Action;
  settings: AlarmSettings;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [preset, setPreset] = useState(state.values?.preset ?? settings.preset ?? "");

  const v = state.values ?? {
    tempMinC: toText(settings.temp_min_c),
    tempMaxC: toText(settings.temp_max_c),
    humidityMinPct: toText(settings.humidity_min_pct),
    humidityMaxPct: toText(settings.humidity_max_pct),
    waterMinPct: String(settings.water_min_pct),
    alarmDelayS: String(settings.alarm_delay_s),
    offlineTimeoutS: String(settings.offline_timeout_s),
  };

  /** Aplica uma faixa de referência aos campos (o usuário ainda pode ajustar). */
  function applyPreset(id: string) {
    const p = ALARM_PRESETS.find((x) => x.id === id);
    const form = formRef.current;
    if (!p || !form) return;
    const set = (name: string, value: number) => {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = String(value).replace(".", ",");
    };
    set("tempMinC", p.tempMinC);
    set("tempMaxC", p.tempMaxC);
    set("humidityMinPct", p.humidityMinPct);
    set("humidityMaxPct", p.humidityMaxPct);
    setPreset(p.id);
  }

  const decimal = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate onInput={(ev) => {
      // Edição manual de uma faixa deixa de corresponder à referência escolhida
      const name = (ev.target as HTMLInputElement).name;
      if (["tempMinC", "tempMaxC", "humidityMinPct", "humidityMaxPct"].includes(name)) setPreset("");
    }}>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <input type="hidden" name="preset" value={preset} />

      <fieldset>
        <legend className="text-sm font-semibold">Faixa de referência</legend>
        <p className="mt-0.5 text-sm text-text-muted">
          Preenche temperatura e umidade com valores de referência. Os valores devem ser validados pela equipe técnica.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ALARM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => applyPreset(p.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                preset === p.id ? "border-brand-500 bg-brand-50" : "border-border-strong bg-white hover:bg-cream-50",
              )}
            >
              <span className="block text-sm font-semibold text-text">{p.label}</span>
              <span className="mt-0.5 block text-xs text-text-muted">{p.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold sm:col-span-2">Temperatura (°C) · alarme crítico</legend>
        <Field id="tempMinC" label="Mínima" error={e.tempMinC}>
          <Input id="tempMinC" name="tempMinC" defaultValue={v.tempMinC} invalid={!!e.tempMinC} {...decimal} />
        </Field>
        <Field id="tempMaxC" label="Máxima" error={e.tempMaxC}>
          <Input id="tempMaxC" name="tempMaxC" defaultValue={v.tempMaxC} invalid={!!e.tempMaxC} {...decimal} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold sm:col-span-2">Umidade relativa (%) · alarme de atenção</legend>
        <Field id="humidityMinPct" label="Mínima" error={e.humidityMinPct}>
          <Input id="humidityMinPct" name="humidityMinPct" defaultValue={v.humidityMinPct} invalid={!!e.humidityMinPct} {...decimal} />
        </Field>
        <Field id="humidityMaxPct" label="Máxima" error={e.humidityMaxPct}>
          <Input id="humidityMaxPct" name="humidityMaxPct" defaultValue={v.humidityMaxPct} invalid={!!e.humidityMaxPct} {...decimal} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold sm:col-span-3">Água e comunicação</legend>
        <Field id="waterMinPct" label="Nível mínimo de água (%)" error={e.waterMinPct} hint="Abaixo disso: alarme imediato.">
          <Input id="waterMinPct" name="waterMinPct" inputMode="numeric" defaultValue={v.waterMinPct} invalid={!!e.waterMinPct} />
        </Field>
        <Field
          id="alarmDelayS"
          label="Confirmação (s)"
          error={e.alarmDelayS}
          hint="Tempo fora da faixa antes de alarmar. Evita alarmes ao abrir a porta."
        >
          <Input id="alarmDelayS" name="alarmDelayS" inputMode="numeric" defaultValue={v.alarmDelayS} invalid={!!e.alarmDelayS} />
        </Field>
        <Field
          id="offlineTimeoutS"
          label="Tolerância sem comunicação (s)"
          error={e.offlineTimeoutS}
          hint="Entre 60 e 3600 s."
        >
          <Input
            id="offlineTimeoutS"
            name="offlineTimeoutS"
            inputMode="numeric"
            defaultValue={v.offlineTimeoutS}
            invalid={!!e.offlineTimeoutS}
          />
        </Field>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancelar
        </ButtonLink>
        <SubmitButton>Salvar limites</SubmitButton>
      </div>
    </form>
  );
}
