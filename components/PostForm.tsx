"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { POST_KIND_LABEL, postProblem, uploadEventImage, type EventPost, type PostInput, type PostKind } from "@/lib/postsApi";
import { todayIso } from "@/lib/publicCompetitions";

const KIND_HELP: Record<PostKind, string> = {
  news: "News or an article about the event",
  qualifier: "A qualifier update - links to the place they filled",
  advert: "An advert - a logo or picture, a line of text and a link",
};

// Adding or changing a post on an event's page (Super)
export default function PostForm({
  organiserId,
  year,
  initial,
  qualifiers,
  onSave,
  onCancel,
}: {
  organiserId: string;
  year: number;
  initial?: EventPost;
  // This year's qualifying competitions, for qualifier updates
  qualifiers: { id: string; name: string }[];
  onSave: (input: PostInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<PostKind>(initial?.kind ?? "news");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [image, setImage] = useState<string | null>(initial?.image_url ?? null);
  const [link, setLink] = useState(initial?.link_url ?? "");
  const [qualifier, setQualifier] = useState(initial?.qualifier_event_id ?? "");
  const [showFrom, setShowFrom] = useState(initial?.show_from ?? todayIso());
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      setImage(await uploadEventImage(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function save(published: boolean) {
    const input: PostInput = {
      organiser_id: organiserId,
      year,
      kind,
      title,
      body: body || null,
      image_url: image,
      link_url: link.trim() || null,
      qualifier_event_id: kind === "qualifier" ? qualifier || null : null,
      show_from: showFrom || todayIso(),
      pinned,
      published,
    };
    const problem = postProblem(input);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(input);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const advert = kind === "advert";

  return (
    <div className="card post-form">
      <fieldset className="comp-form-choice">
        <legend>What kind</legend>
        {(Object.keys(POST_KIND_LABEL) as PostKind[]).map((k) => (
          <label key={k}>
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {KIND_HELP[k]}
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="post-title">{advert ? "Advertiser's name" : "Headline"}</label>
        <input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="field">
        <span className="person-picker-label">{advert ? "Logo or picture" : "Picture (optional)"}</span>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="post-form-image" />
        )}
        <div className="person-check-actions">
          <label className="link-button comp-form-logo-pick">
            {uploading ? "Uploading…" : image ? "Change picture" : "Add a picture from your phone or computer"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="visually-hidden"
              disabled={uploading}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {image && (
            <button type="button" className="link-button" onClick={() => setImage(null)}>
              Remove picture
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="post-body">{advert ? "A line of text" : "Words"}</label>
        <textarea
          id="post-body"
          rows={advert ? 2 : 8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={advert ? "Stay for the weekend - 10% off for Masters visitors" : ""}
        />
        {!advert && <p className="hint">A blank line starts a new paragraph.</p>}
      </div>

      {(advert || kind === "news") && (
        <div className="field">
          <label htmlFor="post-link">{advert ? "Their website" : "Link (optional)"}</label>
          <input id="post-link" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
      )}

      {kind === "qualifier" && (
        <div className="field">
          <label htmlFor="post-qualifier">Which qualifying competition</label>
          <select id="post-qualifier" value={qualifier} onChange={(e) => setQualifier(e.target.value)}>
            <option value="">None</option>
            {qualifiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
          <p className="hint">Shows who qualified, and links to its results.</p>
        </div>
      )}

      <div className="comp-form-grid">
        <div className="field">
          <label htmlFor="post-from">Show from</label>
          <input id="post-from" type="date" value={showFrom} onChange={(e) => setShowFrom(e.target.value)} />
        </div>
        <label className="comp-form-check post-form-pin">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to the top
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="person-check-actions">
        <button type="button" disabled={busy || uploading} onClick={() => save(true)}>
          Publish
        </button>
        <button type="button" className="secondary" disabled={busy || uploading} onClick={() => save(false)}>
          Save as a draft
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
