"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type RegisterInput = {
  name: string;
  phone: string;
  employeeId: string;
  role: string;
  battingStyle: string;
  bowlingStyle: string;
  jerseyNumber: number | null;
};

type Result = { ok: true; redirectTo: string } | { ok: false; error: string };

function validateName(v: string) {
  if (!v.trim()) return "Please enter your full name.";
  if (v.trim().length < 2) return "Name looks too short.";
  return null;
}
function validatePhone(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "Phone number is required.";
  if (digits.length < 10) return "Phone number must be at least 10 digits.";
  return null;
}
function validateJersey(v: string) {
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 999) return "Jersey # must be 0–999.";
  return null;
}

export function RegisterForm({
  action,
}: {
  action: (input: RegisterInput) => Promise<Result>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("BATTER");
  const [battingStyle, setBattingStyle] = useState("RHB");
  const [bowlingStyle, setBowlingStyle] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");

  const [errors, setErrors] = useState<{
    name?: string | null;
    phone?: string | null;
    jersey?: string | null;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
    startTransition(async () => {
      const res = await action({
        name: name.trim(),
        phone: phone.trim(),
        employeeId: employeeId.trim(),
        role,
        battingStyle,
        bowlingStyle: bowlingStyle.trim(),
        jerseyNumber: jerseyNumber === "" ? null : Number(jerseyNumber),
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      // Success — clear locally then redirect to the player profile.
      setName("");
      setPhone("");
      setEmployeeId("");
      setBowlingStyle("");
      setJerseyNumber("");
      setErrors({});
      router.push(res.redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label required>Full name</Label>
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
            placeholder="e.g. Virat Kumar"
            required
          />
          <FieldError msg={errors.name} />
        </div>

        <div>
          <Label required>Phone</Label>
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
          <FieldError msg={errors.phone} />
        </div>

        <div>
          <Label>Employee ID (optional)</Label>
          <input
            className="input"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. HIT-12345"
          />
        </div>

        <div>
          <Label required>Role</Label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="BATTER">Batter</option>
            <option value="BOWLER">Bowler</option>
            <option value="ALL_ROUNDER">All-rounder</option>
            <option value="WICKET_KEEPER">Wicket-keeper</option>
          </select>
        </div>

        <div>
          <Label>Batting style</Label>
          <select
            className="input"
            value={battingStyle}
            onChange={(e) => setBattingStyle(e.target.value)}
          >
            <option value="RHB">Right-hand bat</option>
            <option value="LHB">Left-hand bat</option>
          </select>
        </div>

        <div>
          <Label>Bowling style (optional)</Label>
          <input
            className="input"
            value={bowlingStyle}
            onChange={(e) => setBowlingStyle(e.target.value)}
            placeholder="e.g. Right-arm fast"
          />
        </div>

        <div>
          <Label>Jersey # (optional)</Label>
          <input
            className={inputCls(!!errors.jersey)}
            type="number"
            min={0}
            max={999}
            value={jerseyNumber}
            onChange={(e) => {
              setJerseyNumber(e.target.value);
              if (errors.jersey) setErrors((x) => ({ ...x, jersey: null }));
            }}
            onBlur={() =>
              setErrors((x) => ({ ...x, jersey: validateJersey(jerseyNumber) }))
            }
            placeholder="e.g. 18"
          />
          <FieldError msg={errors.jersey} />
        </div>
      </div>

      {serverError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
          {serverError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Registering…" : "Register me"}
        </button>
        <Link href="/players" className="btn-ghost">
          Browse players first
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        By registering you agree your name and contact details may be shown
        to other league members for match scheduling.
      </p>
    </form>
  );
}

function Label({
  required,
  children,
}: {
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="label">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}
function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return <div className="mt-1 text-xs font-medium text-red-600">{msg}</div>;
}
function inputCls(hasError: boolean) {
  return hasError ? "input ring-2 ring-red-300" : "input";
}
