import { dataBoundary } from "./meta";
export const scoresheetInstructions =
  dataBoundary +
  " Read the final result from the scoresheet image. Return exactly the names as visible, final scores, confidence and warnings. If a field is unreadable, return null and explain. Include only explicitly recorded player stats; an empty players array means not recorded. Do not infer missing statistics or use the expected fixture to invent team names.";
export const placementInstructions =
  dataBoundary +
  " Interpret the coach assessment as self-reported preseason evidence. Identify contradictions, implausible combinations, uncertainty and specific follow-up questions. Compare prior league/division context and coach preference with the deterministic rubric. Give an explained suggested tier, but never approve placement or assess an individual child. Your confidence measures evidential support, not verified truth. Only team-level questionnaire fields are provided; never request documents or youth identity data.";
