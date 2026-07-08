# Product

## Register

product

## Users

Developers and operators running WinCTL on their own Windows machine (and occasionally reaching it remotely over the LAN). They use it to babysit long-running local processes and services: dev servers, workers, tunnels, game servers. Context is a second monitor or a background tab, glanced at often, acted on quickly: is it up, did it crash, restart it, read the last log lines.

## Product Purpose

WinCTL supervises child processes with a live web dashboard: spawn, kill, auto-start on boot, auto-restart on crash, tail logs, group into folders, run one-off commands. It exists because Windows has no good lightweight equivalent of `pm2`/`systemctl` with a UI. Success is the operator trusting the dashboard at a glance and never dropping to Task Manager or a terminal to answer "what's running."

## Brand Personality

Instrument panel, not consumer app. Precise, quiet, dense, confident. Three words: **instrument, exact, calm.** The interface should feel like a well-made piece of equipment: status is legible in a glance, controls respond crisply, nothing decorative competes with the data.

## Anti-references

- Consumer-SaaS marketing dashboards (hero metrics, gradient cards, playful empty states).
- Bootstrap/Material admin templates: identical card grids, flat gray-on-white, generic.
- Anything that hides state behind animation or makes the operator wait to read a status.

## Design Principles

1. **Status is the product.** The running/stopped/starting state must be readable in under a second, from across the room. The signature status LEDs earn their pixels; nothing else should shout louder than them.
2. **Depth carries hierarchy, not color.** The soft-glass + neumorphism material system uses light and blur to separate chrome from content; accent color stays scarce and meaningful.
3. **Every control confirms itself.** Press states, ripples, and spinners exist so an operator knows an action landed, on a system where actions have real consequences (killing a process).
4. **Dense but never cramped.** This is a monitoring surface; show a lot, but keep touch targets and rhythm honest.
5. **Motion serves feedback, never spectacle.** Animation communicates state change and never delays reading the current state.

## Accessibility & Inclusion

- Target WCAG 2.1 AA for text and interactive contrast. Text ramp is already AA-clean on all surfaces; the remaining gap is white-on-accent button labels (3.68:1) — see design review.
- Full `prefers-reduced-motion` support: entrances and transitions collapse to instant, with no residual stagger delay.
- Keyboard focus is always visible (`:focus-visible` ring). Touch targets ≥44px on the gallery/mobile controls per WCAG 2.5.5.
