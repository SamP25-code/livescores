import PlayerLinks from "@/components/PlayerLinks";
import { sessionLabel, sessionTimes, type PublicCompetition, type RowState } from "@/lib/publicCompetitions";
import LivePill from "@/components/home/LivePill";

// The line under a competition's name in any list: "Live · Round of 16",
// "Qualifying session 1 of 4 · 6:30pm", "Won by Wayne Ditchfield"
export default function RowLine({ competition: c, state }: { competition: PublicCompetition; state: RowState }) {
  if (state.kind === "live") {
    return (
      <>
        <LivePill />{" "}
        {sessionLabel(c, state.session)}
      </>
    );
  }
  if (state.kind === "won") {
    return (
      <>
        Won by <PlayerLinks name={state.champion.name} ids={state.champion.winnerIds} className="home-row-champion" />
      </>
    );
  }
  if (state.kind === "next") {
    const start = sessionTimes(state.session)?.replace(/^.*Start /, "");
    return <>{[sessionLabel(c, state.session), start].filter(Boolean).join(" · ")}</>;
  }
  if (state.kind === "played") return <>{sessionLabel(c, state.session)} played</>;
  return <>Dates to be confirmed</>;
}
