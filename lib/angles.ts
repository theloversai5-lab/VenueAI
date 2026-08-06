export const ANGLE_OPTIONS = ["front", "aerial", "satellite", "interior", "other"] as const;
export type Angle = (typeof ANGLE_OPTIONS)[number];
