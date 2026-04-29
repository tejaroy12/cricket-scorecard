"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Team = { id: string; name: string };
type Result = { ok: boolean; error?: string };
export type AddPlayerInput = {
  name: string;
  teamId: string | null;
  role: string;
  battingStyle: string;
  bowlingStyle: string;
  jerseyNumber: number | null;
  phone: string;
};

const ROLE_OPTIONS = [
  { value: "BATTER", label: "Batter" },
  { value: "BOWLER", label: "Bowler" },
  { value: "ALL_ROUNDER", label: "All-rounder" },
  { value: "WICKET_KEEPER", label: "Wicket-keeper" },
] as const;

function validateName(v: string) {
  if (!v.trim()) return "Full name is required.";
  if (v.trim().length < 2) return "Name looks too short.";
  return null;
}
function validatePhone(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "Phone number is required.";
  if (d.length < 10) return "Phone number must be at least 10 digits.";
  return null;
}
function validateJersey(v: string) {
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 999)
    return "Jersey # must be 0–999.";
  return null;
}

export function AddPlayerForm({
  teams,
  action,
}: {
  teams: Team[];
  action: (input: AddPlayerInput) => Promise<Result>;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState("BATTER");
  const [battingStyle, setBattingStyle] = useState("RHB");
  const [bowlingStyle, setBowlingStyle] = useState("");
  const [phone, setPhone] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");

  const [errors, setErrors] = useState<{
    name?: string | null;
    phone?: string | null;
    jersey?: string | null;
  }>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setName("");
    setTeamId("");
    setRole("BATTER");
    setBattingStyle("RHB");
    setBowlingStyle("");
    setPhone("");
    setJerseyNumber("");
    setErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      name: validateName(name),
      phone: validatePhone(phone),
      jersey: validateJersey(jerseyNumber),
    };
    setErrors(next);
    if (next.name || next.phone || next.jersey) return;

    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await action({
        name: name.trim(),
        teamId: teamId || null,
        role,
        battingStyle,
        bowlingStyle: bowlingStyle.trim(),
        phone: phone.trim(),
        jerseyNumber: jerseyNumber === "" ? null : Number(jerseyNumber),
      });
      if (res.ok) {
        setSuccess(`Added "${name.trim()}".`);
        reset();
        router.refresh();
      } else {
        setServerError(res.error || "Could not add player.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Add player</h2>
        <p className="text-xs text-slate-500">
          Add anyone who might play. A default team is optional — you pick
          who plays for which side when creating each match.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Full name" error={errors.name} required>
          <input
            className={inputCls(!!errors.name)}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((x) => ({ ...x, name: null }));
            }}
            onBlur={() =>
              setErrors((x) => ({ ...x, name: validateName(name) }))
            }
            placeholder="Virat Kumar"
            required
          />
        </Field>

        <Field label="Phone" error={errors.phone} required>
          <input
            className={inputCls(!!errors.phone)}
            type="tel"
            inputMode="numeric"
            pattern="[0-9 +()-]*"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((x) => ({ ...x, phone: null }));
            }}
            onBlur={() =>
              setErrors((x) => ({ ...x, phone: validatePhone(phone) }))
            }
            placeholder="9876543210"
            required
          />
        </Field>

        <Field label="Default team (optional)">
          <select
            className="input"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">— Free agent —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Role">
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Batting style">
          <select
            className="input"
            value={battingStyle}
            onChange={(e) => setBattingStyle(e.target.value)}
          >
            <option value="RHB">Right-hand bat</option>
            <option value="LHB">Left-hand bat</option>
          </select>
        </Field>

        <Field label="Bowling style">
          <input
            className="input"
            value={bowlingStyle}
            onChange={(e) => setBowlingStyle(e.target.value)}
            placeholder="e.g. Right-arm fast"
          />
        </Field>

        <Field label="Jersey #" error={errors.jersey}>
          <input
            className={inputCls(!!errors.jersey)}
            type="number"
            min={0}
            max={999}
            value={jerseyNumber}
            onChange={(e) => {
              setJerseyNumber(e.target.value);
              if (errors.jersey)
                setErrors((x) => ({ ...x, jersey: null }));
            }}
            onBlur={() =>
              setErrors((x) => ({ ...x, jersey: validateJersey(jerseyNumber) }))
            }
          />
        </Field>
      </div>

      {success && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {success}
        </div>
      )}
      {serverError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
          {serverError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Adding…" : "Add player"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="btn-ghost"
        >
          Reset
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <div className="mt-1 text-xs font-medium text-red-600">{error}</div>
      )}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return hasError ? "input ring-2 ring-red-300" : "input";
}
