# Planning Guide

A minimal, premium terminal-style search interface with an ASCII/Unicode starfield background that serves as the homepage for NSPE.dev.

**Experience Qualities**:
1. **Terminal-authentic** - Raw computing aesthetic with monospace typography and classic terminal colors
2. **Focused** - Single-purpose interface directing attention to the search input
3. **Atmospheric** - Dense starfield creates depth without distraction

**Complexity Level**: Micro Tool (single-purpose application)
This is a single-screen search interface with animated placeholder text and a decorative ASCII background. No routing, no data persistence, minimal state management.

## Essential Features

### ASCII/Unicode Starfield Background
- **Functionality**: Renders a dense, full-screen background of randomly positioned ASCII and Unicode characters
- **Purpose**: Creates terminal-style atmosphere and visual interest without overwhelming the interface
- **Trigger**: Loads automatically on page mount
- **Progression**: Generate character positions → Apply random colors from terminal palette → Render across entire viewport
- **Success criteria**: Characters evenly distributed across full screen, no clustering, using only specified character set and terminal colors

### Search Bar with Rotating Placeholder
- **Functionality**: Centered search input with animated placeholder text that cycles through predefined messages
- **Purpose**: Primary interaction point that hints at various search capabilities
- **Trigger**: Placeholder rotation starts on mount, cycles every 3 seconds
- **Progression**: Display placeholder → Wait 3s → Fade out → Switch text → Fade in → Repeat
- **Success criteria**: Smooth text transitions, fully opaque input text, maintains focus state

### Command Hint Display
- **Functionality**: Static cyan text below search bar displaying help command
- **Purpose**: Guides users to discover available commands
- **Trigger**: Displays on page load
- **Progression**: Render on mount → Remain visible
- **Success criteria**: High contrast cyan text, clearly readable, properly centered

## Edge Case Handling
- **Empty search submission**: No action required - purely presentational interface
- **Window resize**: Starfield and search bar remain properly positioned and sized
- **Very small viewports**: Search bar width adjusts responsively while maintaining readability
- **Long text input**: Input field scrolls horizontally to accommodate text

## Design Direction
The design should evoke a premium terminal interface - the intersection of raw computing power and refined minimalism. Think Bloomberg Terminal meets Unix shell: professional, focused, no-nonsense, yet visually captivating through the starfield effect.

## Color Selection
Terminal-authentic color palette using classic ANSI colors against a dark background.

- **Primary Color**: Cyan (oklch(0.85 0.15 195)) - Commands and interactive hints
- **Secondary Colors**: White (oklch(0.95 0 0)), Green (oklch(0.75 0.15 145)), Yellow (oklch(0.80 0.15 95)), Orange (oklch(0.70 0.15 50)), Blue (oklch(0.65 0.15 250)) - Starfield character variety
- **Accent Color**: Bright Cyan (oklch(0.90 0.18 195)) - High-emphasis command text
- **Foreground/Background Pairings**: 
  - Background (Deep Charcoal oklch(0.12 0 0)): White text (oklch(0.95 0 0)) - Ratio 14.2:1 ✓
  - Search Bar (Lighter Charcoal oklch(0.18 0 0)): White text (oklch(0.95 0 0)) - Ratio 10.8:1 ✓
  - Background (Deep Charcoal oklch(0.12 0 0)): Cyan text (oklch(0.85 0.15 195)) - Ratio 9.5:1 ✓

## Font Selection
Monospace typography throughout to maintain terminal authenticity and ensure proper character alignment in the ASCII starfield.

- **Typographic Hierarchy**:
  - Starfield Characters: JetBrains Mono Regular/12px/normal letter spacing
  - Search Input: JetBrains Mono Regular/16px/normal letter spacing
  - Search Placeholder: JetBrains Mono Regular/16px/normal letter spacing (with opacity)
  - Command Hint: JetBrains Mono Regular/14px/normal letter spacing

## Animations
Animations serve only functional purposes - no gratuitous motion.

- **Placeholder rotation**: Subtle cross-fade transition (300ms) between placeholder texts every 3 seconds using opacity changes
- **NO other animations**: No character movement, no floating effects, no background shifts, no hover states

## Component Selection
- **Components**: 
  - Custom input field styled as terminal search bar (no shadcn Input component to avoid unnecessary styling overhead)
  - Custom starfield renderer using absolute positioning for character distribution
- **Customizations**: 
  - Starfield: Grid-based positioning system to ensure even distribution across viewport
  - Search bar: Custom charcoal panel with subtle border, no shadows or depth effects
- **States**: 
  - Search input focus: Subtle border color shift to cyan
  - Search input active: Full opacity text, placeholder hidden
- **Icon Selection**: None - pure text interface
- **Spacing**: 
  - Search bar positioned at 40vh from top
  - Command hint positioned 24px below search bar
  - Minimal padding (12px vertical, 20px horizontal) inside search bar
- **Mobile**: 
  - Search bar width increases to 90% on mobile viewports
  - Font sizes remain constant for readability
  - Starfield density may reduce slightly on very small screens for performance
