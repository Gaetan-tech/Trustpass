// Génère une "affiche" déterministe (dégradé + emoji) à partir d'une chaîne,
// pour donner un visuel concert sans dépendre d'images externes.
const GRADIENTS: [string, string][] = [
  ['#ff2d95', '#7c3aed'],
  ['#7c3aed', '#22d3ee'],
  ['#22d3ee', '#a3ff12'],
  ['#f97316', '#ff2d95'],
  ['#8b5cf6', '#ec4899'],
  ['#06b6d4', '#3b82f6'],
];

const EMOJIS = ['🎸', '🎤', '🎧', '🥁', '🎹', '🎺', '✨', '🔥', '🌟', '💫'];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function posterFor(seed: string): { from: string; to: string; emoji: string; gradient: string } {
  const h = hash(seed);
  const [from, to] = GRADIENTS[h % GRADIENTS.length]!;
  const emoji = EMOJIS[h % EMOJIS.length]!;
  return { from, to, emoji, gradient: `linear-gradient(135deg, ${from}, ${to})` };
}
