# Magictation

A futuristic, Homey-Flow-style visual automation builder for Home Assistant.

Pick a **WHEN** trigger, add optional **AND** conditions, choose what happens **THEN**. Magictation compiles every flow into a native Home Assistant automation, so your automations keep running even if the add-on is stopped.

## Features
- Three-lane flow canvas (WHEN / AND / THEN) with animated connectors, pan and zoom
- Device picker grouped by location (area), with search and domain filters
- Logic: AND / OR / NOT groups, if / then / else, repeat, delay, wait-for-state, templates
- Triggers: device state, numeric thresholds, time, interval, sunrise/sunset, zones, HA start, custom events
- Live device state glow on cards, "Test" mode that checks conditions against current states
- Undo / redo, Ctrl+K command palette, YAML preview of the generated automation
- Validation as you build; invalid flows are saved as drafts and never deployed

## Install
1. In Home Assistant: **Settings → Add-ons → Add-on store → ⋮ → Repositories**
2. Add `https://github.com/sainiboyz123/Magictation`
3. Install **Magictation**, start it, and enable **Show in sidebar**

The add-on is private-repo friendly: if the repository is private, the add-on store cannot fetch it. In that case copy the `magictation` folder into your HA `/addons` share (local add-on) instead.

## How it works
Flows are stored in the add-on's `/data/flows.json`. On save, each flow is written to Home Assistant as automation `magictation_<id>` (alias prefixed `[Magictation]`) through the Core API. Magictation only touches automations with that id prefix.

## Develop
```
cd magictation && npm install && npm test        # server + compiler tests (mock HA)
cd magictation/web && npm install && npm test    # UI logic tests
cd magictation/web && npm run build              # build the UI
npm run mock                                     # mock Home Assistant on :8124
HA_URL=http://127.0.0.1:8124 HA_TOKEN=mock-token node server/index.js   # app on :8099
```
