"use client";

import { useState } from "react";

// "Share results": on a phone, the phone's own share menu (WhatsApp,
// Facebook, Messages...); on a computer, the text copied ready to paste
export default function ShareButton({ label = "Share results", title, text }: { label?: string; title: string; text: () => string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const body = text();
    try {
      if (navigator.share) {
        await navigator.share({ title, text: body });
        return;
      }
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // Cancelled, or the phone wouldn't share - nothing to do
    }
  }

  return (
    <p className="share-results">
      <button type="button" className="secondary" onClick={share}>
        {label}
      </button>
      {copied && <span className="share-results-done">Copied - paste it into WhatsApp or Facebook</span>}
    </p>
  );
}
