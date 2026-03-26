# B Resources — Hierarchy & Tagging System Design
*Author: Nico (via Cowork) · Date: March 26, 2026*
*For implementation by Claude Code*

---

## 1. Problem

Library and Vault have flat category filters only (Library: Framework, Playbook, SOP, Reference; Vault: Brand, Template, Credentials, Document). As content grows, there's no way to cross-cut by topic, track lifecycle status, or visually prioritize items. We need tags for flexible categorization and a kanban view for workflow management.

## 2. Firestore Schema Changes

### Existing fields (no change)
- `title` / `name` (string)
- `category` (string — keeps working as-is)
- `description` (string)
- `tags` (string[]) — **already exists**, saved as array from comma input
- `fileUrl`, `fileName`, `fileSize`, `fileType`, `storagePath`
- `uid`, `createdAt`

### New fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `"Active"` | Kanban column. Enum: `"Inbox"`, `"Active"`, `"Archive"` |
| `priority` | number | `0` | Sort order within kanban column (lower = higher) |
| `updatedAt` | timestamp | `serverTimestamp()` | Track last modification for sync/sort |

### Migration note
Existing documents won't have `status` or `priority`. Code must treat missing `status` as `"Active"` and missing `priority` as `0`. No batch migration needed — fields get added on next edit/create.

## 3. Tag System Design

### Architecture
- Tags are **free-form strings**, user-created, stored lowercase, trimmed, no duplicates per document.
- No separate `tags` collection — tags are denormalized on each document. To get all unique tags, aggregate from the collection at load time.
- Tag colors are auto-assigned from a palette based on hash of tag string (deterministic, no config needed).

### Recommended starter tags for HC

**Library:**
- `pitch`, `fundraising`, `sales`, `content`, `marketing`, `newsletter`, `brand`, `onboarding`, `process`, `investors`, `clients`, `coaching`, `strategy`, `operations`

**Vault:**
- `logo`, `brand`, `design`, `template`, `legal`, `social`, `deck`, `fonts`, `colors`, `photography`, `video`, `contracts`

### Tag UI components

**Tag Input (create/edit modals):**
- Chip-style input: type text → press Enter or comma to create tag pill
- Each pill has an × to remove
- Autocomplete dropdown showing existing tags from the collection (fuzzy match)
- Max 10 tags per document (soft limit, UI warning)

**Tag Filter Bar (list/grid view):**
- Horizontal row of clickable tag pills below category filter
- Shows top 15 most-used tags + "Show all" expander
- Multiple selection with AND logic (item must have ALL selected tags)
- Active tags show filled, inactive show outlined
- Clear all button when any tag is selected

**Tag Display (cards):**
- Show up to 3 tags as small pills on each card
- "+N more" indicator if > 3 tags
- Tag pills use the auto-assigned color (light background, darker text)

### Tag Color Palette
```javascript
const TAG_COLORS = [
  { bg: "#EFF6FF", text: "#2563EB" },  // blue
  { bg: "#F0FDF4", text: "#16A34A" },  // green
  { bg: "#FFF7ED", text: "#EA580C" },  // orange
  { bg: "#FDF2F8", text: "#DB2777" },  // pink
  { bg: "#F5F3FF", text: "#7C3AED" },  // purple
  { bg: "#ECFDF5", text: "#059669" },  // emerald
  { bg: "#FEF3C7", text: "#D97706" },  // amber
  { bg: "#F0F9FF", text: "#0284C7" },  // sky
]

function getTagColor(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}
```

## 4. Kanban View Design

### Columns
| Column | Meaning | Use case |
|--------|---------|----------|
| **Inbox** | Newly added, unsorted | Default for items added via Slack bot (future). Manual assignment. |
| **Active** | Currently relevant, in use | Default for items created in-app. The "working set." |
| **Archive** | No longer active but preserved | Past versions, deprecated SOPs, old templates. |

### Layout
- Three columns, equal width, scrollable vertically per column
- Column headers: name + item count badge
- Cards use the same `DocCard` / `AssetCard` components from grid view
- Category filter and tag filter still apply in kanban view

### Drag-and-drop
- Use native HTML5 drag-and-drop API (no external libraries)
- `draggable="true"` on cards
- `onDragStart`: set `dataTransfer` with document ID
- `onDragOver`: highlight target column
- `onDrop`: update Firestore `status` field + `updatedAt`
- Optimistic UI update (move card immediately, revert on error)

### View Toggle
- Toggle button group in the toolbar: `Grid | Kanban`
- Default: Grid (preserves current behavior)
- Persist preference in `localStorage` per page (library/vault)
- Both views share the same filter state (category, tags, search)

## 5. Search Integration

Search must include the new fields:
```javascript
const matchSearch = !search ||
  d.title?.toLowerCase().includes(term) ||
  d.description?.toLowerCase().includes(term) ||
  (d.tags || []).some(t => t.toLowerCase().includes(term)) ||
  d.status?.toLowerCase().includes(term)
```

## 6. Component Structure

### New components to create:
- `src/components/TagInput.jsx` — Chip-style tag input with autocomplete
- `src/components/TagFilter.jsx` — Horizontal filter bar with tag pills
- `src/components/KanbanBoard.jsx` — Three-column kanban layout with drag-and-drop
- `src/components/ViewToggle.jsx` — Grid/Kanban toggle button

### Modified components:
- `src/pages/Library.jsx` — Add TagFilter, ViewToggle, KanbanBoard, update create/edit forms to use TagInput
- `src/pages/Vault.jsx` — Same changes as Library

## 7. Known Bug to Fix First

**Vault.jsx line 10:** Missing comma after `doc` in the Firestore import:
```javascript
// BROKEN (current):
  doc
  serverTimestamp,

// FIXED:
  doc,
  serverTimestamp,
```
This is likely causing a syntax error that may be silently caught or preventing Vault from loading in some environments.

## 8. Firestore Rules

No changes needed. Current rules allow read/write for any authenticated user on both `library` and `vault` collections. New fields (`status`, `priority`, `updatedAt`) don't require rule changes.

## 9. Implementation Order

1. Fix Vault.jsx bug (line 10 comma)
2. Add `status`, `priority`, `updatedAt` fields to create flows
3. Build TagInput component
4. Build TagFilter component
5. Build ViewToggle component
6. Build KanbanBoard component
7. Integrate into Library page
8. Integrate into Vault page
9. Seed sample data with tags and statuses
10. Test all flows end-to-end
