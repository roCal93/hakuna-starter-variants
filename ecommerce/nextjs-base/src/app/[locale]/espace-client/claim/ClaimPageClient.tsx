"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatProductClaimCodeForDisplay,
  normalizeProductClaimCodeInput,
} from "@/lib/product-claim-code-format";

type ClaimState =
  | { status: "invalid_code" }
  | { status: "auth_required"; from: string }
  | { status: "admin_blocked" }
  | { status: "claiming" }
  | { status: "success"; productRecordDocumentId: string }
  | { status: "error"; message: string };

export function ClaimPageClient({
  locale,
  code,
  isAuthenticated,
  isAdmin,
}: {
  locale: string;
  code?: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const isEn = locale === "en";
  const normalizedCode = normalizeProductClaimCodeInput(code ?? "");
  const [manualCodeInput, setManualCodeInput] = useState(
    formatProductClaimCodeForDisplay(normalizedCode)
  );
  const [submittedCode, setSubmittedCode] = useState(normalizedCode);

  const buildActivationFromPath = (activationCode: string) => {
    const query = new URLSearchParams({ code: activationCode });
    return `/${locale}/espace-client/activation?${query.toString()}`;
  };

  const fromPath = useMemo(() => {
    if (normalizedCode) {
      return buildActivationFromPath(normalizedCode);
    }

    return `/${locale}/espace-client/activation`;
  }, [locale, normalizedCode]);

  const [state, setState] = useState<ClaimState>(() => {
    if (!normalizedCode) return { status: "invalid_code" };
    if (!isAuthenticated) return { status: "auth_required", from: fromPath };
    if (isAdmin) return { status: "admin_blocked" };
    return { status: "claiming" };
  });

  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;

    const activeCode = submittedCode.trim();
    if (!activeCode) return;

    let cancelled = false;

    const claim = async () => {
      const response = await fetch("/api/product-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeCode }),
      }).catch(() => null);

      if (!response) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              "Impossible de contacter le serveur pour associer ce produit.",
          });
        }
        return;
      }

      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        productRecordDocumentId?: string;
        error?: string;
      } | null;

      if (!response.ok || !json?.success || !json.productRecordDocumentId) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              json?.error ??
              "Ce produit ne peut pas être associé automatiquement.",
          });
        }
        return;
      }

      if (!cancelled) {
        setState({
          status: "success",
          productRecordDocumentId: json.productRecordDocumentId,
        });
      }
    };

    claim();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, submittedCode, isAdmin]);

  const onSubmitCode = () => {
    const activationCode = normalizeProductClaimCodeInput(manualCodeInput);
    if (!activationCode) return;

    const activationPath = buildActivationFromPath(activationCode);
    router.replace(activationPath);

    setManualCodeInput(formatProductClaimCodeForDisplay(activationCode));
    setSubmittedCode(activationCode);

    if (!isAuthenticated) {
      setState({
        status: "auth_required",
        from: activationPath,
      });
      return;
    }

    if (isAdmin) {
      setState({ status: "admin_blocked" });
      return;
    }

    setState({ status: "claiming" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
        {isEn ? "Product activation" : "Activation produit"}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[0.01em] text-neutral-900">
        {isEn
          ? "Link your product to your account"
          : "Associer votre produit a votre compte"}
      </h1>

      {state.status === "invalid_code" ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-700">
          <p>
            {isEn
              ? "Enter your activation code to link your product."
              : "Entrez votre code d activation pour rattacher le produit."}
          </p>
          {normalizedCode ? (
            <p className="mt-2 font-mono text-xs tracking-[0.08em] text-neutral-500">
              {isEn ? "Detected code" : "Code detecte"}: {formatProductClaimCodeForDisplay(normalizedCode)}
            </p>
          ) : null}
          <form
            className="mt-4 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCode();
            }}
          >
            <input
              value={manualCodeInput}
              onChange={(event) =>
                setManualCodeInput(
                  formatProductClaimCodeForDisplay(event.target.value)
                )
              }
              placeholder="Code d activation"
              className="w-full max-w-xs border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            />
            <button
              type="submit"
              disabled={!manualCodeInput.trim()}
              className="inline-flex items-center border border-black bg-black px-3 py-2 text-xs uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEn ? "Continue" : "Continuer"}
            </button>
          </form>
        </div>
      ) : null}

      {state.status === "auth_required" ? (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">
            {isEn
              ? "Sign in or create an account to link this product."
              : "Connectez-vous ou creez votre compte pour associer ce produit."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/espace-client/connexion?from=${encodeURIComponent(state.from)}`}
              className="inline-flex items-center border border-black bg-black px-4 py-2.5 text-xs uppercase tracking-[0.1em] text-white"
            >
              {isEn ? "Sign in" : "Se connecter"}
            </Link>
            <Link
              href={`/${locale}/espace-client/inscription?from=${encodeURIComponent(state.from)}`}
              className="inline-flex items-center border border-neutral-400 px-4 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-700"
            >
              {isEn ? "Create account" : "Creer un compte"}
            </Link>
          </div>
        </div>
      ) : null}

      {state.status === "admin_blocked" ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p>
            {isEn
              ? "You are signed in with an admin account. Claim is blocked for admins."
              : "Vous etes connecte avec un compte admin. Le claim est bloque pour les admins."}
          </p>
        </div>
      ) : null}

      {state.status === "claiming" ? (
        <p className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700">
          {isEn ? "Linking in progress..." : "Association en cours..."}
        </p>
      ) : null}

      {state.status === "success" ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p>
            {isEn
              ? "Your product has been linked to your account."
              : "Votre produit a bien ete associe a votre compte."}
          </p>
          <Link
            href={`/${locale}/espace-client/tableau-de-bord`}
            className="mt-3 inline-flex items-center text-xs uppercase tracking-[0.1em] underline"
          >
            {isEn ? "Go to dashboard" : "Aller au tableau de bord"}
          </Link>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p>{state.message}</p>
          <Link
            href={`/${locale}/espace-client/tableau-de-bord`}
            className="mt-3 inline-flex items-center text-xs uppercase tracking-[0.1em] underline"
          >
            {isEn ? "Go to dashboard" : "Aller au tableau de bord"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
