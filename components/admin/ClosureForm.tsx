'use client';

import Link from 'next/link';
import { useTransition, useState, useRef } from 'react';

export interface ClosureFormLocation {
  id: string;
  name: string;
  slug: string;
}

export interface ClosureFormValues {
  location_id?: string;
  kind?: string;
  affects?: string | null;
  reason?: string;
  source?: string;
  source_url?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  next_review_at?: string | null;
}

interface Props {
  locations: ClosureFormLocation[];
  defaultValues?: ClosureFormValues;
  /** Primary save action (create or update). */
  saveAction: (data: FormData) => Promise<void>;
  saveLabel?: string;
  /** If set, an "Approve & publish" button appears that calls this with the
   *  current form values. Used on edit pages for draft closures. */
  approveDraftAction?: ((data: FormData) => Promise<void>) | null;
  /** If set, a "Discard draft" button appears. */
  discardDraftAction?: (() => Promise<void>) | null;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function toDateOnly(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

type FocusableEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function ClosureForm({
  locations,
  defaultValues = {},
  saveAction,
  saveLabel = 'Save closure',
  approveDraftAction = null,
  discardDraftAction = null,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * After the user leaves a field, mirror its HTML validity state into
   * aria-invalid so screen readers announce the same information that the
   * :user-invalid CSS pseudo-class shows visually.
   * (The :user-invalid rule fires automatically; aria-invalid must be set
   * by JS because CSS cannot write DOM attributes.)
   */
  function onBlurSync(e: React.FocusEvent<FocusableEl>) {
    const el = e.currentTarget;
    el.setAttribute('aria-invalid', String(!el.validity.valid));
  }

  /**
   * While the user types / changes a field that was already marked invalid,
   * re-check so the error indicator clears as soon as the value is valid again.
   */
  function onInputRecheck(
    e: React.FormEvent<FocusableEl> | React.ChangeEvent<FocusableEl>,
  ) {
    const el = e.currentTarget;
    if (el.getAttribute('aria-invalid') === 'true') {
      el.setAttribute('aria-invalid', String(!el.validity.valid));
    }
  }

  async function handleSave(formData: FormData) {
    setServerError(null);
    startTransition(async () => {
      try {
        await saveAction(formData);
      } catch (err: unknown) {
        // Next.js redirect/notFound throws a special object — re-throw it so
        // the router can handle navigation.
        if (typeof err === 'object' && err !== null && 'digest' in err) throw err;
        setServerError(
          err instanceof Error ? err.message : 'Save failed. Please try again.',
        );
      }
    });
  }

  async function handleApprove() {
    if (!approveDraftAction) return;
    setServerError(null);
    // Pass current form values so the approve action can apply any edits made
    // to kind / affects / effective_to before promoting to active.
    const formData = formRef.current
      ? new FormData(formRef.current)
      : new FormData();
    startTransition(async () => {
      try {
        await approveDraftAction(formData);
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'digest' in err) throw err;
        setServerError(
          err instanceof Error ? err.message : 'Approve failed. Please try again.',
        );
      }
    });
  }

  async function handleDiscard() {
    if (!discardDraftAction) return;
    if (!window.confirm('Discard this draft? This cannot be undone.')) return;
    setServerError(null);
    startTransition(async () => {
      try {
        await discardDraftAction();
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'digest' in err) throw err;
        setServerError(
          err instanceof Error ? err.message : 'Discard failed.',
        );
      }
    });
  }

  // ─── Shared style fragments ─────────────────────────────────────────────────
  const labelClass = 'block text-sm font-medium text-text mb-1';
  const inputBase = [
    'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text',
    'placeholder:text-text-muted',
    'focus:outline-none focus:ring-2 focus:ring-rva-blue focus:border-rva-blue',
    // CSS :user-invalid — visual error state after the user has interacted
    '[&:user-invalid]:border-status-danger [&:user-invalid]:ring-1 [&:user-invalid]:ring-status-danger',
    // JS-synced aria-invalid fallback
    '[&[aria-invalid=true]]:border-status-danger [&[aria-invalid=true]]:ring-1 [&[aria-invalid=true]]:ring-status-danger',
  ].join(' ');
  const hintClass = 'mt-1 text-xs text-text-muted';
  const reqMark = (
    <span aria-hidden="true" className="ml-0.5 text-status-danger">
      *
    </span>
  );

  return (
    <form ref={formRef} action={handleSave} className="space-y-5" noValidate>
      {/* Server-side error banner */}
      {serverError && (
        <div
          role="alert"
          className="rounded-md bg-status-danger-subtle border border-status-danger/40 px-4 py-3 text-sm text-status-danger"
        >
          {serverError}
        </div>
      )}

      {/* ── Location ─────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="location_id" className={labelClass}>
          Location{reqMark}
        </label>
        <select
          id="location_id"
          name="location_id"
          required
          defaultValue={defaultValues.location_id ?? ''}
          className={inputBase}
          aria-invalid="false"
          aria-required="true"
          onBlur={onBlurSync}
          onChange={onInputRecheck}
        >
          <option value="">— select a location —</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Kind ─────────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="kind" className={labelClass}>
          Kind{reqMark}
        </label>
        <select
          id="kind"
          name="kind"
          required
          defaultValue={defaultValues.kind ?? ''}
          className={inputBase}
          aria-invalid="false"
          aria-required="true"
          aria-describedby="kind-hint"
          onBlur={onBlurSync}
          onChange={onInputRecheck}
        >
          <option value="">— select type —</option>
          <option value="open">Open — no restriction</option>
          <option value="restricted">Restricted — limited access or activities</option>
          <option value="closed">Closed — temporarily unavailable</option>
          <option value="closed_indefinite">Closed indefinitely</option>
        </select>
        <p id="kind-hint" className={hintClass}>
          &ldquo;Restricted&rdquo; degrades status to caution. &ldquo;Closed&rdquo; or &ldquo;Closed indefinitely&rdquo;
          overrides all conditions to closed.
        </p>
      </div>

      {/* ── Affects ──────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="affects" className={labelClass}>
          Affects
        </label>
        <input
          type="text"
          id="affects"
          name="affects"
          defaultValue={defaultValues.affects ?? ''}
          placeholder="e.g. Boat launch, North access trail"
          className={inputBase}
          aria-describedby="affects-hint"
          onBlur={onBlurSync}
          onInput={onInputRecheck}
        />
        <p id="affects-hint" className={hintClass}>
          Specific area or feature affected. Leave blank if the entire location is impacted.
        </p>
      </div>

      {/* ── Reason ───────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="reason" className={labelClass}>
          Reason{reqMark}
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          defaultValue={defaultValues.reason ?? ''}
          placeholder="Brief description shown to users"
          className={`${inputBase} resize-y`}
          aria-invalid="false"
          aria-required="true"
          onBlur={onBlurSync}
          onInput={onInputRecheck}
        />
      </div>

      {/* ── Source ───────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="source" className={labelClass}>
          Source{reqMark}
        </label>
        <input
          type="text"
          id="source"
          name="source"
          required
          defaultValue={defaultValues.source ?? ''}
          placeholder="e.g. Richmond Parks & Recreation"
          className={inputBase}
          aria-invalid="false"
          aria-required="true"
          aria-describedby="source-hint"
          onBlur={onBlurSync}
          onInput={onInputRecheck}
        />
        <p id="source-hint" className={hintClass}>
          Official body or publication that reported this closure.
        </p>
      </div>

      {/* ── Source URL ───────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="source_url" className={labelClass}>
          Source URL
        </label>
        <input
          type="url"
          id="source_url"
          name="source_url"
          defaultValue={defaultValues.source_url ?? ''}
          placeholder="https://…"
          className={inputBase}
          aria-invalid="false"
          onBlur={onBlurSync}
          onInput={onInputRecheck}
        />
      </div>

      {/* ── Date range ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="effective_from" className={labelClass}>
            Effective from
          </label>
          <input
            type="datetime-local"
            id="effective_from"
            name="effective_from"
            defaultValue={
              toDatetimeLocal(defaultValues.effective_from) ||
              toDatetimeLocal(new Date().toISOString())
            }
            className={inputBase}
            onBlur={onBlurSync}
            onInput={onInputRecheck}
          />
        </div>
        <div>
          <label htmlFor="effective_to" className={labelClass}>
            Effective to
          </label>
          <input
            type="datetime-local"
            id="effective_to"
            name="effective_to"
            defaultValue={toDatetimeLocal(defaultValues.effective_to)}
            className={inputBase}
            aria-describedby="effective_to-hint"
            onBlur={onBlurSync}
            onInput={onInputRecheck}
          />
          <p id="effective_to-hint" className={hintClass}>
            Leave blank for open-ended.
          </p>
        </div>
      </div>

      {/* ── Next review date ─────────────────────────────────────────────── */}
      <div>
        <label htmlFor="next_review_at" className={labelClass}>
          Next review date
        </label>
        <input
          type="date"
          id="next_review_at"
          name="next_review_at"
          defaultValue={toDateOnly(defaultValues.next_review_at)}
          className={inputBase}
          aria-describedby="next_review_at-hint"
          onBlur={onBlurSync}
          onInput={onInputRecheck}
        />
        <p id="next_review_at-hint" className={hintClass}>
          Optional reminder to re-evaluate this closure.
        </p>
      </div>

      {/* ── Form actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-rva-navy text-white text-sm font-medium px-4 py-2 hover:bg-rva-blue disabled:opacity-60 transition-colors min-h-[2.75rem]"
        >
          {isPending ? 'Saving…' : saveLabel}
        </button>

        {approveDraftAction && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleApprove}
            className="inline-flex items-center gap-2 rounded-md bg-status-safe-fg text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-60 transition-colors min-h-[2.75rem]"
          >
            ✓ Approve &amp; publish
          </button>
        )}

        {discardDraftAction && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleDiscard}
            className="inline-flex items-center gap-2 rounded-md border border-status-danger text-status-danger text-sm font-medium px-4 py-2 hover:bg-status-danger-subtle disabled:opacity-60 transition-colors min-h-[2.75rem]"
          >
            Discard draft
          </button>
        )}

        <Link
          href="/admin/closures"
          className="text-sm text-text-secondary hover:text-text underline min-h-[2.75rem] inline-flex items-center"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
