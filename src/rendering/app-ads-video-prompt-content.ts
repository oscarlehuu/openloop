import type { Slide } from "../campaign/slide-schema.js";

export interface SlidePromptContext {
  slide: Slide;
  imagePath: string;
  contactSheetPath: string;
  projectName: string;
  audience: string;
  summary: string;
  valueProps: string[];
}

export interface PromptDirection {
  usage: string;
  shots: string[];
}

export function storyboardDirection(): PromptDirection {
  return {
    usage:
      "Use the primary image as a non-photoreal 12-panel scratch storyboard sheet for composition only. Convert it into live-action-looking footage. Do not preserve pencil, paper, sketch lines, panel borders, arrows, or storyboard texture in the generated video.",
    shots: [
      "- 0.0-1.2s: Establish the workflow pressure shown in Panel 1: a faceless operator or hands-only setup handling schedule/shift coordination.",
      "- 1.2-2.4s: Move into Panel 2: phone enters frame with a blank screen-replacement plane, not generated app UI.",
      "- 2.4-4.2s: Follow Panels 3-4: close-up interaction, one deliberate tap or swipe, blank screen remains aligned inside the device.",
      "- 4.2-6.4s: Follow Panels 5-6: hold the phone steady enough for post-production app screenshot overlay.",
      "- 6.4-8.6s: Follow Panels 7-8: user checks the outcome and makes one confident next action.",
      "- 8.6-11.0s: Follow Panels 9-10: cut to a practical workplace/team context that shows the workflow becoming calmer.",
      "- 11.0-15.0s: Follow Panels 11-12: end on a clean phone-in-hand result shot with the blank screen still trackable."
    ]
  };
}

export function motionDirection(): PromptDirection {
  return {
    usage:
      "Use the primary image as a non-photoreal 8-panel scratch motion choreography sheet for movement only. Convert it into live-action-looking footage. Do not preserve pencil, paper, sketch lines, arrows, panel borders, or storyboard texture in the generated video.",
    shots: [
      "- 0.0-1.5s: Match Motion 1: a generic live-action hand reaches for the phone or brings it into frame with a natural camera move.",
      "- 1.5-3.0s: Match Motion 2: phone opens with a blank screen-replacement plane, not generated app UI.",
      "- 3.0-4.8s: Match Motions 3-4: a clear thumb tap and short swipe, with stable blank screen geometry.",
      "- 4.8-6.8s: Match Motion 5: hold the screen steady enough for post-production app screenshot overlay.",
      "- 6.8-8.8s: Match Motion 6: user compares or confirms the result, using a small nod or relaxed facial reaction.",
      "- 8.8-11.5s: Match Motion 7: phone moves from close-up to workplace context while the app remains visible.",
      "- 11.5-15.0s: Match Motion 8: finish with a steady confident app-in-hand shot, no added text."
    ]
  };
}

export function formatList(items: string[]): string {
  return items.length ? items.join("; ") : "clear mobile workflow, faster task completion, reliable app outcome";
}

export function panelReference(context: SlidePromptContext): string {
  const prompt = context.slide.imagePrompt.trim();
  const marker = "[PANEL SEQUENCE]";
  const start = prompt.indexOf(marker);
  if (start === -1) return `${context.slide.captionNotes} ${context.slide.visualContinuity}`;

  const endMarkers = ["Camera and styling notes:", "Motion-sheet rules:"];
  const end = endMarkers
    .map((item) => prompt.indexOf(item, start))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  const panelText = promptForScratchReference(prompt.slice(start, end ?? undefined).trim());
  const continuity = promptForScratchReference(context.slide.visualContinuity);
  return [
    "Use the following as a reading guide for the uploaded scratch reference image. Do not ask the video model to render the grid, arrows, panel labels, or sheet layout.",
    "Interpret any operator, manager, owner, staff, hand, or silhouette mark as a placeholder for generic live-action hands or an over-the-shoulder operator in the output. Do not copy drawn silhouettes, mannequin shapes, or sketch hands into the generated video. No identifiable face.",
    "Interpret any app screenshot or UI mention as a screen-replacement target only. Seedance must not redraw app UI, words, numbers, labels, icons, or language.",
    panelText,
    `Continuity note: ${continuity}`
  ].join("\n");
}

function promptForScratchReference(text: string): string {
  return text
    .replace(/\bfaceless manager\b/gi, "faceless operator")
    .replace(/\bfaceless owner\b/gi, "faceless operator")
    .replace(/\brestaurant manager\b/gi, "faceless restaurant-operator sketch")
    .replace(/\bmanager\b/gi, "operator")
    .replace(/\bowner\b/gi, "operator")
    .replace(/\bstaff members\b/gi, "abstract staff icons")
    .replace(/\bstaff member\b/gi, "abstract staff icon")
    .replace(/\buser\b/gi, "operator")
    .replace(/faceless sketch operator/gi, "generic live-action operator")
    .replace(/faceless operator silhouette/gi, "generic live-action operator placeholder")
    .replace(/faceless restaurant-operator sketch/gi, "generic live-action restaurant operator")
    .replace(/faceless operator/gi, "generic live-action operator")
    .replace(/line-art thumb/gi, "live-action thumb")
    .replace(/line-art finger/gi, "live-action finger")
    .replace(/line-art hand/gi, "live-action hand")
    .replace(/line-art ID card\/profile icons/gi, "profile cue icons")
    .replace(/drawn phone/gi, "realistic smartphone")
    .replace(/simple mannequin shape/gi, "non-identifiable live-action body posture")
    .replace(/camera over-shoulder sketch without visible person features/gi, "camera over-the-shoulder live-action framing without a visible face")
    .replace(/external paper form sketch/gi, "external business setup cue")
    .replace(/external side note sketches/gi, "external planning note implies")
    .replace(/traced real QuickShift screenshots/gi, "blank phone screen-replacement planes")
    .replace(/real QuickShift [^.;]+ screenshots?/gi, "blank phone screen-replacement plane")
    .replace(/real [^.;]+ screenshots?/gi, "blank phone screen-replacement plane")
    .replace(/[a-z-]+ related real screenshots?[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/report-like screenshots?[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/account flow screenshots?[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/hero screenshots?[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/traced [^.;]+ \bscreen\b/gi, "blank phone screen-replacement plane")
    .replace(/real [^.;]+ screen variation/gi, "blank phone screen-replacement plane")
    .replace(/real [^.;]+ \bscreen\b/gi, "blank phone screen-replacement plane")
    .replace(/blank phone screen-replacement plane of the [^.;]+ \bscreen\b/gi, "blank phone screen-replacement plane")
    .replace(
      /(roster calendar|calendar week|request|notification|approval|attendance|worked-hours|payroll report|admin overview|reporting|export)[^.;]*\bscreen\b/gi,
      "blank phone screen-replacement plane"
    )
    .replace(/real notification\/request\/approval item/gi, "blank screen-replacement target")
    .replace(/real attendance\/worked-hours\/payroll review screens?/gi, "blank screen-replacement poses")
    .replace(/rostered-hours screen/gi, "blank screen-replacement pose")
    .replace(/one day cell to another/gi, "one blank target area to another")
    .replace(/without changing labels/gi, "without generating labels")
    .replace(/review staff profiles/gi, "review blank workflow cues")
    .replace(/list item/gi, "blank target")
    .replace(/same QuickShift screenshot contact sheet/gi, "same post-production overlay source")
    .replace(/QuickShift screenshot contact sheet/gi, "post-production overlay source")
    .replace(/\b(wireframes?|grids?|rows?|cards?|charts?|bars?|menu lines?|placeholder UI|form fields?)\b/gi, "blank plane")
    .replace(/contact[- ]sheet crop of [^.;]+/gi, "blank phone screen-replacement plane")
    .replace(/full contact[- ]sheet mini montage[^.;]*/gi, "blank screen-replacement workflow montage reserved for post-production overlay")
    .replace(/contact-sheet screen[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/taped screenshot crops?[^.;]*/gi, "blank screen-replacement cards reserved for post-production overlay")
    .replace(/authentic [^.;]+ screen[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/another authentic [^.;]+ screen[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/same QuickShift contact sheet/gi, "same post-production overlay source")
    .replace(/app screenshots?/gi, "post-production overlay source")
    .replace(/showing a real [^.;]+ \bscreen\b/gi, "showing a blank screen-replacement plane")
    .replace(/email, password, restaurant name, timezone, address, phone/gi, "generic signup fields for later overlay")
    .replace(/email, password, restaurant\.name, timezone, address, phone/gi, "generic signup fields for later overlay")
    .replace(/only if planned for post-production overlay, otherwise on [^.;]+/gi, "on the blank screen-replacement plane")
    .replace(/visible in the actual screenshot/gi, "planned for post-production overlay")
    .replace(/visible in the actual UI/gi, "planned for post-production overlay")
    .replace(/visible on the real UI/gi, "planned for post-production overlay")
    .replace(/visible on real UI/gi, "planned for post-production overlay")
    .replace(/visible in screenshot/gi, "planned for post-production overlay")
    .replace(/if present in screenshot[^.;]*/gi, "on the blank screen-replacement plane")
    .replace(/sourced from screenshot/gi, "planned for post-production overlay")
    .replace(/sourced for later source-screenshot overlay/gi, "planned for post-production overlay")
    .replace(/sourced for later post-production overlay/gi, "planned for post-production overlay")
    .replace(/request chip or swap-related area/gi, "planned overlay target area")
    .replace(/pending shift-change item/gi, "planned overlay target area")
    .replace(/publish-related area/gi, "planned overlay target area")
    .replace(/next-step control planned for post-production overlay/gi, "blank screen overlay target")
    .replace(/visible approve or action control on the blank screen-replacement plane/gi, "planned overlay target on the blank screen-replacement plane")
    .replace(/export\/report\/detail affordance planned for post-production overlay/gi, "planned overlay target area")
    .replace(/primary continue\/sign-up area planned for post-production overlay/gi, "planned overlay target area")
    .replace(/shift block position/gi, "blank screen target position")
    .replace(/shift blocks?/gi, "planned overlay target areas")
    .replace(/date\/entry planned for post-production overlay/gi, "planned overlay target area")
    .replace(/attendance or blank phone screen-replacement plane/gi, "blank phone screen-replacement plane")
    .replace(/worked-hours screen/gi, "blank screen-replacement plane")
    .replace(/from blank screen-replacement plane to blank phone screen-replacement plane/gi, "between two blank phone screen-replacement poses")
    .replace(/roster\/schedule view/gi, "planned roster overlay")
    .replace(/report\/export-related view/gi, "planned report overlay")
    .replace(/from contact sheet/gi, "for later source-screenshot overlay")
    .replace(/from the contact sheet/gi, "for later source-screenshot overlay")
    .replace(/source-screenshot overlay/gi, "post-production overlay")
    .replace(/screen-replacement plane\s*shot/gi, "screen-replacement plane")
    .replace(/scratch-paper storyboard aesthetic/gi, "scratch reference sheet for composition only; final output must be live-action-looking")
    .replace(/scratch sketch planning art only/gi, "scratch reference sheet for motion only; final output must be live-action-looking")
    .replace(/scratch-paper style/gi, "same broad planning composition only; final output must be live-action-looking")
    .replace(/traced real QuickShift screenshots only/gi, "blank phone screens reserved for exact screenshot overlay")
    .replace(/Entire sheet visible, portrait 2:3,/gi, "Use the full portrait reference sheet as a plan only; final output is live-action footage,")
    .replace(/no realistic lifestyle scene/gi, "no random unrelated lifestyle footage")
    .replace(/\bsmiling\b/gi, "showing relief through posture")
    .replace(/\bexpression\b/gi, "body-language cue")
    .replace(/\ban blank\b/gi, "a blank");
}
