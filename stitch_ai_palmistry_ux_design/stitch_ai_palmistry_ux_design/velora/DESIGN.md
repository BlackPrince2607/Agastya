---
name: Velora
colors:
  surface: '#13131a'
  surface-dim: '#13131a'
  surface-bright: '#393841'
  surface-container-lowest: '#0e0e15'
  surface-container-low: '#1b1b22'
  surface-container: '#1f1f26'
  surface-container-high: '#2a2931'
  surface-container-highest: '#34343c'
  on-surface: '#e4e1ec'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e4e1ec'
  inverse-on-surface: '#303038'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#ffb0cd'
  on-secondary: '#640039'
  secondary-container: '#aa0266'
  on-secondary-container: '#ffbad3'
  tertiary: '#adc6ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#4d8eff'
  on-tertiary-container: '#00285d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#ffd9e4'
  secondary-fixed-dim: '#ffb0cd'
  on-secondary-fixed: '#3e0022'
  on-secondary-fixed-variant: '#8c0053'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#13131a'
  on-background: '#e4e1ec'
  surface-variant: '#34343c'
typography:
  h1:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.5px
  h2:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.3px
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.2px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0px
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  margin-page: 24px
  gutter: 16px
---

## Brand & Style

This design system is built upon a foundation of "Mystical Intelligence," blending the precision of AI with the ethereal aesthetic of cosmic exploration. The brand personality is intuitive, sophisticated, and deeply immersive, designed to evoke a sense of wonder and personal discovery. 

The visual style is a refined execution of **Glassmorphism** and **Vaporwave-Modernism**. It utilizes deep, infinite backgrounds contrasted against vibrant, neon-tinted interactive elements. The interface should feel like a portal—translucent layers, glowing boundaries, and high-fidelity 3D assets work together to create a tactile yet digital experience that feels both futuristic and ancient.

## Colors

The palette is strictly dark-first, centered around an "Infinite Void" background (#0B0B12). Primary vibrancy is achieved through a three-tone spectrum: Deep Purple for wisdom, Vibrant Pink for energy, and Sky Blue for clarity.

A signature three-point gradient is used for high-impact CTAs and progress indicators to signify movement and transformation. Surfaces are not flat; they utilize subtle layering through hex-codes #12121C (secondary background) and #1A1A2E (elevated surfaces) to maintain depth without sacrificing the dark-mode immersion.

## Typography

This design system utilizes a systematic application of **Inter** to ensure maximum readability against dark, glowing backgrounds. The hierarchy is steep, with bold headlines providing an authoritative voice.

For data-heavy or secondary information, use the Muted Text color (#6B7280) to reduce cognitive load. Interactive labels and "Overline" text should use the uppercase bold style with slight tracking to differentiate from body prose. Headlines may occasionally utilize the brand gradient as a text-fill for hero sections or significant milestones.

## Layout & Spacing

The system follows an **8pt Grid** philosophy to ensure mathematical harmony across all screen sizes. Layouts are primarily fluid within a 12-column structure, using 24px outer margins for mobile and desktop "safe areas."

Spacing should be generous to maintain the "Minimal but Expressive" brand principle. Elements are grouped using internal padding (16px–24px) within cards to create a sense of containment. Horizontal rhythm is established by 16px gutters between modular components.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

- **Level 0 (Base):** #0B0B12 - The main canvas.
- **Level 1 (Cards):** #12121C with a 1px stroke (white at 10% opacity) and a background blur of 12px-20px.
- **Level 2 (Modals/Popovers):** #1A1A2E with a subtle outer glow using the primary purple color at 5% opacity.
- **Interactive Elements:** Use "Inner Glow" effects on buttons and active states to simulate luminescence from within the interface.

## Shapes

The shape language is organic and approachable. This design system favors large radii to soften the high-tech aesthetic. 

Standard components (buttons, inputs) use a 12px radius, while primary containers and glassmorphic cards use a 20px-24px radius to create a "container" feel. Progress bars and chips utilize full pill-shaping (999px) to contrast against the more architectural card forms.

## Components

### Buttons
- **Primary:** Uses the 135-degree brand gradient. Text is white. On "press," the element scales down to 0.96.
- **Secondary:** Transparent background with a 1px solid purple border.
- **Ghost:** No background or border; uses Sky Blue or Pink text for subtle actions.

### Cards
- **Glassmorphic:** Semi-transparent background (#12121C at 80% opacity), 1px subtle border, and 20px corner radius.
- **Glowing:** For featured content, add a 2px bottom-border using the brand gradient or a soft radial outer glow.

### Input Fields
- **Default:** Dark fill (#12121C), 12px radius, with a subtle white stroke (10% opacity). 
- **Focus:** Stroke changes to the Primary Purple (#8B5CF6) with a soft outer glow.

### Selection Controls
- **Checkboxes:** Rounded squares (4px radius). When active, they fill with the brand gradient and show a white checkmark.
- **Toggles:** Pill-shaped track. Active state uses the Primary Purple background with a white thumb.

### Progress Indicators
- **Circular/Linear:** Use the brand gradient for the "filled" portion. The "unfilled" track should be #1A1A2E.

### Interactive Imagery
- Use glowing line art for icons and 3D astral-themed illustrations for empty states or hero headers. Icons should maintain a "Line Style" with a 2px stroke width.