"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const SECTIONS: { id: string; title: string; steps: string[] }[] = [
  {
    id: "start",
    title: "Your login",
    steps: [
      "Sign in with the name (or email) and password Sam gave you - the first time, you'll choose your own password.",
      "Your competitions are on the admin home page, each with what needs doing next: entries, the draw, or scoring.",
      "Change your password any time under Settings.",
    ],
  },
  {
    id: "entries",
    title: "Entering players",
    steps: [
      "Open your competition, then the Entries tab.",
      "Start typing a name: everyone already on the site who matches is listed - tap them. Only add someone new if they aren't there.",
      "If you type a name that's already on the site and add it as new, it asks whether it's the same person. Say no only if it really is someone else, and give their club (or a note like \"Snr\").",
      "Doubles: enter both partners together under Enter a pair.",
      "With qualifying sessions, choose the session each entry plays in. Entries can be moved, changed or removed until their session's draw is made.",
    ],
  },
  {
    id: "draw",
    title: "Making the draw",
    steps: [
      "Choose Open the draw on the admin home page (or open the session from the competition's Overview tab) - it has a Set up the draw box.",
      "Draw at random lets the site draw it. Record a physical draw is for when you've drawn numbers from a hat - enter the number each player drew.",
      "One-day competitions: set the start times for the first round so players know when they're on.",
      "Check the draw, then Publish draw. Until it's published, nobody else sees it - you can Redraw or Unpublish if something's wrong.",
    ],
  },
  {
    id: "scorers",
    title: "Giving scorers a login",
    steps: [
      "On the competition's Admins & scorers tab, choose Add a scorer and enter their full name.",
      "Copy name and password, and pass it on - by text or WhatsApp. They choose their own password the first time they sign in.",
      "Scorers can score once the draw is published - nothing else.",
    ],
  },
  {
    id: "scoring",
    title: "Scoring on the day",
    steps: [
      "Open the session (Score now on the admin home page) and find the match.",
      "Live scoring: tap +1 or +2 for the player who scored, and - to undo a mistake. Missed a few ends? Type the score puts the whole score in at once.",
      "When someone reaches the winning score, the match finishes and the winner goes through to their next match by themselves.",
      "Results only: type both scores and Save result.",
      "Poor signal: keep scoring. Every score is kept on the phone and sent as soon as there's signal - even if the page is closed. A bar at the top says when scores are waiting.",
    ],
  },
  {
    id: "problems",
    title: "When something goes wrong",
    steps: [
      "Someone hasn't turned up (first round): open their match and mark that they didn't turn up - their opponent goes through. If they arrive after all, undo it.",
      "A player can't play: Replace puts someone else in their place, before the match starts.",
      "A wrong result: open the finished match and Correct the result. If it changes who won, the next match is changed too.",
      "Rained off: in the session's settings, give it a new date and a reason - the reason is shown publicly. Entries and the draw stay as they are.",
      "Anything else - ring or message Sam.",
    ],
  },
];

// How to run a competition, for club organisers who won't have Sam next to
// them - read here, or printed for the clubhouse
export default function HelpPage() {
  useEffect(() => {
    document.title = `How to run your competition · ${SITE_NAME}`;
  }, []);

  return (
    <div className="page page-photo help-page">
      <h1 className="public-page-title">How to run your competition</h1>
      <p className="quiet-line">The whole job, step by step. Print it for the clubhouse with the button below.</p>

      <nav className="card help-contents" aria-label="Contents">
        {SECTIONS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`}>
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className="card help-section">
          <h2>
            {i + 1}. {s.title}
          </h2>
          <ol>
            {s.steps.map((step, j) => (
              <li key={j}>{step}</li>
            ))}
          </ol>
        </section>
      ))}

      <p className="help-actions">
        <button type="button" className="secondary" onClick={() => window.print()}>
          Print this guide
        </button>
        <Link href="/admin" className="link-button">
          Back to admin
        </Link>
      </p>
    </div>
  );
}
