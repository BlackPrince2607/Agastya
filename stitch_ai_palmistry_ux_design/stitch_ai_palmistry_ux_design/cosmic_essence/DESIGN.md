---
name: Cosmic Essence
colors:
  surface: '#141315'
  surface-dim: '#141315'
  surface-bright: '#3b383b'
  surface-container-lowest: '#0f0e10'
  surface-container-low: '#1d1b1e'
  surface-container: '#211f22'
  surface-container-high: '#2b292c'
  surface-container-highest: '#363437'
  on-surface: '#e6e1e5'
  on-surface-variant: '#cbc4ce'
  inverse-surface: '#e6e1e5'
  inverse-on-surface: '#323033'
  outline: '#958f98'
  outline-variant: '#4a454d'
  surface-tint: '#d3beeb'
  primary: '#d3beeb'
  on-primary: '#38294d'
  primary-container: '#1a0b2e'
  on-primary-container: '#88769f'
  inverse-primary: '#68577e'
  secondary: '#cfc1dd'
  on-secondary: '#352c42'
  secondary-container: '#4e455c'
  on-secondary-container: '#c0b3cf'
  tertiary: '#dbc39f'
  on-tertiary: '#3c2e14'
  tertiary-container: '#1c1100'
  on-tertiary-container: '#8f7b5b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eddcff'
  primary-fixed-dim: '#d3beeb'
  on-primary-fixed: '#231437'
  on-primary-fixed-variant: '#4f4065'
  secondary-fixed: '#ebddfa'
  secondary-fixed-dim: '#cfc1dd'
  on-secondary-fixed: '#20182c'
  on-secondary-fixed-variant: '#4c4359'
  tertiary-fixed: '#f8dfb9'
  tertiary-fixed-dim: '#dbc39f'
  on-tertiary-fixed: '#261a03'
  on-tertiary-fixed-variant: '#544429'
  background: '#141315'
  on-background: '#e6e1e5'
  surface-variant: '#363437'
typography:
  headline-xl:
    fontFamily: Noto Serif
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Noto Serif
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 4px
  margin-page: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 48px
---

## Brand & Style

The design system is rooted in the "Mystic Futurism" aesthetic—a blend of ancient divination and cutting-edge artificial intelligence. It targets a digitally native audience that values high-fidelity aesthetics, spiritual exploration, and emotional resonance.

The style leverages **Glassmorphism** as its primary structural metaphor, creating a sense of looking through a crystalline lens into the cosmos. Depth is achieved through multi-layered translucent surfaces, vibrant background blurs, and soft, emissive glows that simulate starlight or "aura" energy. The interface must feel ethereal yet high-tech, avoiding dated "occult" tropes in favor of a sleek, premium, and mysterious digital experience.

## Colors

The palette is anchored in deep, dark space. The primary background is a rich **Midnight Blue (#050110)**, while elevated surfaces use **Deep Cosmic Purple (#1A0B2E)**. 

Gradients are the lifeblood of this design system, representing "Nebulas." Use linear gradients (45-degree angle) blending Electric Purple, Cyan, and Soft Pink for primary actions and energetic focal points. 

Secondary interactions and "aura" states should utilize low-opacity versions of these accents to create a sense of glowing energy behind glass surfaces. Text should primarily be off-white with a slight lavender tint to maintain the dark-mode harmony.

## Typography

This design system utilizes a high-contrast typographic pairing to bridge the gap between the mystical and the technical. 

- **Noto Serif** is used for headlines to provide a literary, premium, and authoritative feel—reminiscent of ancient texts and cosmic prophecies.
- **Inter** handles all functional body copy and complex UI data for maximum legibility on small screens.
- **Space Grotesk** is introduced for labels and technical data (like palm-line coordinates or AI confidence scores) to inject a "high-tech" futuristic edge.

Ensure headlines always have generous leading and slight negative letter-spacing for a modern, editorial look.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for mobile-first consumption. A standard 4-column grid is used for handheld devices with 24px outer margins to give the content room to "breathe" against the dark background.

Spacing is calculated on a 4px baseline, but the "Mystic Futurism" vibe requires asymmetrical whitespace in content-heavy areas to evoke a sense of curiosity. Elements should be stacked with ample vertical rhythm (Section Gaps of 48px) to prevent the UI from feeling cluttered or utilitarian.

## Elevation & Depth

Depth is not communicated through traditional drop shadows, but through **light transmission and blur**. 

- **Level 1 (Base):** Midnight Blue background.
- **Level 2 (Containers):** 20px background blur, 5% white opacity fill, and a 1px "inner glow" border (20% white).
- **Level 3 (Active/Modal):** 40px background blur, 10% white opacity fill, and a 1px border using a subtle "Nebula" gradient.

Floating elements should feature a soft, colored outer glow (e.g., a 20px blur of the accent color at 15% opacity) to simulate objects emitting light in a vacuum.

## Shapes

The design system embraces ultra-rounded geometry to feel organic and "TikTok-friendly." All primary containers, cards, and buttons must use a corner radius of at least **24px**. 

Small components like chips and inputs should be fully **pill-shaped** to maintain a soft, approachable, and "liquid" feel. Avoid sharp corners entirely to emphasize the "fluidity of fate" theme.

## Components

### Buttons
- **Primary:** Full "Nebula" gradient fill. White text. No border. High-quality haptic feedback on press.
- **Secondary:** Glass-morphic fill (10% white) with a 1px white border at 20% opacity.

### Cards & Glass Containers
- Every card must have a `backdrop-filter: blur(20px)`. 
- Apply a subtle "aurora" effect—a soft, multi-color gradient at 5% opacity—within the card background to give it a shimmering, living quality.

### Input Fields
- Pill-shaped with a dark semi-transparent fill. 
- On focus, the 1px border should animate from white-translucent to a Cyan/Purple gradient, accompanied by a subtle outer glow.

### Aura Chips
- Used for palm-reading categories (e.g., "Love," "Destiny").
- Fully rounded with a low-opacity accent color fill and a matching high-saturation text color.

### Scanning Progress Bar
- A futuristic, thin line with a "traveling" glow point that pulses. The glow should leave a faint trail of particles (using micro-interactions).

### AI Visualization
- Include a "Palm Mesh" component: a 3D-like wireframe overlay for palm photos that uses the Cyan accent and glows at the intersections of the palm lines.