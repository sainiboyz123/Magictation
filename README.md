# Magictation

A visual flow builder for Home Assistant. Place cards on a canvas and draw lines between them.

**When** something happens, check **And** conditions (each has a **Yes** and a **No** output), and **Then** do things. Magictation compiles every flow into a native Home Assistant automation, so your automations keep running even if the app is stopped.

## Features
- Free canvas: drag cards anywhere, draw lines, pan and zoom, snap to grid
- Yes / No branches on every And card; one output can feed several cards
- Device-first picking: one tile per device, grouped by room, with only the cards that device supports (diagnostic entities hidden)
- Apps for time, sun, presence, notifications, delays, scenes and advanced Home Assistant cards
- Test mode highlights the path the flow would take with live device states
- Undo / redo, keyboard shortcuts, YAML preview of the generated automation
- Validation as you build; invalid flows are saved as drafts and never deployed

## Install
1. In Home Assistant go to **Settings → Apps → Install app**, open the **⋮** menu (top right) → **Repositories**.
   (Older versions: Settings → Add-ons → Add-on store → ⋮ → Repositories.)
2. Add `https://github.com/sainiboyz123/Magictation`
3. Install **Magictation**, start it, and turn on **Show in sidebar**

The "Add from a GitHub link" box in the Marketplace is for integrations and cards, not apps, so it won't accept this repository.

## How it works
Flows are stored in the app's `/data/flows.json`. On save, each flow is written to Home Assistant as automation `magictation_<id>` (alias prefixed `[Magictation]`) through the Core API. Magictation only touches automations with that id prefix.

Graph to automation: And cards become `if / then / else`, several lines from one output become `parallel`, and several When cards with different paths become a `choose` on the trigger id.

## Develop
```
cd magictation && npm install && npm test        # server + compiler tests (mock HA)
cd magictation/web && npm install && npm test    # UI logic tests
cd magictation/web && npm run build              # build the UI
cd magictation && npm run dev                    # mock Home Assistant + app on :8099
```
