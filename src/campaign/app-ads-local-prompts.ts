import { ProjectBrief } from "../scanner/project-scanner.js";

export const APP_ADS_SHOTS: Array<{
  role: string;
  headline: string;
  subtitle: string;
  scene: string;
  camera: string;
  action: string;
}> = [
  {
    role: "shot-01-roster-pressure",
    headline: "Roster pressure on the counter.",
    subtitle: "Messy paper shifts before the phone enters.",
    scene: "A faceless restaurant operator looks at messy paper rosters beside a cafe counter and POS terminal.",
    camera: "top-down medium shot with phone visible near the papers",
    action: "the hand reaches toward the phone to start resolving the schedule"
  },
  {
    role: "shot-02-phone-pickup",
    headline: "Pick up the phone.",
    subtitle: "The green screen plane is clean and trackable.",
    scene: "A phone sits on a restaurant service counter near order tickets, a coffee cup, and apron/staff cues.",
    camera: "close three-quarter angle",
    action: "one hand picks up the phone while keeping the green screen facing camera"
  },
  {
    role: "shot-03-shift-planning",
    headline: "Plan a shift.",
    subtitle: "One simple tap or drag gesture.",
    scene: "Hands hold the phone above a wooden cafe counter with blurred hospitality background.",
    camera: "tight phone close-up",
    action: "one finger performs a short drag near the screen edge without covering the green rectangle"
  },
  {
    role: "shot-04-staff-review",
    headline: "Review staff.",
    subtitle: "Manager checks the phone in context.",
    scene: "Faceless operator in apron reviews the phone near a staff schedule clipboard.",
    camera: "over-the-shoulder phone framing with no face",
    action: "the operator points beside the phone while the screen plane stays visible"
  },
  {
    role: "shot-05-shift-request",
    headline: "Shift request arrives.",
    subtitle: "Notification beat without fake UI.",
    scene: "Phone on restaurant counter near a small service bell and order slips.",
    camera: "medium close-up",
    action: "a simple drawn arrow suggests an incoming request while the phone screen remains plain green"
  },
  {
    role: "shot-06-approval-tap",
    headline: "Approve the change.",
    subtitle: "One decisive tap.",
    scene: "Hand holds phone near the restaurant pass with warm background lights.",
    camera: "macro phone-hand shot",
    action: "thumb taps near the lower screen edge while avoiding the central green tracking area"
  },
  {
    role: "shot-07-team-notified",
    headline: "Team is notified.",
    subtitle: "Small phone icons around the main phone.",
    scene: "Main phone on counter with simple sketch phone icons around it to imply staff updates.",
    camera: "centered medium shot",
    action: "arrows radiate from the green-screen phone to the small phone icons"
  },
  {
    role: "shot-08-clock-in",
    headline: "Clock-in moment.",
    subtitle: "Venue doorway and attendance cue.",
    scene: "Phone near a cafe entrance or staff doorway with a small clock icon nearby.",
    camera: "vertical phone insert shot",
    action: "finger taps beside the green card as a simple downward arrow implies time capture"
  },
  {
    role: "shot-09-hours-review",
    headline: "Review worked hours.",
    subtitle: "Paper confusion becomes organized.",
    scene: "Phone rests between two paper timesheets on a restaurant desk corner, no office computer.",
    camera: "top-down close-up",
    action: "arrows connect messy papers to the green-screen phone"
  },
  {
    role: "shot-10-payroll-report",
    headline: "Payroll-ready report.",
    subtitle: "Outcome without showing UI.",
    scene: "Phone stands beside a clean report icon and a stack of paper records on a service counter.",
    camera: "straight-on product-style reference shot",
    action: "arrow flows from papers through the phone to the report icon"
  },
  {
    role: "shot-11-multi-location",
    headline: "Multiple venues controlled.",
    subtitle: "Venue icons around phone.",
    scene: "Phone centered with simple cafe, restaurant, and venue icons around it.",
    camera: "centered reference composition",
    action: "arrows point from venue icons into the green-screen phone"
  },
  {
    role: "shot-12-final-outcome",
    headline: "Confident final phone shot.",
    subtitle: "Clean end frame for overlay.",
    scene: "Hand holds phone confidently at a warm cafe counter with hospitality background cues.",
    camera: "steady vertical hero close-up",
    action: "phone is held still with the full green screen rectangle visible for final compositing"
  }
];

export function buildAppAdsPrompt(brief: ProjectBrief, role: string): string {
  const shot = APP_ADS_SHOTS.find((item) => item.role === role) ?? APP_ADS_SHOTS[0];
  return [
    "Create one portrait 2:3 single-shot video reference for a restaurant/hospitality mobile app ad.",
    "This must be one shot only, not a storyboard sheet, not a grid, not a collage, and not multiple panels.",
    "Do not use or redraw app screenshots. Real app screenshots are reserved for post-production compositing only.",
    "Draw a smartphone with the entire display covered by a flat matte chroma-green physical tracking card or sticker. It is not a powered-on display.",
    "No phone operating system, no app interface, no icons, no settings screen, no control center, no readable text, no buttons, no charts, no rows, no cards, no fake UI.",
    "Keep fingers outside the green rectangle as much as possible so the full screen plane stays visible and trackable.",
    "Use non-photoreal scratch reference style: pencil/ink production sketch, off-white paper, simple action arrows, clear phone geometry.",
    "No real people or photoreal humans. No faces, eyes, skin texture, portrait photography, realistic bodies, or identifiable person. Use simplified line-art hands or faceless operator silhouettes only.",
    "Hospitality setting only: cafe counter, restaurant pass, POS terminal, apron/staff cue, stainless prep counter, wooden service counter, warm practical lighting. Avoid office desk, computer monitor, keyboard, and mouse.",
    `Audience context: ${brief.audience}.`,
    `Shot role: ${shot.headline}.`,
    `[PANEL SEQUENCE] 1. ${shot.scene} Camera: ${shot.camera}. Action: ${shot.action}. Screen: chroma-green tracking card stays plain and fully visible.`,
    "[DETAIL] Make this useful as a single Seedance image reference for a 2-4 second live-action plate. No subtitles, no watermark, no marketing copy, no brand title."
  ].join(" ");
}
