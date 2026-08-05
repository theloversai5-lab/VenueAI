export const COMPONENT_CATEGORIES = [
  "flowers",
  "lighting",
  "fabric",
  "furniture",
  "pillar",
  "signage",
  "bar",
  "table",
  "chair",
  "ceiling",
  "other",
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];
