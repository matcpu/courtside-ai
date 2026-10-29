# Final three-minute recording workflow

Canonical timing and actions are in [submission/recording-plan.json](submission/recording-plan.json). Spoken copy is in [DEMO_NARRATION.md](DEMO_NARRATION.md). The current final-recording gate is **blocked by the pending human result decision and unrun operations stage**, not by email or deferred production features.

## Prepare capture

1. Validate the plan with `node scripts/recording-preflight.mjs`. After the real-model run, use `--check-evidence`; it performs authenticated reads only and refuses readiness without all three genuine receipts and a passed two-stage journal.
2. Use a clean 1920×1080 desktop scene at 30 fps, with the guardian form shown in a 390×844 mobile viewport. Sign in **before** capturing. Keep passwords, URL fragments, environment files, mailboxes and unrelated tabs out of the capture. Disable desktop notification overlays for the recording.
3. Keep the public reference open signed out. Use separate normal browser contexts for the private administrator, coach and guardian. The private packet supplies credentials; no new signup or email is needed.
4. Verify the upcoming-season questionnaire is submitted, the real synthetic scoresheet file is uploaded to its matching past fixture, the guardian link is fresh and court blocks remain available. Run the paused preflight; do not toggle Meta merely to rehearse screens.
5. Prepare the guardian/reviewer clip in the upcoming season: open the fresh link in its separate context, confirm **Fictional Demo Player**, enter **Fictional Demo Guardian**, select **Parent** and the accepted proof type, upload `.local/demo-guardian-proof.png`, confirm details/consent and choose **Submit proof and guardian consent**. As administrator, open the original proof from the preseason queue, inspect the visibly synthetic record, record a reasoned reviewer decision and show the resulting history/progress. These are human verification actions in a fictional test, never Meta output. Do not show the invitation URL. Placement approval is also an explicit administrator decision after inspecting its assessment/interpretation; explain any override.

## Actual Meta run — owner authorization required first

The entire sequence allows **at most eight provider requests**: one questionnaire request, one vision request and up to six agent continuation turns. Output ceilings are 4,000 + 4,000 + 6×2,500 = **23,000 output tokens**. Input/image usage is separate; reasoning is included in provider output, so this is not a dollar-cost guarantee or a global account spend cap. There are **zero transport retries**. A durable per-feature marker is written before dispatch; a timeout/crash is an uncertain outcome to inspect, never permission to repeat a paid job.

1. After the owner confirms credits and explicitly authorizes that bounded use, deliberately enable only the intended configuration. No script redeems credits, changes billing or enables inference automatically.
2. Run `node scripts/verify-meta-live.mjs --credits-confirmed --stage perception`. It calls questionnaire interpretation and vision once, saves their actual outputs before evaluating quality, verifies their provider receipts, then **stops**. Capture the questionnaire interpretation/receipt and original-image/extraction screens.
3. As administrator, open **Scoresheets → Review original**, compare the actual image/extraction, check the human-review acknowledgment and click **Confirm official result**. Record this genuine human action and its standings effect. Do not run operations until it succeeds. The validator does not approve the result for you.
4. Run `node scripts/verify-meta-live.mjs --credits-confirmed --stage operations`. It refuses an unconfirmed/manual-substitute result, then permits one bounded agent run. Require successful actual inspection/history/readiness/proposal/draft outcomes and newly saved pending records. Save the actual trace, answer, IDs and receipts; do not claim an unsuccessful tool completed its task.
5. Disable inference again, apply that configuration, and **reload every recording browser context** before retakes or human schedule regeneration. Verify `/api/health` reports `meta:false` and run `node scripts/recording-preflight.mjs --check-evidence`; it blocks capture if inference is still enabled. The schedule UI has an optional Meta explanation path when its connection state is enabled, so do not click **Generate next round** with stale/enabled connection state. With a freshly loaded paused state, the redraft is deterministic and adds no ninth model call. Saved Meta activity remains inspectable. Further model usage needs separate explicit owner authorization and an explicitly fresh fixture; never delete attempt markers to bypass the guard.

This ordering avoids stale evidence: confirming a result **after** the agent runs invalidates its competitive proposals and schedule draft. Do not make another result/roster/court change between the operations run and its recorded human decisions.

## Capture all seven chapters

| Time | Required screen/action | Capture check |
|---|---|---|
| 0:00–0:18 | Signed-out public Overview/View schedule, then private upcoming-season dashboard | Public access works without signup; identify two separate synthetic private seasons |
| 0:18–0:45 | Submitted coach assessment and administrator's actual placement receipt | Contradictions, explanation, uncertainty, provider ID; rubric and approval authority stay distinct |
| 0:45–1:00 | Guardian mobile form/submission and administrator review/readiness queue | Synthetic proof only; no invitation URL or sensitive identifiers visible; brief local consistency/reuse warnings with authenticity explicitly unverified; no claim Meta verifies documents |
| 1:00–1:32 | Private historical original image/extraction/vision receipt, then the previously captured human confirmation | Actual image facts; unrecorded stats remain empty; human action precedes agent work |
| 1:32–2:25 | Actual timestamped agent trace, model reply and pending proposal/draft | All five successful selected tools, arguments/outcomes and resulting record IDs; label cached authorized run honestly |
| 2:25–2:48 | Administrator approves the actual move, regenerates deterministically, reviews and publishes; coach opens in-app update | First agent draft used old approved divisions. Regenerate after approval. Publication is a separate human action |
| 2:48–3:00 | Private published fixtures and actual response/action receipts | End on the private season. Do not publish or mutate the original public reference to obtain a closing shot |

Record clips in the real action order, then edit them into this timeline. A retake may show saved state with its actual timestamp; it must not recreate a model response or imply a cached run is a new instant inference. If an important action is missed, disclose the saved outcome or prepare a separate authorized fresh run; do not fake a click or fabricate a success overlay.

## Export and inspect

- Export a readable 16:9 MP4 using H.264 and narration/captions. Keep the full duration at or below 180 seconds, including title/end cards. Review the entire exported file, not only the editing timeline.
- Verify the source image, response IDs, tool outcomes and final schedule are legible at normal playback. Match narration to actual observed outputs and disclose the private historical seed as fictional input.
- Check every frame containing a browser address bar, login, guardian form or settings for tokens/passwords/private contact details. Keep raw captures and evidence reports private; publish only the reviewed final export.
- Open the final video URL signed out to verify access and sound. Put that actual accessible URL in the official **3-Minute Demo Video** field. No placeholder video URL, public login credential or final submission should be invented.
- Restricted email testing is complete for the hackathon. Use the coach's in-app update in this video; do not reopen domain setup or send more email to obtain footage.

Two actual perception receipts exist; no final video/export is claimed. The operations chapter remains blocked on explicit human result confirmation and the remaining authorized agent run. Keep final video publication and entry submission pending owner approval. See META_VERIFICATION.md; do not repeat perception.
