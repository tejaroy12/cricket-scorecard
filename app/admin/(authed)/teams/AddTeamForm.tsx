"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AddTeamInput = {
  name: string;
  shortName: string;
  logoUrl: string;
};

type Result = { ok: boolean; error?: string };

function validateName(v: string) {
  if (!v.trim()) return "Team name is required.";
  if (v.trim().length < 2) return "Team name looks too short.";
  return null;
}
function validateShort(v: string) {
  if (v && v.length > 5) return "Short code must be 5 characters or fewer.";
  return null;
}
function validateUrl(v: string) {
  if (!v) return null;
  try {
    new URL(v);
    return null;
  } catch {
    return "Logo URL doesn't look like a valid URL.";
  }
}

export function AddTeamForm({
  action,
}: {
  action: (input: AddTeamInput) => Promise<Result>;
}) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [errors, setErrors] = useState<{
    name?: string | null;
    shortName?: string | null;
    logoUrl?: string | null;
  }>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setName("");
    setShortName("");
    setLogoUrl("");
    setErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      name: validateName(name),
      shortName: validateShort(shortName),
      logoUrl: validateUrl(logoUrl),
    };
    setErrors(next);
    if (next.name || next.shortName || next.logoUrl) return;

    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await action({
        name: name.trim(),
        shortName: shortName.trim(),
        logoUrl: logoUrl.trim(),
      });
      if (res.ok) {
        setSuccess(`Created team "${name.trim()}".`);
        reset();
        router.refresh();
      } else {
        setServerError(res.error || "Could not create team.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="text-base font-semibold text-slate-900">
        Add a new team
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">
            Team name<span className="ml-0.5 text-red-500">*</span>
          </label>
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
            placeholder="Hitachi Tigers"
            required
          />
          <FieldError msg={errors.name} />
        </div>
        <div>
          <label className="label">Short code</label>
          <input
            className={inputCls(!!errors.shortName)}
            value={shortName}
            onChange={(e) => {
              setShortName(e.target.value);
              if (errors.shortName)
                setErrors((x) => ({ ...x, shortName: null }));
            }}
            onBlur={() =>
              setErrors((x) => ({ ...x, shortName: validateShort(shortName) }))
            }
            maxLength={5}
            placeholder="TIG"
          />
          <FieldError msg={errors.shortName} />
        </div>
        <div>
          <label className="label">Logo URL (optional)</label>
          <input
            className={inputCls(!!errors.logoUrl)}
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              if (errors.logoUrl)
                setErrors((x) => ({ ...x, logoUrl: null }));
            }}
            onBlur={() =>
              setErrors((x) => ({ ...x, logoUrl: validateUrl(logoUrl) }))
            }
            placeholder="https://..."
          />
          <FieldError msg={errors.logoUrl} />
        </div>
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
          {pending ? "Creating…" : "Create team"}
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

function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return <div className="mt-1 text-xs font-medium text-red-600">{msg}</div>;
}
function inputCls(hasError: boolean) {
  return hasError ? "input ring-2 ring-red-300" : "input";
}
