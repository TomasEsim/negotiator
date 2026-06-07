"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/components/ui";

export function CopyButton({
  text,
  html,
  label = "Copy",
  className,
}: {
  text: string;
  /** Optional rich HTML — when present, copies both text/html and text/plain so it
   *  pastes formatted (tables, bold) into Gmail/Slack and as plain text elsewhere. */
  html?: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function doCopy() {
    try {
      const ClipItem = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (html && ClipItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard blocked; ignore */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={doCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden /> {label}
        </>
      )}
    </button>
  );
}
