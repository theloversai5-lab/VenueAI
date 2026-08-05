// Renders a normalized bounding box (0..1 x/y/width/height) as a visual
// "crop" of a full image using CSS background-size/position percentages —
// no server-side image cropping/storage needed. Standard CSS sprite-crop
// math: percentage background-position aligns that percentage point of the
// (now-scaled-up) image to that percentage point of the container.
export function cssCropStyle(box: { x: number; y: number; width: number; height: number }, imageUrl: string) {
  const w = Math.max(box.width, 0.01);
  const h = Math.max(box.height, 0.01);
  const posX = w >= 0.999 ? 0 : (box.x / (1 - w)) * 100;
  const posY = h >= 0.999 ? 0 : (box.y / (1 - h)) * 100;

  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${(1 / w) * 100}% ${(1 / h) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundRepeat: "no-repeat",
  } as const;
}
