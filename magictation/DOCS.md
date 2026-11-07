# Magictation

Open **Magictation** from the Home Assistant sidebar.

1. Click **New flow** or start from a template.
2. Add cards to the **WHEN**, **AND** and **THEN** lanes. Click a card to edit it.
3. Click **Save & deploy**. The flow becomes a normal Home Assistant automation.

Tips
- **Test** checks your AND conditions against live device states.
- **Preview** shows the generated automation YAML.
- **Ctrl+K** opens the command palette; **Ctrl+S** saves; **Ctrl+Z / Ctrl+Y** undo and redo.
- Ctrl + scroll zooms; drag the background to pan.

Flows are stored in the add-on data. Deleting a flow also removes its automation. Disabling a flow turns the automation off.

## Options
- `log_level`: debug, info, warning or error.
