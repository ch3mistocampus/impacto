"use client";

import { useEffect, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { Button } from "@/components/ui/tricolor";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Live = FunctionReturnType<typeof api.presenter.liveDemo>;
type State = "ok" | "fail" | "info" | "pending";

function Row({ state, label }: { state: State; label: string }) {
  const { t } = useI18n();
  const mark = state === "ok" ? "✓" : state === "fail" ? "!" : state === "info" ? "i" : "…";
  const tone =
    state === "ok"
      ? "bg-emerald text-on-emerald"
      : state === "fail"
        ? "bg-red-soft text-red shadow-[inset_0_0_0_1px_var(--red)]"
        : "shadow-[inset_0_0_0_1px_var(--rule)] text-foreground";
  const word = state === "ok" ? "demo.pf.ok" : state === "fail" ? "demo.pf.fail" : state === "info" ? "demo.pf.info" : "demo.pf.checking";
  return (
    <li className="flex items-start gap-3 py-2">
      <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-[2px] text-sm font-semibold ${tone}`}>
        {mark}
      </span>
      <span className="text-[15px]">
        {label}
        <span className="sr-only"> — {t(word as DictKey)}</span>
      </span>
    </li>
  );
}

export function Preflight({ live, onReset }: { live: Live | undefined; onReset: () => void }) {
  const { t } = useI18n();
  const { user, sessionToken, signInAs } = useSession();
  const enabled = useQuery(api.demo.isEnabled);
  const conn = useConvexConnectionState();
  const signInMut = useMutation(api.sessions.signInAsDemo);
  const resetMut = useMutation(api.demo.resetDemoFromUI);
  const [online, setOnline] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; key: DictKey } | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const b = (x: boolean | undefined): State => (x === undefined ? "pending" : x ? "ok" : "fail");
  const bricks = live?.needs.find((n) => n.itemKey === "bricks");
  const cement = live?.needs.find((n) => n.itemKey === "cement_bag");
  const roof = live?.needs.find((n) => n.itemKey === "zinc_sheet");
  const needsOk =
    live === undefined
      ? undefined
      : !!live &&
        live.needs.every((n) => n.status === "draft") &&
        bricks?.ledger.requested === 200 &&
        cement?.ledger.requested === 15 &&
        !!roof?.needsConfirmation;
  const noPledges = live === undefined ? undefined : !!bricks && bricks.activePledgeCount === 0 && bricks.ledger.pledged === 0;

  async function doReset() {
    setBusy(true);
    setMsg(null);
    try {
      let token = user?.role === "coordinator" ? sessionToken : undefined;
      if (!token) {
        // Reset is coordinator-only server-side: sign in as the demo coordinator first.
        token = (await signInMut({ role: "coordinator" })).token;
        await signInAs("coordinator");
      }
      await resetMut({ sessionToken: token });
      onReset();
      setMsg({ ok: true, key: "demo.resetDone" });
    } catch {
      setMsg({ ok: false, key: "demo.resetError" });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <section aria-labelledby="demo-preflight" className="border border-border bg-surface p-4">
      <h2 id="demo-preflight" className="font-display text-2xl font-normal">
        {t("demo.preflight")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("demo.preflightLead")}</p>
      <ul className="mt-3 divide-y divide-border">
        <Row state={b(enabled)} label={t("demo.pf.demoMode")} />
        <Row state={b(live === undefined ? undefined : live !== null)} label={t("demo.pf.project")} />
        <Row state={b(live === undefined ? undefined : live?.status === "in_review")} label={t("demo.pf.inReview")} />
        <Row state={b(needsOk)} label={t("demo.pf.needsDraft")} />
        <Row state={b(noPledges)} label={t("demo.pf.noPledges")} />
        <Row state="info" label={t("demo.pf.ai")} />
        <Row state={b(online && conn.isWebSocketConnected)} label={t("demo.pf.network")} />
      </ul>
      <div className="mt-4">
        <Button variant="danger" onClick={() => setConfirm(true)} disabled={enabled !== true || busy} busy={busy}>
          {t("demo.reset")}
        </Button>
        {enabled === false && <p className="mt-2 text-sm text-muted">{t("demo.resetDisabled")}</p>}
        {msg && (
          <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-emerald" : "text-red"}`}>
            {t(msg.key)}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={t("demo.resetTitle")}
        body={t("demo.resetBody")}
        confirmLabel={t("demo.resetConfirm")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        busy={busy}
        onConfirm={doReset}
        onCancel={() => setConfirm(false)}
      />
    </section>
  );
}
