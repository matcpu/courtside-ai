"use client";
import {
  defaultSportRules,
  sportProfiles,
  type Sport,
  type SportRules,
} from "@/lib/sports";

export function SportRulesFields({
  sport,
  rules,
  onChange,
  disabled = false,
}: {
  sport: Sport;
  rules: SportRules;
  onChange: (sport: Sport, rules: SportRules) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="sport-rule-fields" disabled={disabled}>
      <legend>Sport & competition rules</legend>
      <p className="small-muted">
        Choose a league policy. Rules lock after schedule publication or
        official results; a different sport needs a fresh league once teams
        register.
      </p>
      <div className="two-fields">
        <label className="field">
          <span>Sport</span>
          <select
            aria-label="Sport"
            value={sport}
            onChange={(e) => {
              const next = e.target.value as Sport;
              onChange(next, defaultSportRules(next));
            }}
          >
            {Object.entries(sportProfiles).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["winPoints", "Win points"],
            ["drawPoints", "Draw points"],
            ["lossPoints", "Regulation loss points"],
            ["overtimeLossPoints", "Overtime / shootout loss points"],
            ["maxScore", "Maximum team score"],
            ["gameMinutes", "Game slot minutes"],
            ["restMinutes", "Minimum team rest minutes"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              aria-label={label}
              type="number"
              value={rules[key]}
              min={key === "gameMinutes" ? 15 : key === "maxScore" ? 1 : 0}
              max={
                key === "maxScore" ? 300 : key.endsWith("Minutes") ? 240 : 10
              }
              onChange={(e) =>
                onChange(sport, { ...rules, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        <label className="field">
          <span>Standings tiebreaker after points</span>
          <select
            aria-label="Standings tiebreaker after points"
            value={rules.tieBreak}
            onChange={(e) =>
              onChange(sport, {
                ...rules,
                tieBreak: e.target.value as SportRules["tieBreak"],
              })
            }
          >
            <option value="differential">
              Score differential, then team name
            </option>
            <option value="wins">
              Wins, then differential, then team name
            </option>
          </select>
        </label>
      </div>
      {(
        [
          ["allowDraws", "Allow regulation draws"],
          ["allowOvertime", "Allow overtime"],
          ["allowShootout", "Allow shootouts (hockey)"],
        ] as const
      )
        .filter(([key]) => sport === "hockey" || key !== "allowShootout")
        .map(([key, label]) => (
          <label className="checkbox-row" key={key}>
            <input
              type="checkbox"
              checked={rules[key]}
              onChange={(e) =>
                onChange(sport, { ...rules, [key]: e.target.checked })
              }
            />
            {label}
          </label>
        ))}
      {sport === "hockey" && (
        <p className="small-muted">
          Hockey supports manual team scores and regulation, overtime or
          shootout decisions. A shootout winner’s final score must include the
          deciding goal. Player statistics, automatic placement and AI
          operations are not yet supported for hockey.
        </p>
      )}
    </fieldset>
  );
}
