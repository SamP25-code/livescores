"use client";

import { use, useEffect, useState } from "react";
import PlayerName from "@/components/PlayerName";
import PublicFooter from "@/components/PublicFooter";
import { longDate } from "@/lib/competitionSetup";
import { STAGE_LABEL } from "@/lib/qualifying";
import { loadQualifierResults, type QualifierResults } from "@/lib/publicQualifying";
import { SITE_NAME } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

// The results of a qualifying competition that isn't run on this site, as
// entered by the organiser: its final (and semi-finals, quarter-finals if
// recorded), and who it sent through.
export default function QualifierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<QualifierResults | null | undefined>(undefined);

  useEffect(() => {
    loadQualifierResults(id)
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  useEffect(() => {
    document.title = data ? `${data.name} · ${SITE_NAME}` : SITE_NAME;
  }, [data]);

  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader compact />
      {data === undefined && <p className="night-header-hint">Loading&hellip;</p>}
      {data === null && <p className="night-header-hint">There&rsquo;s nothing at this address.</p>}
      {data && (
        <>
          <header className="comp-page-head">
            <h1 className="comp-page-title">{data.name}</h1>
            <p className="comp-page-by">
              {[data.location, data.finalDate ? `Final ${longDate(data.finalDate)}` : null].filter(Boolean).join(" · ")}
            </p>
          </header>
          {data.winner && (
            <div className="champion-banner">
              <PlayerName name={data.winner} />
              <span className="hint">
                Winner{data.qualifiesFor ? ` - qualifies for the ${data.qualifiesFor.title}` : ""}
              </span>
            </div>
          )}
          {data.stages.map((st) => (
            <section key={st.stage}>
              <div className="round-heading">
                <h2>{STAGE_LABEL[st.stage]}</h2>
              </div>
              <div className="draw-sheet">
                {st.matches.map((m, i) => (
                  <div key={i} className="card match complete">
                    <div className="players">
                      <div className={`player-row ${m.aWon ? "winner" : ""}`}>
                        <span className="name-cell">
                          <PlayerName name={m.a} />
                        </span>
                        <span className="score">{m.sa ?? "–"}</span>
                      </div>
                      <hr className="divider" />
                      <div className={`player-row ${m.bWon ? "winner" : ""}`}>
                        <span className="name-cell">
                          <PlayerName name={m.b} />
                        </span>
                        <span className="score">{m.sb ?? "–"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {!data.winner && data.stages.length === 0 && (
            <p className="night-header-hint">No results yet{data.finalDate ? ` - the final is on ${longDate(data.finalDate)}` : ""}.</p>
          )}
        </>
      )}
      <PublicFooter />
    </div>
  );
}
