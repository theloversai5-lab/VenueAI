export const AREA_OPTIONS = [
  "entrance",
  "stage",
  "mandap",
  "lounge",
  "bar",
  "dining",
  "ceiling",
  "walkway",
  "other",
] as const;

export type Area = (typeof AREA_OPTIONS)[number];

export const AREA_LABELS: Record<Area, string> = {
  entrance: "Entrance",
  stage: "Stage",
  mandap: "Mandap",
  lounge: "Lounge",
  bar: "Bar",
  dining: "Dining",
  ceiling: "Ceiling",
  walkway: "Walkway",
  other: "Other",
};
