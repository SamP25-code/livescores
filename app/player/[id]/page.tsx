"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { loadPlayer, type PlayerPage } from "@/lib/playerData";
import { clubPath, competitionPath, organiserPill } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import CompetitionRow from "@/components/home/CompetitionRow";
import RowLine from "@/components/home/RowLine";
import PlayerLinks from "@/components/PlayerLinks";

const RESULT: Record<string, string> = { won: "Won", lost: "Lost", walkover: "Walkover", live: "Live", upcoming: "To play" };

// A player's own page: what they've won, then every competition they've
// entered - newest first - with each match they've played or have to come
export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [page, setPage] = useState<PlayerPage | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPlayer(id)
      .then((result) => {
        if (cancelled) return;
        // The same person under another record now: open theirs
        if (result && "mergedInto" in result) router.replace(`/player/${result.mergedInto}`);
        else setPage(result);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const person = page?.person;
  const record = page?.record;
  const club = person?.club ? clubPath(person.club) : null;

  return (
    <PublicPage title={person?.full_name ?? "Player"} loading={page === undefined} failed={failed} back="/players">
      {page === null && <p className="quiet-line">Nothing at this address</p>}
      {person && record && page && (
        <>
          <p className="player-meta">
            {person.club &&
              (club ? (
                <Link href={club} className="info-pill info-pill-club">
                  {person.club.short_name}
                </Link>
              ) : (
                <span className="info-pill info-pill-club">{person.club.short_name}</span>
              ))}
            <span>
              {[
                person.note,
                `${record.played} match${record.played === 1 ? "" : "es"} played`,
                record.played > 0 ? `${record.won} won` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>

          {record.titles.length > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h2>Honours</h2>
              </div>
              <div className="card home-rows">
                {record.titles.map((t, i) => {
                  // Opens that year's results only when they're on the site
                  const comp = t.href ? page.all.find((c) => c.id === t.href) : undefined;
                  return (
                    <CompetitionRow
                      key={i}
                      date={false}
                      title={`${t.name} ${t.year}`}
                      href={comp ? competitionPath(comp, page.all) : undefined}
                      line={
                        <>
                          <strong className={t.place === "Winner" ? "home-row-champion" : undefined}>{t.place}</strong>
                          {t.partner ? ` · with ${t.partner}` : ""}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}

          <section className="home-section">
            <div className="home-section-head">
              <h2>Competitions</h2>
            </div>
            {record.competitions.length === 0 && <p className="quiet-line">No competitions yet</p>}
            {record.competitions.map((c) => (
              <div key={c.competition.id} className="card home-rows player-comp">
                <CompetitionRow
                  date={c.state.date}
                  title={`${c.competition.name} ${c.competition.year}`}
                  href={competitionPath(c.competition, page.all)}
                  pill={organiserPill(c.competition, page.all)}
                  line={
                    <>
                      {c.partner ? `With ${c.partner} · ` : ""}
                      {c.finish ? <strong className="home-row-champion">{c.finish}</strong> : <RowLine competition={c.competition} state={c.state} />}
                    </>
                  }
                />
                {c.matches.length > 0 && (
                  <ul className="player-matches">
                    {c.matches.map((m) => (
                      // The row opens the session; the opponent's name opens their page
                      <li key={m.id} className={`player-match player-match-${m.result}`}>
                        <Link href={`/night/${m.session.id}`} className="player-match-round">
                          {m.round}
                        </Link>
                        <span className="player-match-who">
                          v <PlayerLinks name={m.opponent} ids={m.opponentIds} className="" />
                        </span>
                        <span className="player-match-score">
                          {m.result === "upcoming" || m.result === "walkover" ? "" : `${m.mine}–${m.theirs} `}
                          <strong>{RESULT[m.result]}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </PublicPage>
  );
}
