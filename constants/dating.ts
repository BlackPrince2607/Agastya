export type DatingProfile = {
  id: string;
  name: string;
  archetype: string;
  vibe: string;
  traits: string[];
  accent: string;
};

export const DATING_PROFILES: DatingProfile[] = [
  {
    id: 'luna',
    name: 'Luna',
    archetype: 'The Dreamweaver',
    vibe: 'Soft intuition, bold honesty when it counts.',
    traits: ['Creative', 'Empathic', 'Playful'],
    accent: '#e879f9',
  },
  {
    id: 'orion',
    name: 'Orion',
    archetype: 'The Steady Flame',
    vibe: 'Grounded presence with a quiet sense of adventure.',
    traits: ['Loyal', 'Curious', 'Grounded'],
    accent: '#38bdf8',
  },
  {
    id: 'mira',
    name: 'Mira',
    archetype: 'The Visionary',
    vibe: 'Big-picture thinker who still shows up in small moments.',
    traits: ['Independent', 'Warm', 'Driven'],
    accent: '#a78bfa',
  },
  {
    id: 'kai',
    name: 'Kai',
    archetype: 'The Magnetic Poet',
    vibe: 'Words first, walls second—connection over performance.',
    traits: ['Expressive', 'Romantic', 'Reflective'],
    accent: '#f472b6',
  },
];
