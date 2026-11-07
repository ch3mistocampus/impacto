"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { useSession } from "@/lib/session";
import { prepareImageForUpload } from "@/lib/image";
import { DoubleRule, btn, intlLocale } from "@/components/ui/tricolor";
import { MaterialImage } from "@/components/public/MaterialImage";
import { Card, LockIcon, Spinner, btnPrimary, btnSecondary, inputCls, noticeCls, sectionTitle, uploadFile } from "./ui";

export type FieldTodo = {
  id: string;
  kind: "receive" | "deliver" | "receipt";
  projectId: Id<"projects">;
  needId: Id<"materialNeeds"> | null;
  pledgeId: Id<"pledges"> | null;
  expenseId: Id<"expenses"> | null;
  itemKey: string | null;
  nameEs: string;
  nameEn: string;
  unit: string;
  qty: number;
  pledgeMode: "have_materials" | "will_buy" | "request_instructions" | null;
  amount: number | null;
  currency: string | null;
  since: number;
};

function useDate() {
  const { locale } = useI18n();
  const f = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" });
  return (ms: number) => f.format(ms);
}

function amountText(todo: FieldTodo, locale: "es" | "en") {
  if (todo.amount === null) return "";
  return `${todo.amount.toLocaleString(intlLocale(locale))} ${todo.currency ?? ""}`.trim();
}

/** Title line: "Confirm materials arrived · 10 zinc roofing sheets". */
function todoHeadline(todo: FieldTodo, pick: (es: string, en: string) => string, locale: "es" | "en") {
  if (todo.kind === "receipt") return `${amountText(todo, locale)} — ${todo.nameEs}`;
  return `${todo.qty} ${pick(todo.nameEs, todo.nameEn).toLowerCase()}`;
}

function KindIcon({ kind }: { kind: FieldTodo["kind"] }) {
  // Box arriving / truck to site / receipt — simple square-cap strokes in the house style.
  const paths: Record<FieldTodo["kind"], string> = {
    receive: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
    deliver: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  };
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d={paths[kind]} strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/** One tappable to-do row. */
function TodoRow({ todo, onOpen, href, projectLabel }: { todo: FieldTodo; onOpen?: () => void; href?: string; projectLabel?: string }) {
  const { t, pick, locale } = useI18n();
  const date = useDate();
  const sub =
    todo.kind === "receive"
      ? `${t("field.todo.receive.sub")}${todo.pledgeMode ? ` · ${t(`field.todo.mode.${todo.pledgeMode}` as DictKey)}` : ""}`
      : t(`field.todo.${todo.kind}.sub` as DictKey);
  const inner = (
    <>
      <span className="relative grid size-12 shrink-0 place-items-center border border-border bg-paper text-foreground">
        {todo.itemKey ? <MaterialImage itemKey={todo.itemKey} alt="" className="size-12" /> : <KindIcon kind={todo.kind} />}
        <span aria-hidden className="absolute -right-1 -top-1 size-3 rounded-full bg-gold ring-2 ring-surface" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-semibold uppercase tracking-wide text-gold-ink">{t(`field.todo.${todo.kind}` as DictKey)}</span>
        <span className="block text-[17px] font-semibold leading-snug">{todoHeadline(todo, pick, locale)}</span>
        <span className="mt-0.5 block text-sm text-muted">
          {projectLabel ? `${projectLabel} · ` : ""}
          {sub} · {t("field.todo.since")} {date(todo.since)}
        </span>
      </span>
      <span className={`${btn("secondary", "md", "min-h-11 shrink-0 px-3 text-[15px]")} hidden sm:inline-flex`}>
        {t("field.todo.open")} <span aria-hidden>›</span>
      </span>
      <span aria-hidden className="text-xl text-muted sm:hidden">›</span>
    </>
  );
  const cls =
    "group flex w-full min-h-16 items-center gap-3 border border-border bg-surface p-3 text-foreground transition-colors hover:border-gold hover:bg-gold-soft/40 focus-visible:border-gold focus-visible:outline-none";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={cls}>
      {inner}
    </button>
  );
}

// ---------------------------------------------------------------------------

/** To-do card on the project progress page. `?todo=<id>` opens that task directly. */
export function ProjectTodos({ todos, initialOpenId }: { todos: FieldTodo[]; initialOpenId?: string | null }) {
  const { t, tn } = useI18n();
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [done, setDone] = useState(false);
  const open = todos.find((x) => x.id === openId) ?? null;

  return (
    <Card className="border-gold/70">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={sectionTitle}>{t("field.todo.title")}</h2>
        {todos.length > 0 && (
          <span className="font-display text-2xl tabular-nums text-gold-ink">
            {todos.length} <span className="text-sm font-sans text-muted">{tn("field.todo.label", todos.length)}</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{t("field.todo.intro")}</p>
      {done && (
        <p role="status" className="mt-4 border-l-2 border-emerald bg-emerald-soft px-4 py-3 text-[15px] text-emerald">
          {t("field.todo.done")}
        </p>
      )}
      {todos.length === 0 ? (
        <p className="mt-4 font-display text-lg italic text-muted">{t("field.todo.none")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {todos.map((x) => (
            <li key={x.id}>
              <TodoRow
                todo={x}
                onOpen={() => {
                  setDone(false);
                  setOpenId(x.id);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {open && (
        <TodoSheet
          key={open.id}
          todo={open}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            setDone(true);
          }}
        />
      )}
    </Card>
  );
}

/** Field home: every open to-do across my projects, linking into the project with the sheet open. */
export function HomeTodos() {
  const { t, pick } = useI18n();
  const { sessionToken } = useSession();
  const todos = useQuery(api.fieldTasks.myTodos, sessionToken ? { sessionToken } : "skip");
  if (!todos || todos.length === 0) return null;
  return (
    <section aria-labelledby="home-todos">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-todos" className="font-display text-2xl font-normal">
          {t("field.todo.title")}
        </h2>
        <span className="font-display text-2xl tabular-nums text-gold-ink">{todos.length}</span>
      </div>
      <DoubleRule className="mt-3" />
      <p className="mt-3 text-sm text-muted">{t("field.todo.intro")}</p>
      <ul className="mt-3 space-y-2">
        {todos.map((x) => (
          <li key={x.id}>
            <TodoRow
              todo={x}
              href={`/field/${x.projectId}?todo=${encodeURIComponent(x.id)}`}
              projectLabel={pick(x.projectTitleEs, x.projectTitleEn) || x.publicAlias}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

/** Modal sheet: quantity + required photo + optional note → fieldTasks.completeTodo. */
function TodoSheet({ todo, onClose, onDone }: { todo: FieldTodo; onClose: () => void; onDone: () => void }) {
  const { t, pick, locale } = useI18n();
  const { sessionToken } = useSession();
  const genUrl = useMutation(api.fieldTasks.generateUploadUrl);
  const complete = useMutation(api.fieldTasks.completeTodo);
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fileId = useId();
  const [qty, setQty] = useState(todo.qty);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState<"photo" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  const setBlob = async (f: Blob | undefined) => {
    if (!f) return;
    setBusy("photo");
    setError(null);
    try {
      const file = f instanceof File ? f : new File([f], "proof.jpg", { type: f.type || "image/jpeg" });
      const blob = await prepareImageForUpload(file); // EXIF/GPS stripped, compressed
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      console.error(e);
      setError(t("field.photos.failed"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Presenter shortcut: a synthetic proof photo shipped with the app (no camera needed on stage).
  const loadDemoPhoto = async () => {
    const src = todo.kind === "receipt" ? "/proof/receipt.jpg" : `/proof/${todo.itemKey ?? "tools"}.jpg`;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      await setBlob(await res.blob());
    } catch {
      const fallback = await fetch("/proof/tools.jpg");
      await setBlob(await fallback.blob());
    }
  };

  const submit = async () => {
    if (!sessionToken) return;
    if (!photo) {
      setError(t("field.todo.photo.required"));
      return;
    }
    setBusy("send");
    setError(null);
    try {
      const storageId = (await uploadFile(await genUrl({ sessionToken }), photo.blob)) as Id<"_storage">;
      await complete({
        sessionToken,
        projectId: todo.projectId,
        kind: todo.kind,
        needId: todo.needId ?? undefined,
        pledgeId: todo.pledgeId ?? undefined,
        expenseId: todo.expenseId ?? undefined,
        qty: todo.kind === "receipt" ? undefined : qty,
        photoStorageId: storageId,
        ...(note.trim() ? (locale === "es" ? { noteEs: note } : { noteEn: note }) : {}),
      });
      onDone();
    } catch (e) {
      const code = e instanceof ConvexError ? (e.data as { code?: string })?.code : undefined;
      console.error(e);
      setError(code === "EXCEEDS_PLEDGE" || code === "DELIVERED_EXCEEDS_RECEIVED" ? `${t("field.todo.qtyMax")} ${todo.qty}` : t("field.error"));
      setBusy(null);
    }
  };

  const hint = t(`field.todo.photo.${todo.kind}` as DictKey);
  const max = todo.qty;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="motion-dialog m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-[2px] border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center border border-border bg-paper">
            {todo.itemKey ? <MaterialImage itemKey={todo.itemKey} alt="" className="size-14" /> : <KindIcon kind={todo.kind} />}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-gold-ink">{t(`field.todo.${todo.kind}` as DictKey)}</p>
            <h2 id={titleId} className="font-display text-2xl font-normal leading-tight">
              {todo.kind === "receipt" ? todo.nameEs : pick(todo.nameEs, todo.nameEn)}
            </h2>
            {todo.kind === "receipt" && <p className="text-[15px] tabular-nums">{amountText(todo, locale)}</p>}
          </div>
        </div>

        {todo.kind !== "receipt" && (
          <div>
            <span className="text-sm font-semibold">{todo.kind === "receive" ? t("field.todo.qty") : t("field.todo.qtyDeliver")}</span>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                className={`${btnSecondary} w-12 px-0 text-xl`}
                aria-label="−"
                disabled={qty <= 1 || busy !== null}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(max, Math.round(Number(e.target.value) || 1))))}
                className={`${inputCls} w-24 text-center text-lg tabular-nums`}
                aria-label={t("field.todo.qty")}
              />
              <button
                type="button"
                className={`${btnSecondary} w-12 px-0 text-xl`}
                aria-label="+"
                disabled={qty >= max || busy !== null}
                onClick={() => setQty((q) => Math.min(max, q + 1))}
              >
                +
              </button>
              <span className="text-[15px] text-muted">
                {locale === "es" ? `${todo.unit} · ` : ""}
                {t("field.todo.qtyMax")} {max}
              </span>
            </div>
          </div>
        )}

        <div>
          <span className="text-sm font-semibold">{t("field.todo.photo")}</span>
          <p className="mt-0.5 text-sm text-muted">{hint}</p>
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void setBlob(e.target.files?.[0])}
          />
          {photo ? (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="aspect-[4/3] w-full border border-border object-cover" />
              <label htmlFor={fileId} className={`${btn("quiet", "md", "mt-1 min-h-11 cursor-pointer text-[15px]")}`}>
                {t("field.todo.photo.retake")}
              </label>
            </div>
          ) : (
            <div className="mt-2 grid gap-2">
              <label
                htmlFor={fileId}
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-rule bg-paper text-[15px] font-semibold hover:bg-gold-soft/40"
              >
                {busy === "photo" ? (
                  <Spinner />
                ) : (
                  <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinecap="square" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                )}
                {busy === "photo" ? t("field.photos.processing") : t("field.todo.photo.take")}
              </label>
              <button type="button" className={btn("quiet", "md", "min-h-11 text-[15px]")} disabled={busy !== null} onClick={() => void loadDemoPhoto()}>
                {t("field.todo.demoPhoto")}
              </button>
            </div>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted">
            <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("field.photos.metaStripped")}
          </p>
        </div>

        <label className="block text-sm font-semibold">
          {t("field.todo.note")}
          <textarea
            rows={2}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("field.todo.note.placeholder")}
            className={`${inputCls} mt-1.5 font-normal`}
          />
        </label>

        {error && (
          <p role="alert" className={noticeCls}>
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} disabled={busy === "send"} onClick={onClose}>
            {t("field.todo.cancel")}
          </button>
          <button type="button" className={btnPrimary} disabled={busy !== null || !photo} onClick={() => void submit()}>
            {busy === "send" ? <Spinner /> : null}
            {busy === "send" ? t("field.todo.submitting") : t("field.todo.submit")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
