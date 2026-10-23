"use client";

import { notFound } from "next/navigation";
import { SHOW_PRIVACY, SITE_NAME } from "@/lib/site";
import PublicPage from "@/components/PublicPage";

// The privacy notice, in plain words. Names are public on this site, so it
// says what's shown, what isn't kept, and how to have a name taken off.
export default function PrivacyPage() {
  // Kept but not shown for now (lib/site.ts)
  if (!SHOW_PRIVACY) notFound();
  return (
    <PublicPage title="Privacy" loading={false} failed={false}>
      <article className="card prose">
        <p className="prose-lead">
          {SITE_NAME} shows live scores and results from crown green bowls competitions, so that players, families and
          friends can follow them. Here&rsquo;s what that means for your information.
        </p>

        <h2>What&rsquo;s shown to everyone</h2>
        <ul>
          <li>The names of players entered in a competition, and their doubles partners.</li>
          <li>
            A player&rsquo;s club, or a short note such as &ldquo;Snr&rdquo;, only where it&rsquo;s needed to tell two
            people with the same name apart.
          </li>
          <li>Draws, scores, results, champions and each competition&rsquo;s honours board, including past years.</li>
        </ul>
        <p>Anyone can see these without signing in - that&rsquo;s the point of the site.</p>

        <h2>What we don&rsquo;t keep</h2>
        <ul>
          <li>No dates of birth, addresses or phone numbers for players.</li>
          <li>No adverts, no tracking cookies, and nothing is sold or passed on.</li>
          <li>Spectators never need an account.</li>
        </ul>

        <h2>Counting who&rsquo;s watching</h2>
        <p>
          To show &ldquo;watching now&rdquo; and how many followed a competition, your phone or computer is given a
          random number that it keeps. It doesn&rsquo;t say who you are, and only totals are ever shared (for example
          with a competition&rsquo;s sponsors).
        </p>

        <h2>Organisers and scorers</h2>
        <p>
          People who run or score a competition sign in with their name or email address and a password. The site keeps
          a record of important changes - who made a draw, corrected a result or replaced a player, and when - so
          there&rsquo;s never an argument about it afterwards. A scorer&rsquo;s phone may hold scores for a short time
          while it has no signal, until they&rsquo;re sent.
        </p>

        <h2>When something goes wrong</h2>
        <p>
          If the site hits an error, a report of what went wrong (the page and the type of browser) may be sent so it can
          be fixed. It doesn&rsquo;t include your name.
        </p>

        <h2>Where it&rsquo;s kept</h2>
        <p>The site runs on Vercel, and its information is stored with Supabase, both well-known hosting services.</p>

        <h2>Taking your name off</h2>
        <p>
          If you&rsquo;d rather your name wasn&rsquo;t shown, ask the organiser of your competition. Your name is then
          replaced with &ldquo;Withdrawn player&rdquo; everywhere on the site. Results stay as they were, so draws
          still make sense for everyone else.
        </p>

        <h2>Junior players</h2>
        <p>Players under 18 are only shown by name with the agreement of their club.</p>
      </article>
    </PublicPage>
  );
}
