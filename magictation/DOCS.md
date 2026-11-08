# Magictation

Open **Magictation** from the Home Assistant sidebar.

1. Click **New flow** or start from a template.
2. Use the buttons at the bottom: **When** (what starts the flow), **And** (a check with a Yes and a No answer), **Then** (what to do), **Wait** (a delay).
3. Pick a device or an app, then pick what it should do.
4. Drag a line from the dot on the right of a card to another card. And cards have a green ✓ (Yes) dot and a red ✕ (No) dot.
5. Click a card to change its settings. Click **Save**: the flow becomes a normal Home Assistant automation.

Tips
- Drag a line onto empty canvas to add and connect a new card in one go.
- With a card selected, the bottom buttons add the next card already connected to it.
- Drag a card's header to move it; Shift-click to select several.
- Click a line to select it, then press Delete or click the ✕ on it.
- **Test** shows the path the flow would take with the current device states.
- **YAML** shows the generated automation.
- Shortcuts: Ctrl+S save, Ctrl+Z / Ctrl+Y undo and redo, Ctrl+D duplicate, Delete remove, Ctrl+K command palette. Ctrl+scroll zooms; drag the background to pan.

Cards that are not connected to a When card are ignored. Lines cannot loop back.

Flows are stored in the app data. Deleting a flow also removes its automation. Disabling a flow turns the automation off.

## Options
- `log_level`: debug, info, warning or error.
