# Arkiflo - Interior Design Workflow System

## Problem Statement
Build a full-stack CRM application for an interior design company, managing the complete workflow from Pre-Sales inquiries through Project completion, with milestone tracking, user permissions, and team collaboration.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Backend**: FastAPI (Python) - Currently monolithic server.py (~20,000+ lines)
- **Database**: MongoDB
- **Authentication**: Emergent Google OAuth + Local Password Login (for testing)

## Current Status: Module Spatial Precision + Arc Wall COMPLETE ✅
**As of February 14, 2026**

### Composer (SpatialBOQCanvas) - Module Spatial Precision Fix

Implemented production-grade spatial placement with collision detection, multi-directional snapping, and clickable dimension editing.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **All-Direction Wall Snap** | Modules snap to LEFT, RIGHT, TOP, BOTTOM walls | ✅ |
| 2 | **Arc Wall Snap** | Modules snap to arc wall inner boundary | ✅ |
| 3 | **Wall Collision Detection** | Detects when module penetrates wall boundary | ✅ |
| 4 | **Module Overlap Detection** | Detects when modules overlap each other | ✅ |
| 5 | **Red Outline Warning** | Overlapping/colliding modules show red dashed outline + ⚠️ | ✅ |
| 6 | **Green Outline Valid** | Valid snapped modules show green outline | ✅ |
| 7 | **Wall Distance Labels** | Shows distance to all nearby walls when module selected | ✅ |
| 8 | **Clickable Dimensions** | Click distance label to edit exact distance | ✅ |
| 9 | **Zero-Snap (Flush)** | Enter "0" to snap module flush to wall | ✅ |
| 10 | **Door Enhanced Hitbox** | 50mm padding for easier door selection | ✅ |
| 11 | **Window Enhanced Hitbox** | 50mm padding for easier window selection | ✅ |
| 12 | **Arc Elevation View** | Arc walls show curved top edge in elevation | ✅ |
| 13 | **Arc Length in Elevation** | Width markers use arc length, not chord | ✅ |

**Module Spatial Precision Technical Details:**
- `snapModuleToWall()`: Checks all 4 sides of straight walls + arc wall inner boundary
- `checkModuleWallCollision()`: AABB collision for straight walls, radial check for arc walls
- `checkModuleOverlap()`: AABB overlap detection between modules
- `calculateModuleToWallDistances()`: Returns distances for top/bottom/left/right directions
- `applyModuleDistanceToWall()`: Positions module at exact distance (0 = flush)
- `findDoorAt()` / `findWindowAt()`: Enhanced with 50mm HITBOX_PADDING

---

### Composer (SpatialBOQCanvas) - Arc Wall Drawing & Junction Merging

Implemented curved/arc wall drawing capability with two input methods, full structural support, AND seamless junction merging between arc and straight walls.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **Arc Input: Radius** | Define arc by specifying radius value (mm) | ✅ |
| 2 | **Arc Input: Chord Height** | Define arc by chord height/string height (mm) | ✅ |
| 3 | **Mouse-Based Bulge Direction** | Arc bulges toward mouse position (live preview) | ✅ |
| 4 | **Flip Arc Button** | Secondary control to flip arc direction | ✅ |
| 5 | **True SVG Arc Rendering** | Smooth SVG arc curves (not segmented polylines) | ✅ |
| 6 | **Wall Thickness Visualization** | Inner/outer boundary rendering with thickness | ✅ |
| 7 | **Arc Wall Data Model** | Stores radius, chord length, chord height, center, angles | ✅ |
| 8 | **Arc Dimension Display** | Shows R:XXXmm and Arc:XXXmm while drawing | ✅ |
| 9 | **Endpoint Snapping** | Arc endpoints snap to grid and existing vertices | ✅ |
| 10 | **UI Integration** | Arc Wall option in Wall Tool dropdown panel | ✅ |
| 11 | **Door/Window on Arc** | Doors and windows snap to arc centerline with tangent rotation | ✅ |
| 12 | **Arc Distance Calculation** | Distance to arc wall for nearby detection | ✅ |
| 13 | **Move Opening Along Arc** | Doors/windows slide smoothly along curved walls | ✅ |
| 14 | **Arc Curvature Drag Edit** | Diamond handle at arc midpoint to adjust curvature | ✅ |
| 15 | **Arc Wall Translation** | Drag to move entire arc wall | ✅ |
| 16 | **Arc Click Detection** | Click detection works for arc walls | ✅ |
| 17 | **Arc Endpoint Dragging** | Drag endpoints to resize arc while maintaining curvature | ✅ |
| 18 | **Arc-Straight Junction Detection** | Detects when arc wall endpoint connects to straight wall endpoint | ✅ |
| 19 | **Arc-Straight Junction Fill** | Fill polygon at junction for seamless visual merge | ✅ |
| 20 | **Conditional End Cap Hiding** | Arc end caps hidden when connected to straight wall | ✅ |
| 21 | **Chain Edge Skipping** | Straight wall end caps hidden at arc junctions | ✅ |
| 22 | **Tangent Miter Junction** | Arc-straight junction uses tangent bisector for seamless miter corner | ✅ |
| 23 | **Curved Door on Arc** | Doors on arc walls render as curved SVG paths following wall curvature | ✅ |
| 24 | **Curved Window on Arc** | Windows on arc walls render with curved frame and radial divider | ✅ |
| 25 | **Floor Fill with Arc Boundary** | Floor polygon includes arc curve vertices (not just chord) | ✅ |

**Arc Wall Technical Details:**
- Two calculation functions: `calculateArcFromRadius()` and `calculateArcFromChordHeight()`
- Arc boundaries calculated with `calculateArcWallBoundaries()` for inner/outer curves
- SVG path generation: outer arc → end cap → inner arc (reversed) → start cap → close
- Bulge direction determined by cross product of chord and mouse vectors
- Arc wall properties stored: `is_arc`, `arc_radius`, `arc_chord_length`, `arc_chord_height`, `arc_center_x/y`, `arc_start/end_angle`, `arc_sweep_flag`, `arc_large_arc_flag`, `arc_bulge_direction`

**Arc-Straight Junction Tangent Miter Technical Details:**
- `arcStraightJunctions` memo: Detects connections within `CLOSURE_TOLERANCE` (200mm)
- `computeTangentMiterJunction()`: Calculates miter angle as bisector of arc tangent and straight wall direction
- Miter factor = 1/cos(halfAngle), clamped to max 3 to prevent extreme miter spikes
- Fill polygon: 4-6 point polygon covering the junction gap with proper miter geometry
- `isArcEndpointConnected()` helper: Checks if specific arc endpoint has junction
- Conditional rendering: End cap strokes skipped when connected

**Curved Door/Window on Arc Walls:**
- When `door.is_on_arc && attachedWall.is_arc`, renders curved SVG arc path
- Angular span = opening.width / arcRadius (in radians)
- Inner/outer radii calculated from wall.arc_radius ± halfThickness
- Door swing arc follows wall curvature
- Window has radial divider line (inner to outer at center angle)
- Text label rotated to match arc tangent angle

**Floor Fill with Arc Boundary:**
- `detectFloorPolygon()` tracks `wallSequence` array during traversal
- `generateArcBoundaryPoints(wall, 12)` creates 12 curve vertices along inner arc radius
- Floor polygon includes curve vertices for smooth arc boundary (not chord straight line)
- Interior offset applied for clean floor edge inside wall boundary

**Arc Wall UI:**
- Located under Wall Tool dropdown (alongside Straight Wall, Rectangle, Square)
- Input method toggle: "Radius" or "Chord Height (String Height)"
- Numeric input for selected method value
- "Flip Arc Direction" button
- Helper text: "Mouse position determines arc bulge"

---

## Previous Status: Loop Closure Prediction COMPLETE ✅
**As of February 13, 2026**

### Composer (SpatialBOQCanvas) - Loop Closure Prediction

Implemented predictive room closure guidance that shows visual indicators when drawing the 3rd wall of a potential room and the trajectory aligns with the starting point.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **Loop Closure Detection** | Detects when wall drawing trajectory aligns with chain start point | ✅ |
| 2 | **Alignment Calculation** | Uses perpendicular distance (300mm threshold) to detect alignment | ✅ |
| 3 | **Visual Crosshairs** | Amber crosshairs appear at predicted closure point | ✅ |
| 4 | **Extended Guides** | Dashed amber alignment guides extend across viewport | ✅ |
| 5 | **"Close Room" Label** | Amber pill-shaped label shows closure guidance | ✅ |
| 6 | **Distance Indicator** | Shows remaining distance (mm) to closure point | ✅ |
| 7 | **Alignment Strength** | Visual opacity increases with better alignment | ✅ |
| 8 | **State Management** | `loopClosureProjection` state cleared when not drawing | ✅ |

**Loop Closure Technical Details:**
- `findLoopClosureProjection()` calculates trajectory alignment with chain start
- Uses perpendicular distance to detect when cursor path leads to closure
- Visual indicator shows:
  - Dashed projection line from cursor to closure point
  - Extended horizontal/vertical alignment guides (amber, dashed)
  - Crosshair with outer ring at closure point
  - "Close Room" label (amber pill)
  - Distance indicator showing millimeters to closure
- Alignment strength (0-1) controls visual opacity for intuitive feedback

---

## Previous Status: T-Junction Seamless Rendering COMPLETE ✅
**As of February 13, 2026**

### Composer (SpatialBOQCanvas) - Seamless T-Junction Rendering

Implemented Coohom-style unified wall boundary rendering with no internal seam lines at junctions.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **Mid-span T-Junction Detection** | Detects when wall endpoint lies on another wall's middle (not just endpoints) | ✅ |
| 2 | **Junction Geometry Calculation** | Computes through-wall direction, stem direction, and proper offsets | ✅ |
| 3 | **Stem Wall Rendering** | Renders stem from through-wall outer edge (no overlap) | ✅ |
| 4 | **Seamless Junction Strokes** | Stem wall has no stroke at junction edge (blends with through-wall) | ✅ |
| 5 | **Stem Chain Skipping** | Stem walls in T-junctions skip normal chain rendering (no double render) | ✅ |
| 6 | **Through-Wall Chain Detection** | Chains detect when they have affecting T-junctions | ✅ |
| 7 | **Unified Boundary Rendering** | Chain polygons render with fill-only, edges stroked separately | ✅ |
| 8 | **Junction Edge Skipping** | Edges at T-junction points are not stroked (no internal seam lines) | ✅ |

**T-Junction Rendering Technical Details:**
- Chain polygon rendered with `stroke="none"` to prevent internal seams
- Each edge rendered as separate `<line>` element  
- Edge-skipping logic detects edges near T-junction points
- Edges within `halfStemThickness * 2` distance and shorter than `halfStemThickness * 3` are skipped
- Result: Unified wall appearance like Coohom - no visible seam lines at junctions

---

## Previous Status: T-Junction Geometry Engine COMPLETE ✅
**As of February 13, 2026**

### Composer (SpatialBOQCanvas) - T-Junction Detection

Implemented professional wall split functionality with improved UX and T-junction auto-merge.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **Slice Icon** | Small black knife/slice icon in toolbar (cleaner look) | ✅ |
| 2 | **Keyboard Shortcut** | Press 'S' to activate split tool | ✅ |
| 3 | **Split Preview with Measurements** | Shows distance to both endpoints while hovering | ✅ |
| 4 | **Perpendicular Cut Line** | Dotted line shows where cut will occur | ✅ |
| 5 | **Split Markers** | Gray dotted lines persist at split points after cutting | ✅ |
| 6 | **T-Junction Detection** | Detects when wall endpoint is dragged near another wall's middle | ✅ |
| 7 | **T-Junction Auto-Merge** | Automatically splits target wall and creates T-junction | ✅ |
| 8 | **T-Junction Indicator** | Orange circle with "T" shows T-junction snap target | ✅ |

**Split Tool Features:**
- Slice icon in toolbar (slate gray when active)
- Shows distances: "XXXmm" labels at midpoints to both endpoints
- Black perpendicular dotted line shows cut position
- Compact "Click to Cut" label below cursor
- Toast notification: "Wall split into XXXmm and XXXmm segments"

**T-Junction Features:**
- Orange "T" indicator appears when dragging near wall middle
- 80mm threshold for T-junction detection
- Automatic wall splitting on mouse release
- Creates proper T-junction geometry for room detection

---

## Previous Status: CAD Precision Enhancements (Coohom-style) COMPLETE ✅
**As of February 13, 2026**

### Composer (SpatialBOQCanvas) - Coohom-style CAD Precision

Implemented professional CAD-level snapping and constraint behavior matching Coohom software.

| # | Enhancement | Description | Status |
|---|-------------|-------------|--------|
| 1 | **Ortho Drawing Toggle** | Toggleable ortho mode (default ON) snaps to 90° angles | ✅ |
| 2 | **Green Alignment Guides** | Dashed green lines appear when drawing horizontally/vertically | ✅ |
| 3 | **Endpoint Snap Indicators** | Green circle appears when near existing wall endpoints | ✅ |
| 4 | **Grid Snap Indicators** | Gray circle shows grid snap points (50mm increments) | ✅ |
| 5 | **Real-time Dimension Display** | Gray box shows wall length (mm) while drawing | ✅ |
| 6 | **Auto Endpoint Join** | Walls automatically connect when endpoints are close | ✅ |
| 7 | **Shift Key Override** | Hold Shift for manual ortho lock when ortho is off | ✅ |

**Visual Feedback (Coohom-style):**
- **Snap Indicator**: Simple filled circle (green for endpoint, gray for grid)
- **Alignment Guides**: Green dashed lines (8,4 pattern)
- **Dimension Box**: Light gray (#F1F5F9) box with dark text showing "XXXX mm"
- **Ortho Badge**: Green "✓ Ortho Drawing Active" indicator on canvas

**Technical Constants:**
- `ENDPOINT_SNAP_THRESHOLD = 150mm`
- `GRID_SNAP_SIZE = 50mm`
- `orthoMode` state (default: true)

**Wall Mode Panel Features:**
- Ortho Drawing toggle (green when active)
- Rectangle Room mode
- Square Room mode
- Free Line Draw mode

---

## Previous Status: Composer CAD Interaction Fixes COMPLETE ✅
**As of February 12, 2026**

### Composer (SpatialBOQCanvas) - 4 CAD Interaction Bug Fixes

All 4 CAD interaction issues reported by user have been fixed and verified.

| # | Issue | Fix Applied | Status |
|---|-------|-------------|--------|
| 1 | **True Canvas Pan** | Grid patterns now use `patternTransform` with panOffset - grid moves with plan | ✅ |
| 2 | **Floor Detection Visualization** | Improved algorithm with 50mm tolerance, blue polygon fill (#bae6fd @ 0.5 opacity) | ✅ |
| 3 | **Wall Length Extension (Edge Drag)** | Enlarged endpoint handles (12px), `findSpecificWallEndpoint` for select mode | ✅ |
| 4 | **ESC Key Universal Cancel** | Cancels drawing, dimension edit, drag, deselects, returns to Select tool | ✅ |

**Technical Fixes:**
- **Grid Transform**: `patternTransform={translate(${panOffset.x}, ${panOffset.y})}` on both grid patterns
- **Floor Detection**: `COORD_TOLERANCE = 50mm` for endpoint matching, handles partial overlaps
- **Endpoint Click**: `findSpecificWallEndpoint()` with `ENDPOINT_HANDLE_SIZE * 2.5 / scale` threshold
- **ESC Handler**: Resets `isDrawing`, `editingDimension`, `isDragging`, `selectedItem`, `tool`, all panels

**Verification (iteration_66.json):** 100% pass rate - All 4 CAD interaction fixes verified working.

---

## Previous Status: Composer CAD-Level Drafting Enhancements COMPLETE ✅
**As of February 12, 2026**

### Composer (SpatialBOQCanvas) - 7 CAD-Level Drafting Enhancements

All 7 CAD-level drafting corrections have been implemented and verified for production-grade drafting.

| # | Enhancement | Description | Status |
|---|-------------|-------------|--------|
| 1 | **True Canvas Pan** | Grid + plan move together. Middle mouse drag OR Spacebar+drag | ✅ |
| 2 | **Wall Edge Extension + Snap** | Drag wall endpoints to resize, auto-snap at 90° corners (150mm threshold) | ✅ |
| 3 | **Auto Floor Detection** | Closed wall loops auto-detect polygon, show blue floor fill | ✅ |
| 4 | **Door & Window Rotation** | Rotate (90° steps) and Flip buttons in properties panel, SVG transform applied | ✅ |
| 5 | **Wall Thickness Control** | Editable per wall (50-500mm range, default 150mm), reflects in visual stroke | ✅ |
| 6 | **Inline Dimension Editing** | Click dimension text on plan → inline input → Enter to apply, instant resize | ✅ |
| 7 | **Undo/Redo** | Ctrl+Z/Ctrl+Y shortcuts + toolbar buttons, 50-step history | ✅ |

**New CAD Features:**
- **Endpoint Handles**: Blue circular handles on selected walls for resize
- **Floor Polygon**: Light blue shaded area when walls form closed room
- **Transform Controls**: Rotate 90°, Flip Horizontal buttons for doors/windows
- **Thickness Input**: Min 50mm, Max 500mm, Step 10mm
- **Inline Edit**: Click "3000mm" text → type new value → Enter
- **History**: saveToHistory() called on wall draw, module add, delete, rotate, thickness change

**Verification (iteration_65.json):** 100% pass rate - All 7 CAD enhancements verified working.

---

## Previous Status: Composer Pan/Zoom/Elevation UX COMPLETE ✅
**As of February 11, 2026**

### Composer (SpatialBOQCanvas) - 3 Navigation & Editing Enhancements

All 3 UX enhancements for navigation and elevation editing have been implemented and verified.

| # | Enhancement | Description | Status |
|---|-------------|-------------|--------|
| 1 | **Canvas Pan/Background Movement** | Middle mouse drag OR Spacebar+left drag to pan canvas | ✅ |
| 2 | **Zoom Controls** | Scroll wheel zoom (cursor-centered), Ctrl+/Ctrl-/Ctrl+0, FIT button, zoom indicator | ✅ |
| 3 | **Editable 2D Elevation View** | SVG-based elevation with draggable modules, syncs position/height to plan | ✅ |

**New Controls:**
- **Pan**: Middle mouse button drag, OR hold Spacebar + left drag
- **Zoom In**: Scroll up, Ctrl + Plus, or zoom button
- **Zoom Out**: Scroll down, Ctrl + Minus, or zoom button
- **Reset Zoom**: Ctrl + 0, or FIT button
- **Zoom Indicator**: Shows current zoom % in top-right corner
- **Elevation Drag**: Modules draggable horizontally (within wall) and vertically (0-2400mm height)

**Verification (iteration_64.json):** 100% pass rate - All 3 navigation enhancements verified working.

---

## Previous Status: Composer Spatial Interaction Enhancements COMPLETE ✅
**As of February 11, 2026**

### Composer (SpatialBOQCanvas) - 10 Spatial Interaction Enhancements

All 10 UX/spatial interaction enhancements requested by user have been implemented and verified.

| # | Enhancement | Description | Status |
|---|-------------|-------------|--------|
| 1 | **Wall Edit & Movement** | Click wall to select, drag to reposition, endpoint handles for resizing | ✅ |
| 2 | **Magnetic Snap (Module→Wall)** | Modules auto-snap flush to walls when placed nearby (100mm threshold) | ✅ |
| 3 | **Magnetic Corner Join (Walls)** | New walls snap to existing corners for clean joins (150mm threshold) | ✅ |
| 4 | **Wall Drawing Options Panel** | Rectangle Room, Square Room, Free Line Draw modes | ✅ |
| 5 | **Door & Window Library** | Selectable types: Single/Double/Sliding/Pocket/French doors, Standard/Large/Small windows | ✅ |
| 6 | **Door/Window Movement** | Drag along walls, arrow keys to slide, transferable between walls | ✅ |
| 7 | **Module→Wall Pinning Fix** | Auto-binds to nearest wall, green indicator, elevation view detects correctly | ✅ |
| 8 | **Carcass Finish Field** | New property: Laminate, PU White, PU Colored, Melamine, Veneer, Raw | ✅ |
| 9 | **Elevation View Enhancement** | Full-screen 2D wall elevation modal with ceiling/floor markers | ✅ |
| 10 | **Edge Cleanup** | Sharp square corners (strokeLinecap="square"), no rounded/oval joints | ✅ |

**New Features Added:**
- **Wall Draw Modes**: Rectangle (4 walls), Square (equal sides), Free line
- **Door Types**: Single Swing (900×2100), Double Swing (1500×2100), Sliding (1200×2100), Pocket (900×2100), French (1800×2100)
- **Window Types**: Standard (1200×1200), Large (1800×1500), Small (600×600), Floor to Ceiling (1500×2400), Bay (2000×1200)
- **Carcass Finishes**: Laminate, PU White, PU Colored, Melamine, Veneer, Raw/Unfinished

**Verification (iteration_63.json):** 100% pass rate - All 10 spatial enhancements verified working.

---

## Previous Status: Composer UX Improvements COMPLETE ✅
**As of February 11, 2026**

### Composer (SpatialBOQCanvas) - 9 UX Improvements

All 9 UX enhancements implemented and verified.

| # | UX Improvement | Description | Status |
|---|----------------|-------------|--------|
| 1 | **Collapsible Panels** | Left (module library) and right (properties) panels can be collapsed via toggle buttons | ✅ |
| 2 | **Editable Wall Dimensions** | Wall properties panel shows editable Length (mm) input that updates wall on canvas | ✅ |
| 3 | **Door/Window Placement** | Door tool (brown) and Window tool (cyan) add openings near walls | ✅ |
| 4 | **2D Elevation View** | Shows when wall selected - displays modules on wall with height visualization | ✅ |
| 5 | **Keyboard Navigation** | Arrow keys move selected module, Delete/Backspace removes items | ✅ |
| 6 | **Live Pricing Header** | Real-time Modules count, Area (sqft), Est. Cost (₹) in header | ✅ |
| 7 | **Movement Hint** | Tooltip when module selected: "Drag to move • Arrow keys • Delete to remove" | ✅ |
| 8 | **Carcass Material Selection** | Dropdown: BWR Plywood 710, MR Plywood 303, HDHMR, Particle Board, MDF | ✅ |
| 9 | **Direct Dimension Inputs** | Properties panel with W/H/D (mm) inputs + X/Y position controls | ✅ |

**Verification (iteration_62.json):** 100% pass rate.

---

## Previous Status: Spatial BOQ Canvas (Composer) Phase 1 COMPLETE ✅
**As of February 11, 2026**

### 2D Spatial Layout Canvas for Modular Planning

A visual 2D measured layout canvas (Light CAD) for modular kitchen/wardrobe planning.

| Feature | Description | Status |
|---------|-------------|--------|
| **Canvas Type** | 2D SVG-based canvas with grid, wall drawing, module placement | ✅ |
| **Wall Drawing** | Draw room walls with dimensions (horizontal/vertical, snaps) | ✅ |
| **Module Library** | 10 module types: Base Cabinet, Wall Cabinet, Tall Unit, Loft Unit, Hob, Chimney, Microwave Unit, Oven Unit, Dishwasher, Sink Unit | ✅ |
| **Module Placement** | Drag from library, place on canvas, snap to walls | ✅ |
| **Dimensions** | Capture W×H×D per module with manual resizing | ✅ |
| **Finish Types** | Laminate, Acrylic, PU Paint, Veneer, Membrane, Glass with sqft rates | ✅ |
| **Shutter Types** | Flat, Profile, Glass, Handleless, Shaker with price multipliers | ✅ |
| **Auto-Calculation** | Total wall length (mm), cabinet length, area (sqft), material consumption, estimated cost | ✅ |
| **BOQ Integration** | Generate modular BOQ line items from placed modules | ✅ |
| **Export** | PNG export of layout (top-view) | ✅ |

**Route:** `/projects/{project_id}/spatial-boq`

**API Endpoints:**
- `GET /api/spatial/module-library` - Module types, finish types, shutter types
- `GET /api/projects/{project_id}/spatial-layout` - List layouts
- `POST /api/projects/{project_id}/spatial-layout` - Create layout with walls/modules
- `PUT /api/projects/{project_id}/spatial-layout/{layout_id}` - Update layout
- `POST /api/projects/{project_id}/spatial-layout/{layout_id}/generate-boq` - Generate BOQ items
- `GET /api/projects/{project_id}/modular-boq` - Get generated modular BOQs

**Pricing (Rate Card):**
| Finish | Rate/sqft |
|--------|-----------|
| Laminate | ₹450 |
| Acrylic | ₹850 |
| PU Paint | ₹1,200 |
| Veneer | ₹950 |
| Membrane | ₹550 |
| Glass | ₹750 |

**Verification (iteration_61.json):** 100% pass rate (19/19 backend tests + all frontend UI verified)

---

## Previous Status: BOQ Builder (Phase-1) COMPLETE ✅
**As of February 11, 2026**

### Bill of Quantities (BOQ) Builder - Table Model

A room-wise BOQ workspace accessible from Project → Commercial section.

| Feature | Description | Status |
|---------|-------------|--------|
| **Entry Point** | Project Details → BOQ Section → "Create BOQ" / "Open BOQ" button | ✅ |
| **Default Rooms** | 10 pre-populated rooms: Kitchen, Living Room, Dining Room, Master Bedroom, Bedroom 2, Bedroom 3, Wardrobes, TV Unit, Wall Paneling, Misc/Custom | ✅ |
| **Room Operations** | Add Room, Rename Room, Delete Room | ✅ |
| **Item Table** | Item Name, Description, Dimensions (W×H×D), Qty, Unit, Unit Price, Total | ✅ |
| **Item Operations** | Add Item, Duplicate Item, Delete Item with inline editing | ✅ |
| **Units Supported** | sqft, rft, nos, set, lump sum | ✅ |
| **Auto-Calculation** | quantity × unit_price = total, room subtotals, grand total | ✅ |
| **Status Control** | Draft → Under Review → Locked (with permission checks) | ✅ |
| **Version History** | Track versions with editor name, timestamp, change notes | ✅ |
| **Financial Integration** | BOQ summary exposed to Project Details (read-only) | ✅ |
| **Canvas UI** | Room cards, sticky grand total footer, clean enterprise style | ✅ |

**Route:** `/projects/{project_id}/boq`

**API Endpoints:**
- `GET /api/projects/{project_id}/boq` - Get or create BOQ with default rooms
- `PUT /api/projects/{project_id}/boq` - Save BOQ with auto-calculated totals
- `POST /api/projects/{project_id}/boq/rooms` - Add new room
- `DELETE /api/projects/{project_id}/boq/rooms/{room_id}` - Delete room
- `PUT /api/projects/{project_id}/boq/status` - Status transitions
- `GET /api/projects/{project_id}/boq/versions` - Version history
- `GET /api/projects/{project_id}/boq/summary` - Summary for project details

**Permissions:**
- Designers → Create & Edit Draft
- Design Manager → Review & Move to Under Review
- Admin / Founder → Lock BOQ

**Verification (iteration_60.json):** 100% pass rate (22/22 backend tests + all frontend UI verified)

---

## Previous Status: Employee Classification Feature COMPLETE ✅
**As of February 11, 2026**

### Functional Employee Classification

The Employee Classification system is now **fully functional** with enforced business logic:

| Feature | Description | Status |
|---------|-------------|--------|
| **Classification Types** | 5 types: permanent, probation, trainee, freelancer, channel_partner | ✅ |
| **Salary Eligibility** | Only permanent & probation employees can receive salary payments | ✅ ENFORCED |
| **Stipend Routing** | Only trainee employees can receive stipend payments | ✅ ENFORCED |
| **Incentive Eligibility** | Only permanent, probation, trainee employees eligible; freelancer/channel_partner must use Commission | ✅ ENFORCED |
| **Statutory Deductions** | Auto-calculated PF/ESI for permanent/probation; exempt for trainee/freelancer/channel_partner | ✅ ENFORCED |
| **Salary Cycles Filter** | GET /api/finance/salary-cycles now filters to salary-eligible employees only | ✅ |
| **Classification UI** | New "Classifications" tab in Salaries page with summary cards, workflow rules, change modal, history | ✅ |

**Payment Workflow Rules (Enforced):**
| Classification | Payment Method | Statutory Deductions | Can Receive |
|----------------|----------------|----------------------|-------------|
| Permanent | Salary | PF, ESI, Professional Tax (auto-calculated) | Salary, Incentives |
| Probation | Salary | PF, ESI (auto-calculated) | Salary, Incentives |
| Trainee | Stipend | None (exempt) | Stipend, Incentives |
| Freelancer | Commission | None (exempt) | Commission only |
| Channel Partner | Commission | None (exempt) | Commission only |

**New API Endpoints:**
- `GET /api/hr/classification-summary` - Breakdown with workflow guidance
- `GET /api/hr/employees/{user_id}/classification-history` - Change history log
- `PUT /api/hr/employees/{user_id}/classification` - Update with history tracking

**Verification (iteration_59.json):** 100% pass rate (18/18 backend + all frontend tests)

---

## Previous Status: Employee Compensation & Payout Architecture COMPLETE ✅
**As of February 11, 2026**

### Unified Compensation System

| Component | Features | Status |
|-----------|----------|--------|
| **Salary Deductions** | 10 deduction types (leave, late attendance, loss recovery, advance recovery, penalty, TDS, PF, ESI, professional tax, custom) with proper ledger mapping | ✅ |
| **Employee Classifications** | 5 types: permanent, probation, trainee, freelancer, channel_partner - drives payroll logic | ✅ |
| **Stipend Management** | Trainee stipends without statutory deductions, classified as Training/HR Development Expense | ✅ |
| **Incentive Engine** | Project-linked incentives (booking, 50% collection, completion, review) with create/approve/payout flow | ✅ |
| **Commission Management** | External commissions for referrals, channel partners, associates with payout tracking | ✅ |
| **Employee Earnings View** | Unified view of salary, incentives (earned/paid/pending), and deductions | ✅ |
| **Cashbook/Daybook** | Net salary only in cashbook, proper ledger entries for all deduction types | ✅ |
| **Compliance Ready** | TDS, PF, ESI, Professional Tax fields exist (can be inactive) | ✅ |

**Ledger Impact Mapping:**
| Deduction Type | Ledger Impact |
|----------------|---------------|
| Leave/Penalty | Expense reduction |
| Advance Recovery | Employee receivable cleared |
| Loss Recovery | Company income/adjustment |
| TDS/PF/ESI | Statutory payable |

**Verification (iteration_58.json):** 100% pass rate (20/20 backend + all frontend tests)

---

## Previous Status: Cash Lock UI Fix VERIFIED ✅
**As of February 11, 2026**

### Latest Fix: Cash Lock UI Rendering

| Issue | Description | Fix | Status |
|-------|-------------|-----|--------|
| **UI Disappeared** | Cash Lock section disappeared after financial baseline patch | Added backward compatibility aliases (`outflow_count`, `outflow_commitment`) in backend response to match frontend field expectations | ✅ VERIFIED |

**Root Cause:** Field name mismatch - frontend expected `outflow_count` but backend returned `execution_invoice_count`

**Verification (iteration_57.json):** All tests passed
- API returns `outflow_count` field ✅
- UI renders Cash Lock section for signed-off projects ✅
- All metrics display correctly (Total Received, Locked, Commitments, Safe to Use) ✅

---

## Previous Status: Cash Lock Booking Advance Reclassification VERIFIED ✅
**As of February 11, 2026**

### Latest Fix: Advance Cash Lock - Booking Advance Handling

| Issue | Description | Fix | Status |
|-------|-------------|-----|--------|
| **Booking Advance Exclusion** | Cash Lock was incorrectly including booking advances before project sign-off | Before Sign-off: Booking advances EXCLUDED (Total Received = 0). After Sign-off: ALL receipts auto-reclassified as execution liquidity | ✅ VERIFIED |

**Reclassification Logic:**
- `signoff_locked = false` → No receipts count (booking advances excluded)
- `signoff_locked = true` → ALL receipts become execution liquidity (auto-reclassify)
- Historical receipt records are NOT modified - reclassification is calculation-only

**Verification (iteration_56.json):** 9/9 tests passed
- Signed-off project includes ALL receipts ✅
- Non-signed-off project excludes booking advances ✅
- Safe to Use calculated correctly after sign-off ✅
- Historical receipts preserved (no data modification) ✅

---

## Previous Status: Finance Widget Alignment VERIFIED ✅
**As of February 11, 2026**

### Latest Fixes: Revenue Baseline & Liability Calculation

| Issue | Description | Fix | Status |
|-------|-------------|-----|--------|
| **Revenue Baseline Mismatch** | Financial Summary and Profit Visibility were pulling from different sources | Both widgets now use `signoff_value` as single baseline. `get_project_profit` updated to use signoff_value and exclude non-cashbook entries from actual_cost | ✅ VERIFIED |
| **Remaining Liability Calculation** | Was incorrectly calculated as planned-actual | Now pulls from `finance_liabilities` collection (status: open OR partially_settled). Ensures no negative values | ✅ VERIFIED |

**Correct Mapping Applied:**
- Projected Profit = Sign-off Locked Value – Planned Cost
- Realised Profit = Sign-off Collected Amount – Actual Cost
- Execution Margin = Based only on Sign-off Locked Value
- Remaining Liability = Sum of `amount_remaining` from open/partially_settled liabilities

**Verification (iteration_54.json):** 13/13 tests passed
- Both widgets use same `signoff_value` baseline ✅
- `remaining_liability` from `finance_liabilities` collection ✅
- Liability includes both `open` and `partially_settled` status ✅
- No negative liability values ✅

---

## Previous Status: Financial Mapping Fix VERIFIED ✅
**As of February 10, 2026**

### Latest Fix: Financial Value Mapping in Project Finance

| Issue | Description | Fix | Status |
|-------|-------------|-----|--------|
| **Contract Value Mapping** | "Contract Value" was pulling Presales Budget instead of Sign-off Locked BOQ value | Implemented proper value lifecycle: `presales_budget` → `booked_value` → `signoff_value`. Changed label to "Sign-off Value" and use `signoff_value` for all profit calculations | ✅ VERIFIED |

**Value Lifecycle Now Correctly Mapped:**
- `presales_budget`: Initial estimate from Lead/Presales
- `booked_value`: Value at Booking/Agreement (locked at first payment)
- `signoff_value`: Final BOQ value (locked at Design Sign-off) - **PRIMARY for financials**

**Verification (iteration_53.json):** 10/10 tests passed
- Backend returns all three value lifecycle fields ✅
- `signoff_value` used for profit calculations ✅
- Backward compatibility maintained (`contract_value` = `signoff_value`) ✅
- Frontend displays "Sign-off Value" label ✅

---

## Previous Status: Purchase→Payment Double-Posting Bug FIX VERIFIED ✅
**As of February 10, 2026**

### Credit Purchase Double-Posting Bug (P0 Critical)

| Issue | Description | Fix | Status |
|-------|-------------|-----|--------|
| **Double-Posting Bug** | Credit purchases were being counted twice in `actual_cost` - once on invoice creation and again on payment | Modified query filters in `get_project_finance_detail` and `get_daily_summary` to exclude entries with `is_cashbook_entry=False`. Credit purchase daybook entries now set `is_cashbook_entry=False`, only liability settlement creates cashbook entry with `is_cashbook_entry=True` | ✅ VERIFIED |

**Verification (iteration_52.json):** 20/20 tests passed

---

## Previous Status: Finance Module P0, P1, P2 & P3 Bug Fixes COMPLETE ✅
**As of February 6, 2026**

### Finance Module Critical Bug Fixes

#### P0 - Ledger Integrity (Critical Accounting Accuracy) ✅

| Issue | Fix | Status |
|-------|-----|--------|
| **Invoice & Receipt Duplication** | Added idempotency key support + 60-second duplicate detection | ✅ |
| **Credit Purchase in Cashbook** | Added `is_cashbook_entry=False` flag, excluded from cashbook queries | ✅ |
| **Purchase Return Refund Direction** | Verified as INFLOW when status=completed (vendor returns money to us) | ✅ |
| **Refund Module Status Lifecycle** | Implemented initiated→pending→completed flow, only "completed" posts to ledger | ✅ |

#### P1 - Financial Structure & Control ✅

| Issue | Fix | Status |
|-------|-----|--------|
| **Bank Account Duplication** | Case-insensitive name check + bank/branch duplicate detection | ✅ |
| **Account Deletion/Archive** | Soft delete (archive) by default, hard delete only if no transactions | ✅ |
| **Purchase Return Status Lifecycle** | Implemented full lifecycle: initiated→vendor_accepted→refund_pending→refund_received→completed | ✅ |

#### P2 - System Accuracy & Reporting ✅

| Issue | Fix | Status |
|-------|-----|--------|
| **Date & Time Incorrect System-Wide** | Created local timezone utility functions (`getLocalDateString`, `formatDateLocal`), updated CashBook and DailyClosing pages | ✅ |
| **Purchase Return Reflection in Reports** | Profitability report now includes `purchase_refunds`, `net_actual_cost`, `total_purchase_refunds`, `total_net_cost` fields | ✅ |

#### P3 - UI & Usability Enhancements ✅

| Issue | Fix | Status |
|-------|-----|--------|
| **Unit Dropdown Additions** | Added 'box' and 'packet' to UNITS array in ExecutionLedger.jsx | ✅ |
| **Purchase Invoice Add Item Button** | Added 'Add Another Item' button at bottom of line items list for better UX | ✅ |

**Testing:** ✅ All tests passed
- iteration_46.json: P0/P1 backend tests (18/18 passed)
- iteration_47.json: P2 backend + frontend tests (15/15 + 3/3 passed)
- iteration_48.json: P3 frontend tests (7/7 passed)

---

### Previous Status: P0, P1 & P2 Fixes

#### Purpose
Dedicated review queue page for Design Managers combining all approval items in one place.

#### Three Queue Sections
| Section | Description | Priority Rules |
|---------|-------------|----------------|
| **Pending My Approval** | Design submissions + Timeline overrides awaiting review | Overdue first, then due soon |
| **Overdue Reviews** | Submissions past their deadline | Days overdue: >5=critical, >2=high |
| **Upcoming Meetings** | Client meetings in next 14 days needing approval | ≤2 days=critical, ≤5=high, ≤10=medium |

#### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/design-manager/review-queue` | GET | Comprehensive queue with all pending items + stats |
| `/api/design-manager/upcoming-meetings` | GET | Meetings in next N days (default 14) needing approval |
| `/api/design-manager/overdue-reviews` | GET | Past-due submissions with days_overdue |

#### Frontend: DesignReviewQueue Page
- **Route**: `/design-review-queue`
- **Stats Cards**: Pending Designs, Timeline Approvals, Upcoming Meetings, Total Actions
- **5 Tabs**: All Items, Design Submissions, Timelines, Upcoming Meetings, Overdue
- **Empty State**: "All Caught Up!" when no pending items
- **Sidebar Access**: Admin, DesignManager, Founder roles

#### Urgency Levels for Upcoming Meetings
- **Critical**: ≤2 days until meeting (red highlight)
- **High**: 3-5 days (orange)
- **Medium**: 6-10 days (amber)
- **Low**: >10 days (default)

**Testing:** ✅ All tests passed (iteration_45.json) - Backend 100%, Frontend 100%

---

## Previous Status: Design Approval Gate Phase 1 COMPLETE ✅
**As of February 5, 2026**

### NEW: Design Approval Gate (Phase 1)

#### Purpose
Mandatory manager approval workflow before client presentations. Ensures quality control and governance over design deliverables.

#### Gated Milestones
| Milestone Key | Display Name | Stage |
|---------------|--------------|-------|
| `design_meeting_2` | Design Meeting 2 (3D Concept Freeze) | 3D Design |
| `design_meeting_3_final` | Design Meeting 3 (Final Design Freeze) | Final Design |
| `pre_production_signoff` | Pre-Production Sign-Off | Production Handover |

**Note:** Design Meeting 1 (Floor Plan Discussion) does NOT require approval.

#### Submission Structure
Each submission includes:
- **Files**: Renders, drawings, PDFs (stored with file_id, name, url, type)
- **Checklist**: 6 required items per milestone (budget alignment, materials, scope, etc.)
- **Design Notes**: Concept explanation and key decisions (required)
- **Concept Summary**: Client-facing summary (optional)
- **Constraints Notes**: Limitations and special considerations (optional)

#### Data Model: `design_submissions` Collection
```json
{
  "submission_id": "DS-xxx",
  "project_id": "proj_xxx",
  "milestone_key": "design_meeting_2",
  "version": 1,
  "status": "pending_review | approved | revision_required | rejected | withdrawn",
  "is_locked": true,
  "files": [...],
  "checklist": [...],
  "design_notes": "...",
  "submitted_by": "user_id",
  "submitted_at": "datetime",
  "deadline": "2026-02-10",
  "is_overdue": false,
  "reviewed_by": "user_id",
  "reviewed_at": "datetime",
  "review_notes": "...",
  "improvement_areas": []
}
```

#### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/design-approval/gated-milestones` | GET | Get list of gated milestones |
| `/api/design-approval/checklist/{key}` | GET | Get checklist template |
| `/api/projects/{id}/design-submissions` | POST | Create submission |
| `/api/projects/{id}/design-submissions` | GET | List submissions |
| `/api/projects/{id}/design-submissions/{sid}` | GET | Get submission details |
| `/api/projects/{id}/design-submissions/{sid}/review` | PUT | Approve/reject |
| `/api/design-submissions/pending-approvals` | GET | Manager queue |
| `/api/projects/{id}/design-approval-status` | GET | Status for all gates |

#### Milestone Gate Integration
- Completion of gated milestones blocked until approved submission exists
- Clear error messages: "pending review" vs "not submitted"
- Admin/Founder can override with logging
- Rejection returns to "revision_required" status with mandatory notes

#### Frontend Components
| Component | Location | Features |
|-----------|----------|----------|
| `DesignApprovalPanel` | ProjectDetails.jsx | Milestone cards, submit modal, review for managers |
| `DesignSubmissionsQueue` | DesignManagerDashboard.jsx | Pending queue with deadline tracking |

#### Workflow
```
Designer submits → Status: pending_review, Milestone: locked
                        ↓
Manager reviews:
  - Approve → Status: approved, Milestone: can_complete
  - Reject → Status: revision_required, Milestone: unlocked for resubmission
```

**Testing:** ✅ All tests passed (iteration_44.json) - Backend 100%, Frontend 100%

---

## Previous Status: Timeline Intelligence Engine COMPLETE ✅
**As of February 5, 2026**

### NEW: Timeline Intelligence Engine

#### Purpose
System-generated tentative timeline engine for interior design projects. Replaces manual timeline creation with intelligent, factor-based calculations.

#### Key Features
1. **Auto-Generation**: System generates timeline when project is booked
2. **7 Calculation Factors**: Scope, skill, workload, tier, priority, manager capacity, client buffer
3. **11 Milestones**: Including 2 internal review checkpoints
4. **Override Workflow**: Designer proposes → Manager approves/rejects
5. **Customer Sharing**: Only approved timelines can be shared externally
6. **Sequential Control**: Only one pending override at a time

#### Data Model: `project_timelines` Collection
```json
{
  "timeline_id": "TL-xxx",
  "project_id": "proj_xxx",
  "scope_type": "3bhk",
  "project_tier": "premium",
  "priority_tag": "vip",
  "versions": [{
    "version": 1,
    "type": "system_generated | manual_override",
    "status": "pending_approval | approved | rejected | superseded",
    "milestones": [...],
    "calculation_inputs": {...},
    "created_by": "system | user_id",
    "reviewed_by": "user_id (manager)",
    "reviewed_at": "datetime"
  }],
  "active_version": 1,
  "is_shared_with_customer": true/false
}
```

#### Calculation Factors
| Factor | Range | Impact |
|--------|-------|--------|
| Scope Complexity | Studio (×0.6) → Luxury Villa (×1.8) | Project size |
| Designer Skill | Junior (×1.4) → Architect (×0.85) | Productivity |
| Designer Workload | Low (×1.0) → Overloaded (×1.5) | Capacity |
| Project Tier | Standard (×1.0) → Luxury (×1.5) | Revision buffer |
| Priority Tag | Normal (×1.0) → Fast-Track (×0.75) | Timeline compression |
| Manager Capacity | Light (+1 day) → Overloaded (+5 days) | Review buffer |
| Client Buffer | +2 days | Meeting coordination |

**Combined Multiplier** = scope × skill × workload × tier × priority

#### 11 Milestones
| # | Milestone | Customer-Facing |
|---|-----------|-----------------|
| 1 | Site Measurement | ✅ |
| 2 | Internal Design Review 1 | ❌ |
| 3 | Design Meeting 1 | ✅ |
| 4 | Internal Design Review 2 | ❌ |
| 5 | Design Meeting 2 | ✅ |
| 6 | Design Meeting 3 (Final) | ✅ |
| 7 | Material Selection & Confirmation | ✅ |
| 8 | Payment & Order Confirmation | ✅ |
| 9 | Site Validation | ✅ |
| 10 | GFC Approval (Internal) | ❌ |
| 11 | Order Sign-Off Meeting | ✅ |

#### New API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/timeline-config/options` | GET | Get dropdown options (scopes, tiers, priorities, skills) |
| `/api/projects/{id}/timeline/generate` | POST | Generate system timeline |
| `/api/projects/{id}/timeline` | GET | Get current timeline with active/pending versions |
| `/api/projects/{id}/timeline/override` | POST | Request timeline override |
| `/api/projects/{id}/timeline/review` | PUT | Approve/reject timeline (Manager) |
| `/api/projects/{id}/timeline/share` | POST | Mark as shared with customer |
| `/api/projects/{id}/timeline/customer-view` | GET | Get customer-facing milestones only |
| `/api/projects/{id}/timeline/history` | GET | Get full version history |
| `/api/timelines/pending-approvals` | GET | Get all pending approvals (Manager) |

#### Frontend Components
| Component | Location | Features |
|-----------|----------|----------|
| `TimelineIntelligencePanel` | ProjectDetails.jsx | Milestones display, calculation modal, override request |
| `TimelineApprovalsPanel` | DesignManagerDashboard.jsx | Pending queue, review modal, approve/reject |

#### User Skill Level
Added `skill_level` field to users:
- `junior` - Junior Designer (×1.4 timeline multiplier)
- `intermediate` - Intermediate Designer (×1.15)
- `senior` - Senior Designer (×1.0)
- `architect` - Architect (×0.85 faster)

**Testing:** ✅ All tests passed (iteration_43.json) - Backend 100%, Frontend 100%

---

## Previous Status: Designer Assignment Tracking COMPLETE ✅
**As of February 4, 2026**

### NEW: Designer Assignment Tracking System

#### Purpose
Handle mid-project designer changes without losing accountability. Fair attribution without rewriting history.

#### Data Model: `designer_assignments` Collection
```json
{
  "assignment_id": "uuid",
  "project_id": "proj_xxx",
  "designer_id": "user_xxx",
  "role": "Primary | Support",
  "assigned_from": "ISO datetime",
  "assigned_to": "null (active) | ISO datetime (ended)",
  "assignment_reason": "initial | reassigned | resigned | escalation | workload_balance",
  "end_reason": "reassigned | resigned | escalation | project_complete",
  "assigned_by": "user_id",
  "notes": "optional"
}
```

#### Business Rules
1. **Only one active Primary per project** at any time
2. **Assignments are never deleted** - only ended (soft delete)
3. **Attribution at Sign-Off**: Primary designer at time of sign-off owns KPIs
4. **Attribution at Cancellation**: Primary designer at cancellation owns KPIs
5. **Active Projects**: Attributed to current Primary designer

#### New API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/{id}/designer-assignments` | GET | Get full assignment history |
| `/api/projects/{id}/designer-assignments` | POST | Assign/reassign designer |
| `/api/projects/{id}/designer-assignments/{aid}/end` | PUT | End an assignment |
| `/api/designer-assignment-options` | GET | Get roles and reasons |

#### Frontend UI: Designer Assignment Panel ✅ (NEW)
**Location:** Project Details → Team Tab
**Component:** `DesignerAssignmentPanel.jsx`

**Features:**
- Shows current Primary Designer with badge and assignment date
- "Assign Designer" button opens modal with Designer/Role/Reason dropdowns
- Warning when replacing current Primary designer
- Collapsible Assignment History showing all past assignments
- Attribution Rules info box explaining KPI ownership
- "End" button for each active assignment

#### Dashboard Attribution Logic (Updated)
- **Designer Performance Dashboard** now uses proper attribution:
  - Sign-Off projects → Primary at sign-off time
  - Cancelled projects → Primary at cancellation time  
  - Active projects → Current Primary

#### Migration Script
- **Path:** `/app/backend/scripts/migrate_designer_assignments.py`
- **Purpose:** Creates initial assignments for existing projects with `primary_designer_id`
- **Status:** ✅ Executed successfully

---

### Implemented: Three Role-Based, Purpose-Driven Dashboards

#### 1. Finance Dashboard (Sign-Off Value ONLY) ✅
**Access:** Finance roles + Admin + Founder
**Route:** `/finance/dashboard`
**API:** `GET /api/dashboards/finance`

| Metric | Description |
|--------|-------------|
| Sign-Off Value | Total from `signoff_value` (locked projects only) |
| Amount Collected | Sum of receipts by project |
| Pending | Sign-Off Value - Collected |
| Collection % | Collected / Sign-Off Value |

**Features:**
- Clear "Sign-Off Value Only" indicator with tooltip
- Financial Year default (Apr-Mar), with MTD/QTD/Custom options
- Project-wise payment status table
- Excludes cancelled projects

#### 2. Sales & Funnel Analysis Dashboard ✅
**Access:** Admin, Founder, SalesManager
**Route:** `/finance/sales-dashboard`
**API:** `GET /api/dashboards/sales?designer_id=xxx`

| Metric | Description |
|--------|-------------|
| Inquiry Value | Total from leads + projects (with counts) |
| Booked Value | Locked at first payment (with counts) |
| Sign-Off Value | Final contract value (with counts) |
| Cancelled Value | Lost value from cancellations (with counts) |
| Conversion Rates | Inquiry→Booked %, Booked→Sign-Off % |
| Value Changes | Absolute and % change between stages |

**Features:**
- Full value lifecycle tracking (Inquiry → Booked → Sign-Off)
- Visual conversion funnel with counts
- Value change analysis (drop/gain between stages)
- Stage-wise breakdown (collapsible)
- Cancelled projects list with reasons
- Period filtering: FY, MTD, QTD, Custom Range
- Tooltips explaining each value source

#### 3. Designer Performance Dashboard ✅ (NEW)
**Access:** Admin, Founder, DesignManager
**Route:** `/finance/designer-dashboard`
**API:** `GET /api/dashboards/designer`

| Metric | Description |
|--------|-------------|
| Total Booked Value | Team total from booked projects |
| Total Sign-Off Value | Team total from finalized contracts |
| Net Value Change | Sign-Off minus Booked (team) |
| Active Designers | Designers with projects |
| Per-Designer Metrics | Booked/Sign-Off/Net Change/Retention |

**Features:**
- Team summary cards
- Designer-wise performance breakdown (expandable rows)
- Monthly trend breakdown per designer (time-based performance)
- Project list per designer
- Retention rate (non-cancelled / total)
- Value contribution percentage
- Period filtering: FY, MTD, QTD, Custom Range with custom date inputs
- Tooltips explaining value sources

### New API Endpoints (Dashboards)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboards/finance` | GET | Finance Dashboard (Sign-Off Only) |
| `/api/dashboards/sales` | GET | Sales & Funnel Analysis Dashboard |
| `/api/dashboards/designer` | GET | Designer Performance Dashboard |
| `/api/projects/{id}/cancel` | POST | Cancel project with reason |
| `/api/cancellation-reasons` | GET | Get cancellation reasons list |

### Dashboard Data Sources (NON-NEGOTIABLE)
| Dashboard | Data Source | Excludes |
|-----------|-------------|----------|
| Finance | `signoff_value` ONLY | inquiry_value, booked_value, cancelled |
| Sales & Funnel | inquiry_value, booked_value, signoff_value | None (shows all including cancelled) |
| Designer | booked_value, signoff_value per primary_designer_id | None (shows all including cancelled) |

### New Data Model Fields
| Field | Purpose |
|-------|---------|
| `primary_designer_id` | Single accountable owner (locked after booking) |
| `primary_designer_name` | Name for display |
| `assigned_presales_id` | Pre-Sales attribution |
| `stage: "Cancelled"` | Explicit cancellation stage |
| `cancellation_reason` | Mandatory dropdown |
| `cancelled_value` | Preserved for funnel analysis |

### Project Cancellation System
- Mandatory reason dropdown
- Captures `cancelled_value` automatically
- Cancelled projects: 
  - ❌ NEVER in Finance Dashboard
  - ✅ ALWAYS in Sales Funnel & Designer dashboards

---

## Previous Status: 4-Stage Value Lifecycle COMPLETE ✅
**As of February 4, 2026**

### Redesigned Project Value System

| Stage | Field | Role | Lock Behavior |
|-------|-------|------|---------------|
| **1. Inquiry Value** | `inquiry_value` | Pre-Sales | Editable until lead converts |
| **2. Booked Value** | `booked_value` | System | Auto-captured at first payment, IMMUTABLE |
| **3. Quotation Value** | `quotation_history[]` | Designer | Versioned, append-only with line items |
| **4. Sign-Off Value** | `signoff_value` | System | Auto-locked at KWS Sign-Off milestone |

### Key Rules (NON-NEGOTIABLE)
1. **Booked Value** = Quotation value at moment first payment is received (auto-locked)
2. **Sign-Off Value** = Auto-locked when "KWS Sign-Off" milestone completes
3. **ONLY signoff_value** is used for financial calculations (revenue, cash flow, reports)
4. Admin can override with reason + full audit trail

### New API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/{id}/value-lifecycle` | GET | Get complete 4-stage value data |
| `/api/admin/migrate-project-values` | POST | Migration for existing projects |
| `/api/projects/{id}/quotation-history` | POST | Add quotation with line items |
| `/api/projects/{id}/lock-contract-value` | POST | Manual sign-off lock (deprecated) |
| `/api/projects/{id}/override-contract-value` | POST | Admin override with audit |

### Migration Completed
- 20 projects migrated
- Projects with locked contract_value → migrated to signoff_value (locked)
- Projects without lock → signoff_value=None (requires manual sign-off)

---

## Previous Status: Exceptions Panel COMPLETE ✅
**As of February 4, 2026**

### Exceptions Panel on Returns Register:
A minimal, text-based panel showing actionable items only:

| Exception Type | Description |
|----------------|-------------|
| Pending Purchase Refunds | With aging (days since return) |
| Pending Sales Refunds | With aging |
| Items Awaiting Disposition | Items with company needing decision |
| Pending Replacements | With priority marker (🔴 for urgent) |
| Unused Vendor Credits | From debit notes |
| Unused Customer Credits | From credit notes |

**Features:**
- Collapsible panel
- Grouped by category
- Click to navigate to relevant return/invoice
- Read-only (no actions inside panel)
- Aging displayed for refunds

**API Endpoint:**
- `GET /api/finance/returns/exceptions` - Returns actionable exceptions

---

## Previous Status: Phase 2 Returns Module COMPLETE ✅
**As of February 4, 2026**

### Phase 2 Features Implemented:

| Feature | Status | Description |
|---------|--------|-------------|
| Item-Level Tracking | ✅ | Each item in a return can have its own disposition status |
| Credit Notes | ✅ | Auto-generate for sales returns, GST adjustment support |
| Debit Notes | ✅ | Auto-generate for purchase returns (vendor owes us) |
| Replacement Workflow | ✅ | Full tracking: pending → processing → dispatched → delivered |
| Loss Tracking | ✅ | Aggregated loss reports by reason, project, vendor/customer |

### New API Endpoints (Phase 2):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/credit-notes` | GET/POST | List and create credit notes |
| `/api/finance/debit-notes` | GET/POST | List and create debit notes |
| `/api/finance/replacement-orders` | GET/POST | List and create replacement orders |
| `/api/finance/replacement-orders/{id}/status` | PUT | Update replacement order status |
| `/api/finance/returns/{id}/item-disposition` | PUT | Update item-level disposition |
| `/api/finance/returns/{id}/loss-summary` | GET | Get loss summary for a return |
| `/api/finance/returns/loss-report` | GET | Aggregated loss report |

### New Frontend Pages (Phase 2):
| Page | Route | Description |
|------|-------|-------------|
| Credit Notes | `/finance/credit-notes` | List, filter, create credit notes |
| Debit Notes | `/finance/debit-notes` | List, filter, create debit notes |
| Replacement Orders | `/finance/replacement-orders` | Track replacement workflow |

### New Database Collections:
- `finance_credit_notes` - Credit notes for sales returns
- `finance_debit_notes` - Debit notes for purchase returns
- `finance_replacement_orders` - Replacement order tracking

**Testing:** ✅ All tests passed (iteration_40.json) - Backend 100%, Frontend 100%

---

## Previous Status: Finance Bug Fixes VERIFIED ✅
**As of February 4, 2026**

All 9 critical finance bug fixes have been verified via automated testing:

| # | Bug Fix | Status |
|---|---------|--------|
| 1 | Purchase Invoice → Liability Auto-Creation | ✅ PASSED |
| 2 | Purchase Invoice → Daybook Entry | ✅ PASSED |
| 3 | Export Permission for Finance Users | ✅ PASSED |
| 4 | GST Project Visibility | ✅ PASSED |
| 5 | Salary Balance Calculation | ✅ PASSED |
| 6 | Daybook/Daily Closing Visibility | ✅ PASSED |
| 7 | Liability Payment Status Tracking | ✅ PASSED |
| 8 | Receipt Creation & Tracking | ✅ PASSED |
| 9 | Founder Role Permissions | ✅ PASSED |

Test file: `/app/backend/tests/test_finance_bug_fixes.py`

---

## Previous Status: Purchase Return & Sales Return Phase 1 MVP - FRONTEND COMPLETE ✅
**As of February 4, 2026**

**Implemented:** Complete Purchase Return and Sales Return system with:
- **Backend APIs**: All CRUD operations for purchase and sales returns ✅
- **Frontend UI**: 
  - `PurchaseReturns.jsx` - List, filter, and create purchase returns ✅
  - `SalesReturns.jsx` - List, filter, and create sales returns with replacement option ✅
  - `ReturnedItemsRegister.jsx` - Aggregated view with summary cards ✅
- **Sidebar Navigation**: Finance submenu includes all three return pages ✅
- **Dual Tracking**: Refund status tracked INDEPENDENTLY from item disposition
- **Refund Status**: pending → partial → completed → no_refund
- **Item Disposition**: returned_to_vendor | with_company_office | with_company_site | scrapped | vendor_rejected | pending_decision
- **Returned Items Register**: Aggregated view of all returns with filters and summary

### New API Endpoints:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/purchase-returns` | POST | Create purchase return |
| `/api/finance/purchase-returns` | GET | List purchase returns |
| `/api/finance/purchase-returns/{id}` | GET | Get specific return |
| `/api/finance/purchase-returns/{id}/refund` | PUT | Update refund status |
| `/api/finance/purchase-returns/{id}/disposition` | PUT | Update item disposition |
| `/api/finance/sales-returns` | POST | Create sales return |
| `/api/finance/sales-returns` | GET | List sales returns |
| `/api/finance/sales-returns/{id}` | GET | Get specific return |
| `/api/finance/sales-returns/{id}/refund` | PUT | Update refund status |
| `/api/finance/sales-returns/{id}/disposition` | PUT | Update item disposition |
| `/api/finance/sales-returns/{id}/replacement` | PUT | Mark replacement delivered |
| `/api/finance/returned-items-register` | GET | Aggregated returns view |
| `/api/finance/execution-ledger` | GET | List all purchase invoices (NEW) |

### Frontend Pages (NEW):
| Page | Route | Description |
|------|-------|-------------|
| Purchase Returns | `/finance/purchase-returns` | List, filter, create purchase returns |
| Sales Returns | `/finance/sales-returns` | List, filter, create sales returns |
| Returned Items Register | `/finance/returned-items-register` | Aggregated view of all returns |

### New Database Collections:
- `finance_returns` - Unified collection for both purchase and sales returns
- `finance_vendor_receivables` - Vendor refunds owed to company
- `finance_customer_payables` - Customer refunds owed by company

---

## Previous Status: System Owner / Founder Implementation COMPLETE ✅

**Implemented:** Protected System Owner account (`sidheeq.arkidots@gmail.com`) with:
- **Permission Bypass**: Founder always has ALL permissions regardless of role settings
- **Protected from modification**: Cannot change role, status, or delete
- **Can manage all users**: Can assign any role/permissions to anyone
- **`is_founder` flag**: Returned in `/auth/me` response for UI awareness

**Founder Credentials (Local Login):**
- Email: `sidheeq.arkidots@gmail.com`
- Password: `founder123`

---

## Previous Status: Lead Timeline Business Logic Fix COMPLETE ✅

**Bug Fixed:** Leads no longer auto-complete "BC Call Done" on creation/conversion. New flow:
1. **Lead starts at "Lead Allocated"** (auto-completed immediately)
2. **BC Call Done** - Designer must manually complete (24h TAT / shows as delayed after)
3. **First BOQ Sent** - Designer must manually complete (48h TAT after BC Call)

**TAT (Time-to-Action) Rules:**
- Lead Allocated: 0 days (immediate, auto-completed)
- BC Call Done: 1 day (24 hours after allocation)
- First BOQ Sent: 2 days (48 hours after BC Call)
- Site Meeting: 2 days after BOQ
- Revised BOQ Shared: 2 days after Site Meeting

---

## ✅ Timeline Adjustment Feature - COMPLETED Feb 2026

**What's Implemented:**
- **Adjust Timeline Modal** - Accessible via button on Lead/Project detail pages
- **Adjustment Types**: Shift remaining milestones, Set new completion date, Mark as On Hold
- **Reason Tracking**: Customer Hold, Customer Delay, Internal Delay, Payment Delay, Vendor Delay, Scope Change, Other
- **Audit Trail**: Full history of all timeline adjustments with user, date, and affected milestones
- **Resume from Hold**: Auto-shifts future dates by hold duration
- **Permission-Gated**: Requires `timeline.adjust` permission (Admin has all permissions)

**Previous Status: Permission System Purification COMPLETE ✅**

Major architectural refactoring completed. Permissions are now the single source of truth for access control across both backend AND frontend. Role Management UI is now available.

**Results:**
- Backend: 199 → 105 role checks (47% reduction, all access gates migrated)
- Frontend: 37 → 14 role checks (62% reduction, all access gates migrated)
- Remaining checks are data-scoping/business logic (appropriately retained)
- **NEW: Role Management UI** - Admins can create, edit, and delete custom roles
- **NEW: Timeline Adjustment** - Adjust Lead/Project timelines with audit trail

---

## ✅ Lead Timeline/Milestone Business Logic Fix - COMPLETED Feb 2026

### Problem Fixed:
Previously, when a Pre-Sales was converted to Lead (or Lead created directly), the system auto-marked "BC Call Done" as completed, breaking SLA/delay tracking.

### Correct Behavior Now:
- [x] **New starting stage: "Lead Allocated"** - Auto-completed on lead creation
- [x] **BC Call Done is PENDING** - Designer must manually mark complete (24h TAT)
- [x] **First BOQ Sent** - 48h TAT after BC Call completion
- [x] **Delay tracking works correctly** - Milestones show "delayed" after TAT expires
- [x] **Pre-Sales conversion** - Also starts at "Lead Allocated"
- [x] **Import/Seed data** - Defaults to "Lead Allocated" stage

### Lead Stage Flow (7 stages):
```
Lead Allocated → BC Call Done → BOQ Shared → Site Meeting → Revised BOQ Shared → Waiting for Booking → Booking Completed
```

### TAT Configuration:
| Milestone | TAT (days) | Description |
|-----------|------------|-------------|
| Lead Allocated | 0 | Immediate, auto-completed on creation |
| BC Call Done | 1 | 24 hours to complete |
| First BOQ Sent | 2 | 48 hours after BC Call |
| Site Meeting | 2 | 2 days after BOQ |
| Revised BOQ Shared | 2 | 2 days after Site Meeting |

### Test Files:
- `/app/backend/tests/test_lead_timeline_milestone.py` - Comprehensive milestone logic tests
- `/app/backend/tests/test_timeline_adjustment.py` - Timeline adjustment API tests

---

## ✅ Timeline Adjustment Feature - Additional Details

### Features Implemented:
- [x] **Adjust Timeline Button** - Visible on Lead and Project detail pages (permission-gated)
- [x] **Timeline Adjustment Modal** - Full UI with reason dropdown, date picker, adjustment options
- [x] **Adjustment Types**:
  - Shift remaining milestones forward by X days
  - Set new expected completion date
  - Mark timeline as "On Hold" (pauses delay calculations)
- [x] **Resume from Hold** - Automatically shifts all future dates by hold duration
- [x] **Timeline History Modal** - View complete audit trail of all adjustments
- [x] **Backend API Endpoints** - POST /api/leads/{id}/adjust-timeline, POST /api/projects/{id}/adjust-timeline
- [x] **History Endpoints** - GET /api/leads/{id}/timeline-history, GET /api/projects/{id}/timeline-history
- [x] **Validation** - Reason and remarks are mandatory, minimum 10 characters for remarks
- [x] **Completed Milestones Protected** - Only future milestones are affected by adjustments

### Timeline Adjustment Permissions:
| Permission Key | Description |
|---------------|-------------|
| `timeline.adjust` | Adjust lead/project timelines and manage holds |

### Timeline Adjustment API Endpoints:
- `POST /api/leads/{lead_id}/adjust-timeline` - Adjust lead timeline
- `GET /api/leads/{lead_id}/timeline-history` - Get lead adjustment history
- `POST /api/projects/{project_id}/adjust-timeline` - Adjust project timeline
- `GET /api/projects/{project_id}/timeline-history` - Get project adjustment history

### Test File:
- `/app/backend/tests/test_timeline_adjustment.py` - Comprehensive API tests

---

## ✅ Verified & Stable Features

### Core Pipeline (DO NOT MODIFY)
- **Pre-Sales → Lead → Project** workflow is fully functional
- **PID (Project ID)** persists correctly throughout the lifecycle
- **Milestone progression** saves and restores correctly on navigation

### Authentication
- [x] Google OAuth login via Emergent Auth
- [x] Local email/password login for testing
- [x] Session management with httpOnly cookies

### User Management & Permissions (Updated Feb 2026)
- [x] Fine-grained permission-based access control
- [x] Admin can create new users with local passwords
- [x] Admin can assign specific permissions to any user
- [x] Permission checks throughout the application
- [x] **MAJOR REFACTOR**: Migrated 85+ hardcoded role checks to permission-based
- [x] **NEW: Admin permissions** - stage_rollback, milestone_rollback, delete_files, email_templates, view_logs, seed_data
- [x] **NEW: Service permission** - assign_technician
- [x] **Roles are templates only** - Admin can fully customize permissions for any user

### CRM Modules
- [x] Pre-Sales management
- [x] Lead management with conversion flow
- [x] **Lead actions (comments, stage updates)** - permission-based enforcement
- [x] Project management with multi-stage milestones
- [x] Files, Notes, Collaborators per project
- [x] Meetings & Calendar system
- [x] Project Financials & Payment tracking

### Additional Features
- [x] Academy module with video/PDF uploads
- [x] Warranty & Service Requests
- [x] **Warranty collaborators** - Technicians can be added to warranty requests
- [x] Global Search
- [x] Notifications system
- [x] Reports & Analytics pages
- [x] **Time-based filters** - This Month, Last Month, This Quarter on Leads & Projects

---

## Test Credentials

**Local Admin Login:**
- **URL**: https://crm-finance-hub-1.preview.emergentagent.com/login
- **Email**: thaha.pakayil@gmail.com
- **Password**: password123
- **Access**: Full Admin permissions

**Login Flow:**
1. Go to /login
2. Click "Local Admin Login" to expand the form
3. Enter credentials above
4. Click "Login with Email"

---

## Key User Flows to Test

### 1. Pre-Sales → Lead → Project Flow
- Create a new Pre-Sales entry
- Convert Pre-Sales to Lead
- Convert Lead to Project
- Verify PID appears and persists

### 2. Project Milestone Progression
- Open any project
- Progress through Design → Production → Delivery → Handover stages
- Navigate away and return - verify progress is saved

### 3. User Management (Admin only)
- Go to Settings → Users
- Click "Create User" to add a new user with local password
- Click user row → "Manage Permissions" 
- Assign/remove specific permissions
- Test login with new user credentials

### 4. Permission-Based Access
- Create a user with limited permissions
- Login as that user
- Verify they can only access permitted features

### 5. Milestone Permission Testing (NEW)
- Create a Designer user with only `milestones.update.design` permission
- Login as Designer and verify:
  - Can update Design Finalization milestones
  - Cannot update Production/Delivery/Installation/Handover milestones
  - UI shows "You don't have permission" message for restricted groups
- Admin can manually grant additional milestone permissions

---

## Available Permissions

| Permission Key | Description |
|---------------|-------------|
| `presales.view` | View pre-sales |
| `presales.create` | Create pre-sales |
| `presales.update` | Update pre-sales |
| `presales.convert` | Convert pre-sales to leads |
| `leads.view` | View leads |
| `leads.view_all` | View all leads |
| `leads.create` | Create leads |
| `leads.update` | Update leads |
| `leads.convert` | Convert leads to projects |
| `projects.view` | View projects |
| `projects.view_all` | View all projects |
| `projects.manage_collaborators` | Manage project collaborators |
| **Milestone Permissions (NEW)** | |
| `milestones.update.design` | Update Design Finalization milestones |
| `milestones.update.production` | Update Production milestones |
| `milestones.update.delivery` | Update Delivery milestones |
| `milestones.update.installation` | Update Installation milestones |
| `milestones.update.handover` | Update Handover milestones |
| `warranty.view` | View warranty |
| `warranty.update` | Update warranty |
| `service.view` | View service requests |
| `service.view_all` | View all service requests |
| `service.create` | Create service requests |
| `service.update` | Update service requests |
| `academy.view` | View academy |
| `academy.manage` | Manage academy content |
| `admin.manage_users` | Manage users |
| `admin.assign_permissions` | Assign permissions |
| `admin.view_reports` | View reports |
| `admin.system_settings` | System settings |

---

## ✅ Accounting/Finance Module (Phase 1) - COMPLETED Jan 2026

A new, isolated Accounting module has been built alongside the frozen CRM.

### Features Implemented:
- [x] **Cash Book / Day Book** - Log and view daily financial transactions
- [x] **Account Management** - Bank accounts and cash-in-hand with opening balances
- [x] **Category Management** - Configurable expense categories
- [x] **Daily Closing & Locking** - Permanently lock a day's transactions
- [x] **Permission-Based Access** - Uses `finance.*` permissions, not role names
- [x] **Account Balance Cards** - Real-time balance display per account
- [x] **Day Summary** - Total In, Total Out, Net for selected date
- [x] **Date Navigation** - Navigate between days with prev/next buttons
- [x] **CRM Project Linking** - Link expenses to CRM projects (read-only integration)

---

## ✅ Project Finance Control (Phase 3) - COMPLETED Jan 2026

Project-level financial intelligence to answer: "How much can I safely take out?"

### Features Implemented:
- [x] **Vendor Mapping** - Plan costs before spending (Vendor, Category, Amount, Notes)
- [x] **Vendor Categories** - Modular, Non-Modular, Installation, Transport, Other
- [x] **Auto-Locking** - Vendor mappings locked when spending/production starts
- [x] **Actual vs Planned Comparison** - Auto-pulls from Cashbook, groups by category
- [x] **Financial Summary Card** - Contract Value, Received, Planned, Actual, Liability, Surplus
- [x] **Over-Budget Warnings** - Highlights when Actual > Planned
- [x] **Recent Transactions** - Shows Cashbook entries linked to project
- [x] **Audit Trail** - Edit history tracked for vendor mappings

### Permissions:
| Permission Key | Description |
|---------------|-------------|
| `finance.view_project_finance` | View project financial summaries |
| `finance.edit_vendor_mapping` | Add/edit/delete vendor mappings |

### Project Finance API Endpoints:
- `GET /api/finance/project-finance` - List projects with financial data
- `GET /api/finance/project-finance/{project_id}` - Project detail with summary
- `GET /api/finance/vendor-mappings/{project_id}` - Get vendor mappings
- `POST /api/finance/vendor-mappings` - Create vendor mapping
- `PUT /api/finance/vendor-mappings/{mapping_id}` - Update mapping
- `DELETE /api/finance/vendor-mappings/{mapping_id}` - Delete mapping
- `GET /api/finance/vendor-categories` - Get category list

### Finance Permissions:
| Permission Key | Description |
|---------------|-------------|
| `finance.view_dashboard` | View finance overview |
| `finance.view_cashbook` | View daily cash book |
| `finance.add_transaction` | Create new entries |
| `finance.edit_transaction` | Modify entries (unlocked days only) |
| `finance.delete_transaction` | Remove entries (unlocked days only) |
| `finance.verify_transaction` | Mark transactions as verified |
| `finance.close_day` | Lock daily entries permanently |
| `finance.view_reports` | Access financial reports |
| `finance.manage_accounts` | Add/edit bank and cash accounts |
| `finance.manage_categories` | Add/edit expense categories |

### Finance API Endpoints:
- `GET /api/accounting/accounts` - List accounts
- `POST /api/accounting/accounts` - Create account
- `GET /api/accounting/categories` - List categories  
- `POST /api/accounting/categories` - Create category
- `GET /api/accounting/transactions?date=YYYY-MM-DD` - Get transactions
- `POST /api/accounting/transactions` - Create transaction
- `GET /api/accounting/daily-summary/{date}` - Daily summary with balances
- `POST /api/accounting/close-day/{date}` - Lock day's books
- `GET /api/accounting/reports/account-balances` - Account balances report
- `GET /api/accounting/reports/category-summary` - Category summary report

### Test Data:
- **Petty Cash**: ₹47,500 (Cash-in-Hand)
- **Bank of Baroda - Current**: ₹500,000 (Company Bank Primary)
- Categories: Project Expenses, Office Expenses, Sales & Marketing, Travel/TA, Site Expenses, Miscellaneous

---

## ✅ Finance Controls & Guardrails (Phase 3 Extended) - COMPLETED Jan 2026

Financial control and visibility for the founder without complex accounting.

### Features Implemented:
- [x] **Founder Dashboard** - Read-only snapshot answering "Can I safely spend money today?"
  - Total Cash Available (all accounts)
  - Locked Commitments (vendor mappings)
  - Safe Surplus (usable amount)
  - Health Status (Healthy/Warning/Critical)
  - Top 5 Risky Projects
  - Month-to-Date Received/Spent
- [x] **Daily Closing System** - Auto-calculated from Cashbook per account
  - Opening Balance, Inflow, Outflow, Closing Balance
  - Account-wise breakdown table
  - Close Day button (locks permanently)
  - Historical closings list
- [x] **Monthly Snapshot & Freeze** - End-of-month financial capture
  - Total Inflow/Outflow/Net Change
  - Cash Position
  - Planned vs Actual comparison
  - Close Month button (read-only after)
- [x] **Project Safe Surplus Warnings** - Risk levels (Green/Amber/Red)
  - Visual warnings when Over Budget
  - No money movement from Red projects

### New Permissions:
| Permission | Admin | SeniorAccountant | Accountant |
|------------|-------|------------------|------------|
| finance.founder_dashboard | ✅ | ❌ | ❌ |
| finance.daily_closing | ✅ | ✅ | ✅ (view only) |
| finance.monthly_snapshot | ✅ | ✅ | ❌ |

### New API Endpoints:
- `GET /api/finance/founder-dashboard` - Founder snapshot
- `GET /api/finance/daily-closing?date=YYYY-MM-DD` - Daily breakdown
- `POST /api/finance/daily-closing/{date}/close` - Lock day
- `GET /api/finance/daily-closing/history` - Recent closings
- `GET /api/finance/monthly-snapshots` - List snapshots
- `GET /api/finance/monthly-snapshots/{year}/{month}` - Specific month
- `POST /api/finance/monthly-snapshots/{year}/{month}/close` - Freeze month
- `GET /api/finance/project-surplus-status` - Risk levels

---

## ✅ Accounting Governance & Decision Layer (Phase 3++) - COMPLETED Jan 2026

Turn accounting data into actionable decisions and leak prevention.

### Features Implemented:
- [x] **Safe Spend Panel** - Daily safe limit, monthly budget tracking, warnings
- [x] **Spending Approval Rules** - Soft control for high-value transactions
- [x] **Overrun Attribution** - Document reasons when actual > planned
- [x] **Cost Intelligence** - Compare with similar projects, flag abnormal entries
- [x] **Alerts & Signals** - Project overruns, low cash, pending approvals
- [x] **Decision Shortcuts** - Freeze/Unfreeze, Allow Overrun, Mark Exceptional
- [x] **Project Decisions Log** - Track all governance decisions

### Decision Shortcuts (Admin Only):
| Action | Description |
|--------|-------------|
| Freeze Spending | Block all new expenses for a project |
| Unfreeze | Re-enable spending |
| Allow Overrun | One-time approval for exceeding planned |
| Mark Exceptional | Flag project as special case |
| Explain Overrun | Record attribution for budget exceedance |

### Overrun Attribution Options:
- **Reasons**: Vendor Price Increase, Design Change Request, Site Issue, Material Upgrade, Scope Addition, Internal Miss, Market Rate Change, Emergency, Other
- **Responsible**: Vendor, Design Team, Site Team, Client Request, Management, External Factor

### New API Endpoints:
- `GET /api/finance/safe-spend` - Daily/monthly spending limits
- `GET /api/finance/alerts` - Active alerts and signals
- `GET /api/finance/approval-rules` - Spending approval rules
- `POST /api/finance/transactions/{id}/approve` - Approve transaction
- `GET /api/finance/cost-intelligence/{project_id}` - Benchmark comparison
- `GET /api/finance/overrun-reasons` - Overrun options
- `POST /api/finance/overrun-attributions` - Record attribution
- `POST /api/finance/projects/{id}/freeze-spending` - Freeze project
- `POST /api/finance/projects/{id}/allow-overrun` - Allow overrun
- `POST /api/finance/projects/{id}/mark-exceptional` - Mark exceptional

---

## ✅ Real-World Accounting & Payment Flow - COMPLETED Jan 2026

Customer payment receipts with server-side PDF generation.

### Features Implemented:
- [x] **Receipts Management** - List, create, view payment receipts
- [x] **PDF Receipt Generation** - Server-side using ReportLab (lightweight Python)
- [x] **Accounting-Grade PDF Design** - Clean, neutral colors (charcoal/grey), no blue, CA/GST ready
- [x] **Company Profile Page** - Comprehensive settings at `/settings/company-profile`
- [x] **Auto Receipt Numbers** - Format: RCP-YYYYMMDD-XXXX
- [x] **Cashbook Integration** - Receipts auto-create inflow transactions
- [x] **Balance Tracking** - Contract value, total received, balance remaining
- [x] **Project Finance Receipts Section** - View all receipts for a project in Project Finance Detail page

### Company Profile Fields (NEW):
**Company Identity:**
- Legal Name, Brand/Display Name, Tagline/Descriptor
- GSTIN, PAN

**Address (Structured):**
- Address Line 1, Address Line 2
- City, State, PIN Code, Country

**Contact & Digital:**
- Primary Email, Secondary Email
- Phone Number, Website URL

**Branding:**
- Logo upload, Favicon upload
- Primary Color, Secondary Color

**Document Settings:**
- Authorized Signatory Name
- Receipt Footer Note

### Receipt PDF Contents (Accounting-Grade):
- Company Name + Tagline (header)
- Full formatted address (footer)
- Contact info: Email | Phone | Website
- GSTIN (footer)
- Receipt Number, Date
- "Received From" - Customer Name, Project Name
- Project ID
- Payment Description, Mode, Account
- Amount Received (near-black, prominent)
- Contract Value, Total Received, Balance Due
- Notes (optional)
- Authorized Signatory
- Custom footer note (configurable)

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.view_receipts` | View payment receipts |
| `finance.add_receipt` | Create new receipts |
| `finance.issue_refund` | Cancel receipts, issue refunds |

### New API Endpoints:
- `GET /api/finance/receipts` - List all receipts
- `GET /api/finance/receipts/{receipt_id}` - Get receipt details
- `POST /api/finance/receipts` - Create receipt
- `GET /api/finance/receipts/{receipt_id}/pdf` - Download PDF receipt
- `POST /api/finance/receipts/{receipt_id}/cancel` - Cancel receipt
- `GET /api/finance/company-settings` - Get company settings (21 fields)
- `POST /api/finance/company-settings` - Update company settings
- `POST /api/finance/company-settings/logo` - Upload company logo

### New Pages:
- `/settings/company-profile` - Company Profile management page (Admin only)

### Test Data:
- Multiple test receipts created for project PID-00037 (sharan - Interior Project)
- Total received: ~₹1,05,000

---

## Deferred Tasks (Post-Testing)

### P1 - After Testing Stabilization
- [ ] Python Linting Cleanup (server.py)
- [ ] Backend Refactoring (break down 15,000+ line server.py)

### P2 - Upcoming Tasks (Real-World Accounting Flow)
- [x] **Payment Schedule Editor** - ✅ COMPLETED (Jan 2026)
- [x] **Invoice Creation Flow** - ✅ COMPLETED (Jan 2026)
- [x] **Refund & Cancellation Flow** - ✅ COMPLETED (Jan 2026)
- [ ] Finance Overview Dashboard

---

## ✅ P1 Finance & Payment Core - COMPLETED Jan 2026

### Payment Schedule Editor
- View payment stages per project with Expected/Received/Status
- Edit Schedule mode for Admin/Founder only
- Add/remove/modify stages with percentage or fixed amount
- **Lock stages** that have received payments (cannot remove)
- Calculate totals against contract value
- Route: `/finance/project-finance/{project_id}` (section)

### Invoice Creation Flow (GST Projects)
- Create GST invoices for applicable projects only
- Auto-calculate CGST + SGST at 9% each (18% total)
- Adjust for advances received
- Generate professional PDF invoice
- Route: `/finance/invoices`
- API: `GET/POST /api/finance/invoices`, `GET /api/finance/invoices/{id}/pdf`

### Refund & Cancellation Flow
- **Full Refund** - Return entire amount to customer
- **Partial Refund** - Return portion, keep rest
- **Forfeited** - No refund issued (cancellation charges)
- Creates outflow transaction in cashbook
- Fully traceable with reason and notes
- Route: `/finance/refunds`
- API: `GET/POST /api/finance/refunds`

### Sidebar Finance Menu (Updated)
- Overview
- Cash Book
- Receipts
- **Invoices** (new)
- **Refunds** (new)
- **Expense Requests** (new)
- Project Finance
- Daily Closing
- Monthly Snapshot

---

## ✅ Leak-Proof Spend Control System - COMPLETED Jan 2026

A comprehensive expense authorization system ensuring every financial transaction is tracked, owned, and auditable.

### Features Implemented:
- [x] **Expense Authorization Flow** - Mandatory request/approval before cashbook entry
- [x] **Spend Ownership** - Every expense has a designated owner responsible for closure
- [x] **Refund & Return Tracking** - Track pending refunds with statuses and alerts
- [x] **Controlled Cashbook** - Entries only from approved expenses (no manual free-entry for expenses)
- [x] **Over-Budget Detection** - Flags expenses exceeding project planned budget
- [x] **Visibility Dashboard** - Money at risk, open expenses, pending refunds on Founder Dashboard
- [x] **Activity Logging** - Complete audit trail of all expense actions

### Expense Request Statuses:
| Status | Description |
|--------|-------------|
| `pending_approval` | Submitted, waiting for approver |
| `approved` | Approved, ready to be recorded in cashbook |
| `rejected` | Rejected by approver |
| `recorded` | Recorded in cashbook (transaction created) |
| `refund_pending` | Expense returned/cancelled, refund awaited |
| `closed` | Fully settled |

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.create_expense_request` | Request expenses for approval |
| `finance.approve_expense` | Approve or reject expense requests |
| `finance.record_expense` | Record approved expenses in cashbook |
| `finance.allow_over_budget` | Approve expenses exceeding project budget |
| `finance.view_expense_requests` | View expense request list |
| `finance.track_refunds` | Track pending refunds and returns |

### New API Endpoints:
- `GET /api/finance/expense-requests` - List all expense requests (with filters)
- `GET /api/finance/expense-requests/{id}` - Get expense request details
- `POST /api/finance/expense-requests` - Create new expense request
- `PUT /api/finance/expense-requests/{id}` - Update pending request
- `POST /api/finance/expense-requests/{id}/approve` - Approve or reject
- `POST /api/finance/expense-requests/{id}/record` - Record in cashbook
- `POST /api/finance/expense-requests/{id}/mark-refund-pending` - Mark refund pending
- `POST /api/finance/expense-requests/{id}/record-refund` - Record refund received
- `POST /api/finance/expense-requests/{id}/close` - Close expense
- `PUT /api/finance/expense-requests/{id}/reassign-owner` - Reassign ownership
- `GET /api/finance/expense-requests/stats/summary` - Dashboard summary stats

### New Pages:
- `/finance/expense-requests` - Expense Requests management page

### Key Data Model (`finance_expense_requests`):
- `request_id`, `request_number` (EXP-YYYYMMDD-XXXX)
- `project_id`, `category_id`, `vendor_id` (optional)
- `amount`, `description`, `urgency`
- `status`, `is_over_budget`, `budget_info`
- `requester_id/name`, `owner_id/name`
- `approved_by/at`, `rejected_by/at`, `recorded_by/at`
- `transaction_id` (link to cashbook when recorded)
- `refund_status`, `refund_expected_amount`, `refund_received_amount`
- `activity_log` (array of actions)

---

## ✅ Accounting Roles & Permission System - COMPLETED Jan 2026

A comprehensive, admin-controlled permission system for finance operations with role templates.

### New Finance Roles (Templates Only):
| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **JuniorAccountant** | Basic data entry | View & create cashbook, NO delete/edit |
| **SeniorAccountant** | Full cashbook ops | Edit, verify, lock daily closing, invoices |
| **FinanceManager** | Full finance control | All approvals, budget overrides, write-offs |
| **CharteredAccountant** | Read-only audit | Reports, export, NO operational edits |
| **Founder** | Full visibility | Final overrides, not required for daily tasks |

### Granular Permission Groups:
| Group | Key Permissions |
|-------|-----------------|
| `finance_cashbook` | view, create, edit, delete, verify, daily_closing.lock, transaction.reverse |
| `finance_accounts` | view, create, edit, opening_balance |
| `finance_documents` | receipts.view/create/download, invoices.view/create/cancel, refunds.view/create/approve |
| `finance_project` | view, allocate_funds, vendor_mapping, cost_edit, override_budget |
| `finance_expenses` | view, create, approve, record, track_refunds |
| `finance_reports` | view, export, profit, margin, monthly_snapshot, founder_dashboard |
| `finance_masters` | categories.view/manage, vendors.view/manage, payment_schedule.view/edit/override |
| `finance_controls` | writeoff.approve, exception.mark, audit_log.view, import_data, cancellation.mark |

### API Endpoints:
- `GET /api/roles/available` - List all roles with categories
- `GET /api/roles/{role_id}/default-permissions` - Get role default permissions
- `GET /api/permissions/available` - Get all permission groups (Admin only)

### Key Principles:
- **NO hard-coded authority** - Roles are templates only
- **Admin full control** - Can modify any user's permissions freely
- **CRM untouched** - Finance permissions are completely separate
- **Backward compatibility** - Legacy finance permissions kept

### Permission Editor UI (Visual Admin Tool):
| Feature | Description |
|---------|-------------|
| **Role Dropdown** | Shows all 13 roles grouped by category (Administration, Sales, Design, Operations, Service, Finance, Leadership) |
| **Permission Counts** | Displays CRM/Finance/Total breakdown |
| **Filter Buttons** | All Permissions, CRM Only, Finance Only |
| **Checkboxes** | Toggle individual permissions on/off |
| **Reset to Defaults** | Restore role template permissions |
| **Save Button** | Persist custom permission changes |
| **Visual Styling** | Finance groups have emerald green styling to distinguish from CRM |

---

## ✅ Budgeting, Forecasting & Spend Control Module - COMPLETED Jan 2026

A comprehensive financial planning and control system for the founder.

### Features Implemented:
- [x] **Budget Setup** - Create monthly/quarterly budgets by category
- [x] **Budget Categories** - 10 predefined categories (Fixed: Salaries, Rent, Utilities | Variable: Marketing, Travel, Repairs, etc.)
- [x] **Budget Activation** - Draft → Active workflow with single active budget per period
- [x] **Budget vs Actual Tracking** - Auto-pulls from Cashbook, shows consumption
- [x] **Budget Alerts** - Warns when categories exceed 80% or 100% of planned
- [x] **Spend Approval Workflow** - Amount-based thresholds:
  - ₹0-1,000: Auto-allowed (Petty Cash)
  - ₹1,001-5,000: Finance Manager approval
  - ₹5,001+: Founder/CEO mandatory
- [x] **Financial Forecasting** - Cash runway, burn rate, health score
- [x] **CEO Dashboard** - Sales pressure, commitments, monthly trends
- [x] **Forecast Assumptions** - Configurable expected income and project values

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.budget.view` | View budgets and budget tracking |
| `finance.budget.edit` | Create and modify budgets |
| `finance.forecast.view` | View financial forecast dashboard |
| `finance.expenses.approve_petty` | Approve petty cash (≤₹1,000) |
| `finance.expenses.approve_standard` | Approve standard expenses (₹1,001-5,000) |
| `finance.expenses.approve_high` | Approve high-value expenses (>₹5,000) |

### New API Endpoints:
- `GET /api/finance/budgets` - List all budgets
- `POST /api/finance/budgets` - Create new budget
- `PUT /api/finance/budgets/{budget_id}` - Update budget
- `POST /api/finance/budgets/{budget_id}/activate` - Activate budget
- `POST /api/finance/budgets/{budget_id}/close` - Close budget
- `GET /api/finance/budgets/current` - Get active budget with actuals
- `GET /api/finance/budget-categories` - Get predefined categories
- `GET /api/finance/budget-alerts` - Get over-budget alerts
- `GET /api/finance/forecast` - Get financial forecast
- `POST /api/finance/forecast/assumptions` - Save forecast assumptions
- `GET /api/finance/expense-requests/approval-rules` - Get spend thresholds
- `GET /api/finance/expense-requests/can-approve/{id}` - Check approval capability

### New Pages:
- `/finance/budgets` - Budget Management page
- `/finance/forecast` - Financial Forecast dashboard

### Key Data Models:
- **`finance_budgets`**: budget_id, name, period_type, period_start, period_end, status (draft/active/closed), allocations[]
- **`finance_forecast_assumptions`**: expected_monthly_income, expected_project_closures, average_project_value, fixed_commitments

### Health Score Calculation:
- Cash Runway Score (40%): >6mo=40, 3-6mo=30, 1-3mo=15, <1mo=0
- Commitment Ratio Score (30%): <25%=30, 25-50%=20, 50-75%=10, >75%=0
- Sales Pressure Score (30%): None=30, Low=20, Moderate=10, High=0

---

## ✅ Booking Payment Confirmation Workflow - COMPLETED Jan 2026

A targeted notification system for Accounts team when leads require booking payment confirmation.

### Features Implemented:
- [x] **Automatic Notifications** - When a lead moves to "Waiting for Booking" stage, all users with Accountant roles are notified
- [x] **Dedicated Confirmations Page** - `/finance/booking-confirmations` shows ONLY leads awaiting confirmation (not all leads)
- [x] **Targeted Access** - Accountants see only what they need to confirm, without access to full lead details
- [x] **One-Click Confirmation** - Simple "Confirm Payment" button for each pending lead
- [x] **Real-time Updates** - Confirmed leads removed from the list immediately
- [x] **Sidebar Integration** - "Booking Confirmations" link in Finance menu

### User Flow:
1. Sales/Designer moves lead to "Waiting for Booking" stage
2. All Accountant-role users receive notification: "Lead 'Customer Name' requires booking payment confirmation"
3. Accountant clicks notification → navigates to `/finance/booking-confirmations`
4. Page shows minimal info: Customer name, phone, budget, designer, time since request
5. Accountant clicks "Confirm Payment" after verifying payment received
6. Lead can now be converted to project by Sales Manager

### Accountant Roles Notified:
- JuniorAccountant
- SeniorAccountant
- FinanceManager
- Accountant

### New API Endpoint:
- `GET /api/finance/pending-booking-confirmations` - Returns only leads in "Waiting for Booking" stage with minimal data (customer_name, phone, budget, designer_name)

### New Page:
- `/finance/booking-confirmations` - Booking Payment Confirmations (accessible via Finance menu)

### Key Design Decisions:
- **No leads.view permission needed** - Accountants access this through finance permissions only
- **Single-purpose page** - Shows only what's needed for confirmation decision
- **Privacy-conscious** - Full lead details not exposed to finance team

---

## ✅ Salary / Payroll Control Module - COMPLETED Jan 2026

A lightweight salary management module focused on financial discipline, not HR.

### Features Implemented:
- [x] **Salary Master** - Employee salary setup linked to Users
- [x] **Monthly Salary Cycles** - Track advances, payments, balance per month
- [x] **Partial Payments** - Multiple payments per month (advances + salary)
- [x] **Budget Integration** - Auto-connects to 'salaries' budget category
- [x] **Cashbook Integration** - All payments create cashbook entries
- [x] **Carry Forward Recovery** - Excess advances auto-recovered next month
- [x] **Exit Processing** - Final settlement with prorated salary calculation
- [x] **Risk Assessment** - Safe/Tight/Critical cash status for salary obligations
- [x] **12-Month History** - Payment history per employee
- [x] **Salary Ladder Configuration** - Admin-editable salary level definitions (Trainee → Level 4 Cap)
- [x] **Edit/Promote Salary** - Manual salary changes with history tracking and reason (promotion/adjustment/correction)
- [x] **Salary Change History** - Audit trail of all salary changes with who, when, why
- [x] **Promotion Eligibility Flagging** - Non-automated, visibility-only eligibility status based on booking credits

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.salaries.view` | View own salary details |
| `finance.salaries.view_all` | View all employee salaries |
| `finance.salaries.edit_structure` | Edit salary amounts (Admin/Founder) |
| `finance.salaries.pay` | Record salary payments |
| `finance.salaries.close_month` | Close monthly salary cycles |
| `finance.salaries.manage_exit` | Process employee exits |
| `finance.salaries.manage_ladder` | Configure salary ladder levels |
| `finance.salaries.promote` | Promote/adjust employee salary |
| `hr.promotion.view` | View own eligibility status |
| `hr.promotion.view_all` | View all employee eligibility |
| `hr.promotion.manage` | Update eligibility thresholds |

### New API Endpoints:
- `GET /api/finance/salaries` - List salary configurations
- `POST /api/finance/salaries` - Create salary setup
- `GET /api/finance/salaries/{employee_id}` - Get salary detail
- `PUT /api/finance/salaries/{employee_id}` - Update salary
- `GET /api/finance/salaries/{employee_id}/history` - Get 12-month payment history
- `POST /api/finance/salaries/{employee_id}/promote` - Change salary with history tracking
- `GET /api/finance/salaries/{employee_id}/salary-history` - Get salary change audit trail
- `POST /api/finance/salary-payments` - Record payment (advance/salary/final)
- `GET /api/finance/salary-summary` - Dashboard summary with risk status
- `GET /api/finance/salary-cycles` - Get salary cycles for a month
- `POST /api/finance/salary-cycles/{employee_id}/{month_year}/close` - Close cycle
- `POST /api/finance/salaries/{employee_id}/exit` - Process exit
- `POST /api/finance/salaries/{employee_id}/close-settlement` - Close final settlement
- `GET /api/finance/employees-for-salary` - Employees without salary setup
- `GET /api/finance/salary-ladder` - Get salary ladder configuration
- `PUT /api/finance/salary-ladder` - Update salary ladder configuration
- `GET /api/hr/promotion-config` - Get promotion eligibility thresholds
- `PUT /api/hr/promotion-config` - Update promotion thresholds
- `GET /api/hr/promotion-eligibility` - Get all employee eligibility
- `GET /api/hr/promotion-eligibility/overview` - CEO dashboard summary
- `GET /api/hr/promotion-eligibility/{employee_id}` - Get specific employee eligibility

### New Pages:
- `/finance/salaries` - Salary Management page (with Salary Ladder config modal)

### Key Data Models:
- **`finance_salary_master`**: salary_id, employee_id, monthly_salary, salary_level, payment_type, status, exit_date, last_salary_change_date, last_salary_change_reason
- **`finance_salary_cycles`**: cycle_id, employee_id, month_year, total_advances, total_salary_paid, balance_payable, carry_forward_recovery, status
- **`finance_salary_payments`**: payment_id, employee_id, amount, payment_type (advance/salary/final_settlement), account_id, transaction_id
- **`finance_salary_ladder`**: config_id, levels[] (level, name, min_salary, max_salary, order)
- **`finance_salary_history`**: history_id, employee_id, previous_salary, new_salary, previous_level, new_level, effective_date, reason, notes, changed_by
- **`hr_promotion_config`**: config_id, credits_required, months_required, stagnant_months

### Promotion Eligibility Logic (Non-Automated):
- **Credits Required**: 3 booking credits (projects sent to production)
- **Months Required**: 3 unique months with bookings
- **Stagnant**: 6+ months at same level with 0 bookings
- **Status**: eligible / near_eligible / stagnant / in_progress
- **Action**: System flags only - Admin manually promotes via "Edit Salary / Promote"

### Risk Status Calculation:
- **Safe**: Cash ≥ 2x salary obligations
- **Tight**: Cash ≥ 1x salary obligations
- **Critical**: Cash < salary obligations

---

### P3 - Future Features (Accounting Phase 2)
- [x] **Account Master** - ✅ COMPLETED (Jan 2026)
- [x] **Expense Category Master** - ✅ COMPLETED (Jan 2026)
- [x] **Vendor Master** - ✅ COMPLETED (Jan 2026)
- [x] **Audit Logging** - ✅ COMPLETED (Jan 2026)
- [x] **Budget Forecasting Tools** - ✅ COMPLETED (Jan 2026)
- [ ] Finance Reports (Cash Flow, P&L, Project Profitability)
- [ ] Import/Export System
- [ ] Transaction Safety (Reversal entries)
- [ ] Historical Cost Intelligence
- [ ] CA Mode (Read-only audit access)
- [ ] SMS/Email integration for critical alerts

---

## ✅ Cashbook Guardrails & Expense Accountability - COMPLETED Jan 2026

Enhancement to Cashbook for preventing money leakage and clarifying responsibility.

### Features Implemented:
- [x] **Amount-Based Guardrails** - Soft validation based on amount thresholds
- [x] **Accountability Fields** - requested_by, paid_by, approved_by tracking
- [x] **Review Flagging** - Auto-flag mid-range and high-value transactions
- [x] **Admin/CEO Review List** - "Needs Review" filter and mark-reviewed action
- [x] **Expense Request Linking** - Optional link to approved expense requests

### Guardrail Thresholds:
| Amount Range | Status | Behavior |
|--------------|--------|----------|
| ₹0 - ₹1,000 | Petty Cash | Direct entry, no approval needed |
| ₹1,001 - ₹5,000 | Needs Review | Entry allowed, flagged for Admin/CEO review |
| ₹5,001+ | Approval Required | Should have approver or expense request link |

### New Fields in accounting_transactions:
- `requested_by` / `requested_by_name` - Who initiated the spend
- `paid_by` / `paid_by_name` - Who paid / created the entry
- `approved_by` / `approved_by_name` - Who approved (for high-value)
- `expense_request_id` - Link to approved expense request
- `needs_review` - Boolean flag for review list
- `approval_status` - not_required / needs_review / pending_approval / approved / reviewed

### New API Endpoints:
- `GET /api/accounting/transactions/review-summary` - Count and amount needing review
- `GET /api/accounting/transactions/needs-review` - List flagged transactions
- `PUT /api/accounting/transactions/{id}/mark-reviewed` - Clear review flag
- `GET /api/accounting/users-for-approval` - List eligible approvers
- `GET /api/accounting/approved-expense-requests` - List linkable expense requests

### UI Enhancements:
- "Needs Review (N)" button in Cashbook header (Admin/CEO only)
- "Requested By" column in transactions table
- Status badges: Needs Review, No Approver, ER Linked
- "Mark Reviewed" action button
- Accountability section in Add Entry dialog with amount category indicator

---

### P3 - Future Features (CRM)
- [ ] ProductionOpsDashboard UI implementation
- [ ] Quick Add button on main dashboard
- [ ] Drag-and-drop for stage changes
- [ ] File versioning
- [ ] Rich text (markdown) support for Notes

---

## API Quick Reference

### Auth
- `POST /api/auth/login-local` - Local password login
- `POST /api/users/create-local` - Create user with password (Admin)
- `GET /api/auth/me` - Get current user

### Permissions
- `GET /api/permissions` - List all available permissions
- `PUT /api/users/{user_id}/permissions` - Update user permissions

### Core CRM
- `GET /api/presales` - List pre-sales entries
- `GET /api/leads` - List leads
- `GET /api/projects` - List projects
- `GET /api/projects/{id}` - Project details with milestones

---

## Tech Stack
- React 19, React Router v7
- TailwindCSS, Shadcn UI, Lucide Icons
- FastAPI, Motor (async MongoDB)
- passlib + bcrypt (password hashing)
- aiofiles (async file uploads)

## 3rd Party Integrations
- **Emergent-managed Google Auth**: Production user login
- **Google Forms (Planned)**: Service request intake (backend endpoint exists, not connected)

---

## ✅ Cashbook Modal UI & Category Fix - COMPLETED Jan 11, 2026

Bug fix and enhancement for the Cashbook "Add Entry" modal.

### Issues Fixed:
1. **Modal Scroll Bug (Critical)** - Modal was exceeding viewport height, making Submit button inaccessible
2. **Category Confusion** - "Money In" was showing expense categories instead of income categories

### Changes Made:
- **Modal Height**: Limited to `max-h-[85vh]` with `overflow-y-auto` for internal scrolling
- **Header/Footer Fixed**: Header and Submit/Cancel buttons always visible using `flex-shrink-0`
- **Category Separation**: Money In now shows Income Categories, Money Out shows Expense Categories
- **Category Reset**: Switching between Money In/Out clears the selected category

### Income Categories (Static List):
| Category ID | Display Name |
|-------------|-------------|
| income_project_payment | Project Payment |
| income_advance_booking | Advance / Booking Amount |
| income_design_fee | Design Fee |
| income_refund_reversal | Refund Reversal |
| income_other | Other Income |

### Backend Updates:
- Added static income category validation in `POST /api/accounting/transactions`
- Inflow transactions accept both static income categories and database expense categories
- Outflow transactions only accept database expense categories

### Files Modified:
- `/app/frontend/src/pages/CashBook.jsx` - Modal styling, category logic
- `/app/backend/server.py` - Income category validation

---

## ✅ Advance Cash Lock & Safe-Use System - COMPLETED Jan 11, 2026

Critical accounting feature to protect founder cash and prevent uncontrolled spending.

### Core Concept:
- **85% of all customer advances are locked by default** for project execution
- **15% is "Safe to Use"** for business operations
- Locked funds release **only** when real commitments occur (cashbook outflows + approved expense requests)
- **No automatic unlocking** based on time or vendor mapping

### Key Features:

#### 1. Global Lock Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| Lock Percentage | 85% | Default % locked on all advances |
| Monthly Operating Expense | ₹5,00,000 | Baseline for warning calculations |

#### 2. Lock Calculation Formula
```
Gross Locked = Total Received × Lock %
Net Locked = max(Gross Locked − Commitments, 0)
Safe to Use = Total Received − Net Locked
```

#### 3. Commitment Sources
- Cashbook outflows linked to project (`project_id`)
- Approved expense requests for the project

#### 4. Per-Project Override (Admin Only)
- Admin/Founder can override lock % per project
- Mandatory reason required for audit
- Full audit trail in `project_lock_history` + `project_decisions_log`

### New API Endpoints:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/lock-config` | GET | Get global lock settings |
| `/api/finance/lock-config` | PUT | Update global lock settings (Admin) |
| `/api/finance/project-lock-status/{id}` | GET | Get lock status for project |
| `/api/finance/project-lock-status` | GET | Get lock status for all projects |
| `/api/finance/project-lock-override/{id}` | PUT | Override lock % (Admin) |
| `/api/finance/project-lock-override/{id}` | DELETE | Remove override (Admin) |
| `/api/finance/safe-use-summary` | GET | Dashboard safe-use summary |

### New Database Collections:
| Collection | Purpose |
|------------|---------|
| `finance_lock_config` | Global lock settings |
| `project_lock_overrides` | Per-project lock overrides |
| `project_lock_history` | Audit trail for lock changes |

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.lock_config` | Configure global lock settings |
| `finance.lock_override` | Override project lock % |
| `finance.view_lock_status` | View locked vs usable amounts |

### UI Components:

#### Founder Dashboard - "Advance Cash Lock" Section
- Total Received (all projects)
- Total Locked (amber)
- Total Commitments (orange)
- Safe to Use (emerald)
- Months runway indicator
- Low Safe Cash Warning banner
- Top projects by locked amount

#### Project Finance Detail - "Advance Cash Lock" Card
- Total Received (with receipt count)
- Locked amount
- Commitments breakdown (outflows + ERs)
- Safe to Use
- Lock Change History
- Override Lock % button (Admin only)

### Files Modified:
- `/app/backend/server.py` - Lock APIs (Lines 18315-18830)
- `/app/frontend/src/pages/FounderDashboard.jsx` - Safe Use Summary section
- `/app/frontend/src/pages/ProjectFinanceDetail.jsx` - Lock Status section

### Testing:
- 18/18 backend API tests passed
- Frontend UI verified with screenshots
- Test file: `/app/tests/test_advance_cash_lock.py`

---

## ✅ Accounting Clarity Layers - COMPLETED Jan 11, 2026

Lightweight accounting clarity without full double-entry system. All data derived from existing sources.

### Phase A - Explicit Liability Register

**Problem:** Remaining liability was implicit (derived from planned - actual). No explicit tracking.

**Solution:** Dedicated `finance_liabilities` collection with:
- Auto-creation when Expense Requests are approved
- Manual creation by Admin (vendor credit, advances, exceptional commitments)
- Settlement tracking with history
- Cashbook outflows settle liabilities (never create them)

| Field | Description |
|-------|-------------|
| liability_id | Unique identifier (lia_xxxxx) |
| project_id | Optional - office expenses have no project |
| vendor_id / vendor_name | Hybrid vendor management |
| category | raw_material, production, installation, transport, office, salary, marketing, other |
| amount / amount_settled / amount_remaining | Financial tracking |
| due_date | Optional due date |
| source | expense_request, vendor_credit, manual |
| status | open, partially_settled, closed |
| settlements[] | Array of settlement records with transaction links |

**New API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/liabilities` | GET | List with filters (status, category, project_id) |
| `/api/finance/liabilities` | POST | Create manual liability (Admin only) |
| `/api/finance/liabilities/{id}` | GET | Get single liability |
| `/api/finance/liabilities/{id}/settle` | POST | Settle liability (partial or full) |
| `/api/finance/liabilities/summary` | GET | Dashboard summary |
| `/api/finance/vendors` | GET | List vendors |

**UI:** Finance → Liabilities
- Summary cards: Total Outstanding, Due This Month, Overdue, Top Vendor
- Filters by status, category, project
- Table with Settle buttons
- Export to CSV

---

### Phase B - Project Profit Visibility

**Problem:** Projects showed "Safe Surplus" but no profit percentage or projected vs realised distinction.

**Solution:** Enhanced Project Finance → Financial Summary Card:

| Metric | Formula | Display |
|--------|---------|---------|
| Projected Profit | Contract Value − Planned Cost | ₹ + % |
| Realised Profit | Cash Received − Actual Cost | ₹ + % |
| Execution Margin Remaining | Projected − Realised | ₹ (buffer or exceeded) |

**New API Endpoint:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/project-profit/{id}` | GET | Project profit metrics |

**UI:** Added "Profit Visibility" card to ProjectFinanceDetail.jsx

---

### Phase C - Simple P&L Snapshot

**Problem:** No decision snapshot for founder/CA.

**Solution:** Derived P&L from existing data:

**Revenue:**
- Cash received from projects (inflows + receipts)
- Other income

**Execution Costs:**
- **Paid (Cashbook)** - actual money spent on projects
- **Committed (Liabilities)** - pending payment obligations
- **Total Execution Exposure** - Paid + Committed

**Operating Expenses:**
- Salaries, Office, Marketing, Travel, Miscellaneous

**Profit Summary:**
- Gross Profit = Revenue − Execution Paid
- Net Operating Profit = Gross − Operating

**Cash vs Accounting Profit:**
- Cash Profit = actual cash in − cash out
- Accounting Profit = includes commitments
- Difference explained by: advances locked %, open liabilities, committed not paid

**New API Endpoint:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/pnl-snapshot` | GET | P&L with period (month, quarter, custom) |

**UI:** Finance → P&L Snapshot
- Period selector (Month, Quarter, Custom range)
- Revenue & Costs table
- Operating Expenses table
- Cash vs Accounting Profit comparison with explanation
- Export to CSV

---

### Phase D - Founder Overview Enhancement

**Addition:** Outstanding Liabilities card on Founder Dashboard
- Total Outstanding (red)
- Due This Month (amber)
- Overdue (red if any)
- Top Vendors list
- View All → link to Liabilities page

---

### New Database Collections
| Collection | Purpose |
|------------|---------|
| `finance_liabilities` | Explicit liability tracking |
| `finance_vendors` | Hybrid vendor management (auto-created) |

### New Permissions
| Permission | Description |
|------------|-------------|
| `finance.liabilities.view` | View liability register |
| `finance.liabilities.create` | Create manual liability entries |
| `finance.liabilities.settle` | Record settlements |
| `finance.pnl.view` | View P&L snapshot |

### Files Modified
- `/app/backend/server.py` - Liability, P&L, Project Profit APIs
- `/app/frontend/src/pages/Liabilities.jsx` - NEW liability register page
- `/app/frontend/src/pages/PnLSnapshot.jsx` - NEW P&L snapshot page
- `/app/frontend/src/pages/ProjectFinanceDetail.jsx` - Profit Visibility section
- `/app/frontend/src/pages/FounderDashboard.jsx` - Outstanding Liabilities card
- `/app/frontend/src/App.js` - New routes
- `/app/frontend/src/components/layout/Sidebar.jsx` - New nav links

### Testing
- 25/25 backend API tests passed
- Frontend UI verified with screenshots
- Test file: `/app/tests/test_accounting_clarity_layers.py`

---

## ✅ Import / Export Module - COMPLETED Jan 11, 2026

Admin-only module for exporting data for CA compliance and importing historical records.

### Core Concept
- **Export:** Download CRM and Finance data in Excel (.xlsx) or CSV format for CA/audit compliance
- **Import:** Upload historical data with validation, duplicate detection, and dry-run preview
- **Critical Constraint:** All imported records are tagged with `imported=true` and **EXCLUDED from live financial calculations** (cash lock, safe surplus, spending eligibility)

### Export Features
| Data Type | Collection | Description |
|-----------|------------|-------------|
| Cashbook | `accounting_transactions` | Daily transactions (Money In/Out) |
| Receipts | `finance_receipts` | Customer payment receipts |
| Liabilities | `finance_liabilities` | Outstanding vendor dues |
| Salaries | `finance_salary_master` | Employee salary data |
| Project Finance | `projects` | Project-wise financial summary |
| Leads | `leads` | All leads with customer details |
| Projects | `projects` | All projects with client info |
| Customers | `leads` (dedupe) | Unique customer contact list |

### Import Features
- **Supported Types:** Cashbook, Receipts, Liabilities, Salaries, Leads, Projects
- **File Formats:** Excel (.xlsx, .xls) and CSV
- **Dry-Run Preview:** Validate data before importing
- **Duplicate Detection:** Skip, Update existing, or Create new records
- **Validation:** Required field checks, amount/date format validation
- **Audit Trail:** All imports logged in `import_audit_log` collection

### Duplicate Strategies
| Strategy | Description |
|----------|-------------|
| `skip` | Skip rows that match existing records |
| `update` | Update existing records with new data |
| `create_new` | Create new records even if duplicates exist |

### New API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/export/types` | GET | List available export types |
| `/api/admin/export` | POST | Export data (CSV/Excel) |
| `/api/admin/export/template/{type}` | GET | Download import template |
| `/api/admin/import/types` | GET | List available import types |
| `/api/admin/import/preview` | POST | Preview import with validation |
| `/api/admin/import/execute` | POST | Execute import |
| `/api/admin/import/history` | GET | Get import audit log |
| `/api/admin/import/history/{id}` | GET | Get import detail |

### New Database Collections
| Collection | Purpose |
|------------|---------|
| `import_previews` | Temporary storage for import preview data (auto-expires after 1 hour) |
| `import_audit_log` | Permanent audit trail of all import operations |

### Import Record Tagging
All imported records include:
```json
{
  "imported": true,
  "import_date": "2026-01-11T12:00:00Z",
  "imported_by": "user_id",
  "imported_by_name": "User Name"
}
```

### Files Modified
- `/app/backend/server.py` - Import/Export APIs
- `/app/frontend/src/pages/ImportExport.jsx` - NEW Import/Export page
- `/app/frontend/src/App.js` - Route at `/admin/import-export`
- `/app/frontend/src/components/layout/Sidebar.jsx` - Navigation link for Admin
- `/app/backend/requirements.txt` - Added `openpyxl==3.1.5`

### Testing
- 24/24 backend API tests passed
- Frontend UI verified
- Test file: `/app/tests/test_import_export.py`

---

## ✅ Reports & Insights Layer - COMPLETED Jan 11, 2026

Financial reports for analyzing cash flow and project profitability.

### Reports Available

| Report | Endpoint | Description |
|--------|----------|-------------|
| Cash Flow Report | `/api/finance/reports/cash-flow` | Inflows vs outflows with monthly trends, category breakdown, account breakdown, project cash flow |
| Project Profitability | `/api/finance/reports/project-profitability` | All projects with profitability metrics, margins, risk assessment |

### Cash Flow Report Features
- Period selector: Last 3 months (default), 6 months, 12 months, custom range
- Summary cards: Total Inflow, Total Outflow, Net Cash Flow, Transaction Count
- Monthly trend table with inflow/outflow/net per month
- Category breakdown for inflows and outflows
- Account breakdown showing balance per account
- Project cash flow (top 20 projects)
- Export to Excel functionality

### Project Profitability Report Features
- Summary cards: Total Projects, Profitable, Loss-Making, Total Profit, Overall Margin %
- Top profitable projects list
- Loss-making projects list
- Filters: Stage, Status (profitable/loss/all), Sort by (margin/profit/contract value)
- All projects table with profitability metrics
- Risk assessment per project (high/medium/low based on cost overrun)
- Click to navigate to project finance detail

### New API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/reports/available` | GET | List available reports based on user permissions |
| `/api/finance/reports/cash-flow` | GET | Cash flow report with period filter |
| `/api/finance/reports/project-profitability` | GET | Project profitability report with filters |

### Files Modified
- `/app/backend/server.py` - Reports API endpoints
- `/app/frontend/src/pages/FinanceReports.jsx` - NEW Reports hub page
- `/app/frontend/src/pages/CashFlowReport.jsx` - NEW Cash Flow Report page
- `/app/frontend/src/pages/ProjectProfitabilityReport.jsx` - NEW Project Profitability Report page
- `/app/frontend/src/App.js` - Routes for `/finance/reports/*`
- `/app/frontend/src/components/layout/Sidebar.jsx` - Reports link in Finance submenu

### Testing
- All API endpoints verified via curl
- Frontend UI verified with screenshots

---

## ✅ CA Mode (Chartered Accountant Access) - COMPLETED Jan 11, 2026

Read-only access for Chartered Accountants and Auditors.

### Role Configuration
- **Role ID**: `CharteredAccountant`
- **Access Type**: Read-only
- **Scope**: Finance + Project Finance summaries only (no CRM pipeline)

### Permissions Granted
```
finance.cashbook.view, finance.daily_closing.view
finance.accounts.view
finance.receipts.view, finance.receipts.download
finance.invoices.view, finance.refunds.view
finance.project.view
finance.expenses.view
finance.reports.view, finance.reports.export, finance.reports.profit, finance.reports.margin
finance.monthly_snapshot
finance.budget.view, finance.forecast.view
finance.categories.view, finance.vendors.view
finance.payment_schedule.view
finance.audit_log.view
```

### CA Navigation (Sidebar)
- Dashboard (Finance Overview)
- My Profile
- Finance submenu:
  - Overview
  - Project Finance
  - Cash Book
  - Liabilities
  - Receipts
  - P&L Snapshot
  - Reports
  - Export Data

### How to Create CA User
1. Admin goes to Users page
2. Click "Add User"
3. Select role: "Chartered Accountant (CA)"
4. Fill email and password
5. CA user can login with email/password and access read-only finance data

### Files Modified
- `/app/backend/server.py` - CharteredAccountant added to VALID_ROLES, Founder role added
- `/app/frontend/src/components/layout/Sidebar.jsx` - CA-specific navigation with restricted submenu

---

## ✅ Invoice Entry Module (Execution Ledger) - COMPLETED Jan 28, 2026

Redesigned invoice-based module for tracking material purchases and service execution. Now supports vendor invoices with multiple line items per entry, with integrated payment recording.

**Location:** Project Finance → Project Detail (not a separate sidebar item)

### Invoice Entry Features:
- **Invoice Header**: Vendor, Invoice No, Invoice Date, Execution Date
- **Multiple Line Items**: Each invoice can have multiple line items with category, material, spec, brand, qty, unit, rate
- **Purchase Type Toggle**: Cash or Credit purchase
- **Payment Recording**: "Pay" button to record payments directly from invoices
- **Payment Status Tracking**: unpaid → partial → paid
- **Payment History**: Full payment history visible on each invoice
- **Delete Protection**: Invoices with payments cannot be deleted

**Line Item Categories:**
- Modular Material
- Hardware & Accessories
- Factory / Job Work
- Installation
- Transportation / Logistics
- Non-Modular Furniture
- Site Expense

**Fields per Invoice Entry:**
- Execution ID (auto), Project ID
- Vendor (unified vendor select with quick-create)
- Invoice No, Invoice Date, Execution Date
- Purchase Type (cash/credit)
- Items[] - array of line items
- Total Value (auto-calculated)
- **Payment Tracking Fields:**
  - total_paid, amount_remaining, payment_status (unpaid/partial/paid)
  - payments[] - array of payment records with transaction links
- Remarks, Edit History, Created By, Created At

### Payment Recording Flow:
1. Create Invoice Entry (no financial impact yet)
2. Click "Pay" button on invoice → Opens Record Payment modal
3. Enter payment details (amount, date, mode, account)
4. System auto-creates:
   - Cashbook outflow entry (with `system_generated=true`)
   - For credit purchases with remaining balance: Liability record
5. Invoice status updates automatically

**IMPORTANT: "Source Document First, Cashbook Second" Architecture**
- Payments originate from Invoice module, NOT from Cashbook
- Cashbook entries are auto-generated outputs, not manual inputs
- System-generated entries marked with `system_generated=true`

**Permissions:**
- View: Admin, Founder, Finance, ProjectManager, CA
- Add/Edit: Admin, Founder, ProjectManager
- Record Payment: Admin, Founder, SeniorAccountant, FinanceManager, ProjectManager
- Delete: Admin only (blocked for invoices with payments)

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/execution-ledger/categories` | GET | Get available categories |
| `/api/finance/execution-ledger` | POST | Create invoice entry |
| `/api/finance/execution-ledger/project/{id}` | GET | Get entries for project with summary |
| `/api/finance/execution-ledger/{id}` | GET | Get single entry |
| `/api/finance/execution-ledger/{id}` | PUT | Update entry (with edit history) |
| `/api/finance/execution-ledger/{id}` | DELETE | Delete entry (Admin only, blocked if has payments) |
| `/api/finance/execution-ledger/{id}/record-payment` | POST | **NEW** - Record payment, auto-create Cashbook entry |
| `/api/finance/execution-ledger/{id}/payments` | GET | Get payment history for invoice |
| `/api/finance/execution-ledger/export/{id}` | GET | Export CSV/Excel |

**Key UI Components:**
- `/app/frontend/src/components/ExecutionLedger.jsx` - Main component with payment UI
- `/app/frontend/src/components/VendorSelect.jsx` - Unified vendor selector
- `/app/frontend/src/pages/ProjectFinanceDetail.jsx` - Parent that passes liabilities prop

**Testing:** 100% backend + frontend tests passed (Jan 28, 2026)

**Future-Ready (NOT implemented yet):**
- Material price benchmarking
- Cutlist generator
- Vendor analytics
- BOQ comparison
- Margin variance reports

---

## ✅ Unified Payment Architecture - COMPLETED Jan 28, 2026

Implemented consistent payment recording pattern across all financial modules following the principle: **"Source Document First, Cashbook Second"**.

### Architecture Diagram:
```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                             │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Salary     │    │   Invoice    │    │  Liability   │      │
│  │   Module     │    │   Ledger     │    │   Module     │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  "Record Payment"    "Record Payment"     "Settle"             │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                             ▼                                   │
│                    ┌────────────────┐                           │
│                    │    CASHBOOK    │  ← Auto-generated         │
│                    │ (accounting_   │  ← system_generated=true  │
│                    │  transactions) │                           │
│                    └────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Module-Specific Flows:

| Module | Entry Point | Payment Action | Auto-Creates |
|--------|-------------|----------------|--------------|
| **Salary** | Add Employee Salary | Record Payment | Cashbook outflow |
| **Invoice Entry** | Add Invoice Entry | Record Payment ("Pay" button) | Cashbook outflow + Liability (if credit with remaining) |
| **Liability** | Create Liability | Settle | Cashbook outflow |

### System-Generated Cashbook Entries:
All auto-created Cashbook entries include:
- `system_generated: true` - Marks entry as auto-created
- `source_module: "salary" | "invoice_ledger" | "liability"` - Origin module
- `source_id` - ID of the source document
- `reference_type` - Type of payment (salary_payment, invoice_payment, liability_settlement)

### Categories Auto-Created:
| Category ID | Name | Source |
|-------------|------|--------|
| `salary_payment` | Salary Payment | Salary module |
| `invoice_payment` | Invoice Payment | Invoice Entry module |
| `liability_settlement` | Liability Settlement | Liability module |

### Key Rules:
1. **Cashbook is OUTPUT, not INPUT** for these transaction types
2. **Manual Cashbook entry should be avoided** for salary/invoice payments
3. **System-generated entries should be read-only** in Cashbook UI
4. **Delete protection** - Entries with payments cannot be deleted from source module

### Testing Status:
- ✅ Invoice Entry payment recording: 100% tests passed
- ✅ Salary payment to Cashbook flow: Verified
- ✅ Liability settlement to Cashbook flow: Verified

---

## ✅ Project Value & Quotation History - COMPLETED Jan 31, 2026

A clean, minimal system to provide data capture and audit clarity for financial analysis on project value lifecycle.

### Value Lifecycle Tracking

**Independently Stored Values:**
| Value Type | Description | Field |
|------------|-------------|-------|
| **Inquiry/Expected** | Initial budget from lead | `budget` / `inquiry_value` |
| **Booked Value** | Value at booking confirmation (immutable) | `booked_value` |
| **Contract/Sign-off Value** | Final agreed value (lockable) | `contract_value` |

### Quotation History (Append-Only Log)

**Purpose:** Track pricing evolution from initial inquiry to final contract.

**Fields per Entry:**
| Field | Type | Description |
|-------|------|-------------|
| `version` | int | Auto-incrementing version number |
| `quoted_value` | float | Quotation amount |
| `status` | string | Tentative / Revised / Approved / Superseded |
| `created_at` | datetime | When entry was created |
| `created_by` | string | User ID who created |
| `created_by_name` | string | User name |
| `note` | string | Reason for change |

**Status Logic:**
- **Tentative**: Initial or exploratory quote
- **Revised**: Updated quote based on scope changes
- **Approved**: Final approved quote (auto-supersedes all previous)
- **Superseded**: Replaced by newer approved quote (auto-set)

### Contract Value Locking

**Lock Behavior:**
- Lock button visible **ONLY** at Design Finalization or Production Preparation stages
- Once locked, value cannot be edited by regular users
- UI shows "Contract Locked" badge with lock icon
- Lock timestamp and user name displayed

**Admin/Founder Override:**
- Override button visible only for Admin/Founder when contract is locked
- Mandatory reason required
- Full audit trail: old value, new value, reason, timestamp, user

### Discount Tracking

**Fields:**
- `discount_amount`: Approved discount value
- `discount_reason`: Reason for discount
- `discount_approved_by`: User ID who approved
- `discount_approved_by_name`: User name

**Final Value Calculation:**
```
Final Value = Contract Value - Discount Amount
```

### New API Endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leads/{id}/quotation-history` | POST | Add quotation entry to lead |
| `/api/projects/{id}/quotation-history` | POST | Add quotation entry to project |
| `/api/projects/{id}/lock-contract-value` | POST | Lock contract value |
| `/api/projects/{id}/override-contract-value` | POST | Admin override lock (with reason) |
| `/api/projects/{id}/apply-discount` | POST | Apply approved discount |

### Frontend Components:

| Component | Location | Description |
|-----------|----------|-------------|
| `QuotationHistorySection` | `/app/frontend/src/components/project/` | Table display + Add Quote modal |
| `ValueLifecycleCard` | `/app/frontend/src/components/project/` | Value summary + Lock/Override/Discount controls |

### Integration Points:
- **LeadDetails.jsx**: QuotationHistorySection added for leads not yet converted
- **ProjectDetails.jsx**: Both components added in Overview tab below main grid
- **GET /api/projects/{id}**: Returns all value lifecycle fields

### Permissions:
- **Add Quotation**: Any user who can update lead/project stage
- **Lock Contract**: Any user with stage update permissions (visible at specific stages only)
- **Override Lock**: Admin/Founder only
- **Apply Discount**: Admin/Founder only

### Testing Status:
- ✅ Backend: 22/22 API tests passed
- ✅ Frontend: All UI components verified
- ✅ Test report: `/app/test_reports/iteration_29.json`

---

## ✅ Vendor Invoice Discount Handling - COMPLETED Jan 31, 2026

Invoice-level discount support for Execution Ledger to handle vendor discounts correctly for accounting and audit purposes.

### Data Model Changes

**New Fields in `execution_ledger` collection:**
| Field | Type | Description |
|-------|------|-------------|
| `gross_total` | float | Sum of line items (immutable) |
| `discount_type` | string | "flat" or "percentage" |
| `discount_value` | float | Discount input value |
| `discount_amount` | float | Calculated discount amount |
| `net_payable` | float | Gross - Discount (payment basis) |

### Calculation Logic

```
Gross Total = Σ(quantity × rate) for all line items
Discount Amount = 
  - If flat: min(discount_value, gross_total)
  - If percentage: (gross_total × discount_value) / 100
Net Payable = Gross Total - Discount Amount
```

### Financial Flow

| Operation | Uses Value |
|-----------|------------|
| Liability Creation (credit) | Net Payable |
| Cashbook Outflow | Net Payable |
| Project Actual Cost | Net Payable (via cashbook) |
| Amount Remaining | Net Payable - Total Paid |
| Reporting/Audit | Both Gross and Net stored |

### UI Changes

**Add/Edit Invoice Modal:**
- "Vendor Discount (if any)" section with Type dropdown and Amount input
- Summary shows: Gross Total, Discount (if any), Net Payable

**Invoice List Display:**
- Gross total shown crossed out for discounted invoices
- Net payable with discount badge (e.g., "-5%" or "-₹2,000")
- Expanded view shows full discount breakdown

**Record Payment Modal:**
- Shows Gross, Discount, and Net Payable summary

### Testing Status:
- ✅ Backend: Discount calculation verified for both flat and percentage
- ✅ Frontend: UI displays correctly with discount badges
- ✅ Payments: Correctly track remaining balance against net_payable

---

## ✅ GST Handling for Purchase Invoices - COMPLETED Feb 3, 2026

Line-item based GST calculations for vendor invoices (Purchase Invoices), along with a Project-Level GST Toggle for customer tax invoices.

### P0: Line-Item GST for Purchase Invoices

Vendor invoices often have items with different HSN codes and tax rates. The system now supports GST calculations on a per-line-item basis.

**New Fields per Line Item:**
| Field | Type | Description |
|-------|------|-------------|
| `hsn_code` | string | HSN/SAC code (optional) |
| `cgst_percent` | float | CGST percentage (optional) |
| `sgst_percent` | float | SGST percentage (optional) |
| `igst_percent` | float | IGST percentage - for inter-state (optional) |
| `cgst_amount` | float | Calculated CGST amount |
| `sgst_amount` | float | Calculated SGST amount |
| `igst_amount` | float | Calculated IGST amount |
| `line_total_with_gst` | float | Line amount + GST |

**New Invoice-Level Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `net_taxable` | float | Gross Total - Discount |
| `total_cgst` | float | Sum of all line CGST amounts |
| `total_sgst` | float | Sum of all line SGST amounts |
| `total_igst` | float | Sum of all line IGST amounts |
| `total_gst` | float | total_cgst + total_sgst + total_igst |
| `grand_total` | float | Net Taxable + Total GST |

**Calculation Flow:**
```
For each line item:
  Line Total = Qty × Rate
  CGST Amount = Line Total × CGST% / 100
  SGST Amount = Line Total × SGST% / 100  
  IGST Amount = Line Total × IGST% / 100

Invoice Level:
  Gross Total = Σ Line Totals
  Discount Amount = (based on discount_type)
  Net Taxable = Gross Total - Discount
  Total GST = Σ (CGST + SGST + IGST for all lines)
  Grand Total = Net Taxable + Total GST
```

**Financial Flow:**
| Operation | Uses Value |
|-----------|------------|
| Liability Creation | Grand Total |
| Cashbook Payment | Grand Total |
| Amount Remaining | Grand Total - Paid |

**API Endpoints:**
- `POST /api/finance/execution-ledger` - Updated to handle GST fields
- `PUT /api/finance/execution-ledger/{id}` - Updated to recalculate GST on edit

### P1: Project-Level GST Toggle

A simple YES/NO toggle in Project Settings that controls customer tax invoice generation (not purchase invoices).

**New Fields in `projects` collection:**
| Field | Type | Description |
|-------|------|-------------|
| `gst_applicable` | bool | Enable GST for customer invoices |
| `gst_number` | string | Client's GST number (15 char format) |

**API Endpoint:**
- `PUT /api/projects/{project_id}/settings` - Update GST settings

**UI Location:**
- ProjectDetails.jsx → Settings tab (visible to Admin/Founder/ProjectManager only)
- Toggle: "GST Applicable" with YES/NO switch
- Input: "GST Number" (conditionally visible when toggle is ON)
- Validation: GST number format (22AAAAA0000A1Z5)

### Frontend Changes

**ExecutionLedger.jsx (Purchase Invoice Form):**
- Two-row layout per line item
- Row 1: Category, Material, Spec/Brand, Qty, Unit, Rate, Total, Delete
- Row 2 (GST): HSN Code, CGST%, SGST%, IGST%, GST amounts display
- Summary: Gross Total, Discount, Net Taxable, GST breakdown, Grand Total

**Expanded Invoice View:**
- Table includes HSN and GST columns
- Invoice summary card shows GST breakdown (CGST/SGST/IGST amounts)
- Grand Total prominently displayed

**ProjectDetails.jsx (Settings Tab):**
- New "Settings" tab for Admin/Founder/ProjectManager
- GST Settings card with toggle and GST Number input
- Info box explaining the toggle affects customer invoices only

### Testing Status:
- ✅ Backend: All 13 API tests passed
- ✅ GST calculations: Verified correct for create, update, with/without discount
- ✅ Frontend: UI components render correctly
- ✅ Settings: Toggle and GST Number save/load working
- ✅ Validation: Invalid GST number format rejected with 400 error

---

## ✅ Account Name Display Bug Fix - COMPLETED Feb 3, 2026

**P0 usability bug**: Account dropdowns across Finance modules were showing account IDs or raw numbers instead of account names.

### Issue
- Dropdowns displayed: `acc_d3cd5544` instead of `Petty Cash (₹21,945)`
- Root cause: Frontend components used `acc.name` but backend returned `account_name`

### Fix Applied
Changed all account dropdowns to use fallback pattern: `acc.account_name || acc.name`

### Components Fixed
| Component | Location | Fix |
|-----------|----------|-----|
| ExecutionLedger.jsx | Line 1382 | Payment account dropdown |
| Liabilities.jsx | Line 704 | Settle account dropdown |
| CashBook.jsx | Lines 504, 528 | Internal transfer From/To dropdowns |
| RecurringTransactions.jsx | Line 745 | Template account dropdown |

### Verification
- ✅ CashBook - Internal Transfer dropdowns
- ✅ CashBook - Add Entry dropdown  
- ✅ Liabilities - Settle dropdown
- ✅ Purchase Invoice - Pay dropdown
- ✅ Account Summary Cards
- ✅ Transactions Table Account column
- ✅ RecurringTransactions - New Template dropdown

**All Finance module dropdowns now show: "Account Name (₹Balance)"**

---

## ✅ Daybook Detailed View - COMPLETED Feb 3, 2026

A read-only detailed view showing transaction-level rows for any date, accessible from the Daybook page.

### Features
| Feature | Description |
|---------|-------------|
| **Transaction Table** | Time, Account, Reference, Category/Purpose, Project/Vendor, Mode, Inflow, Outflow |
| **Summary Bar** | Total transactions, Total Inflow, Total Outflow, Net change |
| **Account Filter** | Dropdown to filter by specific account |
| **Type Filter** | Filter by Inflow Only / Outflow Only |
| **Search** | Search by reference, category, vendor name |
| **CSV Export** | Download filtered transactions as CSV file |
| **Print** | Print-friendly view with proper formatting |

### Access Points
1. Click **"View Daybook"** button in Account-wise Summary header
2. Click transaction count badge in account row
3. Click **Eye icon** or transaction count in Recent Closings section

### API Endpoint
- `GET /api/finance/daily-closing/{date}/transactions`
- Returns enriched transactions with account names, category names, project/vendor info
- Response includes summary: count, total_inflow, total_outflow, net

### Testing Status
- ✅ Backend: 8/8 tests passed
- ✅ Frontend: 10/10 features verified
- ✅ Read-only view confirmed - no edit functionality
- ✅ CSV export and Print work with filtered data

---

## ✅ Advanced Filters & Sorting - COMPLETED Feb 3, 2026

Enhanced filtering and sorting across Leads, Pre-Sales, and Projects to support operational review by Sales Managers and Design Managers.

### Features Implemented

#### 1. Custom Date Range Filter (All Modules)
| Filter Option | Description |
|---------------|-------------|
| All Time | No date restriction (default) |
| This Month | Current calendar month |
| Last Month | Previous calendar month |
| This Quarter | Current quarter |
| Custom Range | User-specified From/To dates |

#### 2. Role-Based Designer Filter

**Design Manager View (Projects):**
- Multi-select dropdown of designers
- Filter projects by assigned designer
- Track designer workload and performance

**Sales Manager View (Leads/Projects):**
- Shows designers assigned under that manager
- Measure designer-wise conversion and follow-up

#### 3. Hold Status Filter (Projects Only)
| Status | Description |
|--------|-------------|
| All Status | Show all projects |
| Active | Projects in progress |
| On Hold | Temporarily paused |
| Deactivated | Closed/cancelled |

#### 4. Sorting Options
| Module | Sort Fields |
|--------|-------------|
| Leads | Created Date, Updated Date, Budget |
| Projects | Created Date, Updated Date, Project Value |
| PreSales | Created Date, Updated Date, Budget |

Each with ascending/descending order support.

### UX Features
- ✅ **Sticky Filters**: Persist in localStorage until cleared
- ✅ **Clear All Filters**: One-click reset button
- ✅ **Active Filter Count**: Badge showing active filters
- ✅ **Visual Indicators**: Blue border/background on active filters

### API Parameters Added
```
GET /api/leads
  - designer_id: Filter by designer
  - sort_by: created_at | updated_at | budget
  - sort_order: asc | desc

GET /api/projects  
  - designer_id: Filter by collaborator
  - hold_status: Active | Hold | Deactivated
  - sort_by: created_at | updated_at | project_value
  - sort_order: asc | desc

GET /api/presales
  - time_filter: all | this_month | last_month | this_quarter | custom
  - start_date, end_date: For custom range
  - sort_by: created_at | updated_at | budget
  - sort_order: asc | desc
```

### Files Created/Modified
- **NEW**: `/app/frontend/src/components/AdvancedFilters.jsx` - Reusable filter component
- **MODIFIED**: `/app/frontend/src/pages/Leads.jsx`
- **MODIFIED**: `/app/frontend/src/pages/Projects.jsx`
- **MODIFIED**: `/app/frontend/src/pages/PreSales.jsx`
- **MODIFIED**: `/app/backend/server.py` - API endpoints updated

### Testing Status
- ✅ Backend: 40/40 tests passed (100%)
- ✅ Frontend: 11/11 features verified (100%)
- ✅ localStorage persistence confirmed
- ✅ Designer filter role-based visibility confirmed

---

## 🔜 Upcoming Tasks

### P1: Quotation Builder Module
- Create and manage quotes with material catalog and configurable pricing
- Integration with vendor master and material database

### P2: Cutlist Generator Module
- Generate panel-cutting lists from cabinet dimensions
- Optimize material usage for modular production

### P3: Backend Refactoring
- Break down the 22,000+ line `server.py` monolith into:
  - `/app/backend/routes/` - API route modules
  - `/app/backend/models/` - Pydantic models
  - `/app/backend/services/` - Business logic
  - `/app/backend/models/` - Pydantic models
  - `/app/backend/services/` - Business logic

### P3: Code Cleanup
- Fix deferred Python linting errors in `server.py`
- Remove duplicate API endpoint definitions

---

## Known Technical Debt
1. **CRITICAL**: `/app/backend/server.py` monolith (~22,000+ lines)
2. **Medium**: Duplicate API endpoints in `server.py`
3. **Low**: Deferred Python linting errors

---

## ✅ Document Attachment (Proof) Layer - COMPLETED Jan 11, 2026

Evidence layer for finance operations - supporting document uploads for audit compliance.

### Scope
| Module | Purpose | Examples |
|--------|---------|----------|
| Cashbook | Bills, vouchers, UPI screenshots | Transaction proofs |
| Expense Requests | Quotations, invoices | Approval documentation |
| Project Finance | Agreements, vendor invoices | Project documents |
| Liabilities | Invoice copies, payment proofs | Vendor documentation |

### Technical Specifications
- **Max file size**: 15MB per file
- **Allowed types**: PDF, JPG, PNG
- **Storage**: Local filesystem (`/app/backend/uploads/finance/{YYYY}/{MM}/`)
- **Architecture**: S3-ready abstraction for future migration
- **Retention**: Permanent (no auto-delete)

### Metadata Schema (`finance_attachments` collection)
```json
{
  "attachment_id": "att_xxx",
  "entity_type": "cashbook | expense | project | liability",
  "entity_id": "txn_xxx | exp_xxx | proj_xxx | lia_xxx",
  "file_name": "invoice.pdf",
  "file_path": "finance/2026/01/xxx.pdf",
  "file_size": 245000,
  "mime_type": "application/pdf",
  "description": "Vendor invoice for materials",
  "uploaded_by": "user_id",
  "uploaded_by_name": "User Name",
  "uploaded_at": "2026-01-11T..."
}
```

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/attachments/upload` | POST | Upload attachment (multipart/form-data) |
| `/api/finance/attachments/{entity_type}/{entity_id}` | GET | List attachments for entity |
| `/api/finance/attachments/download/{attachment_id}` | GET | Download file |
| `/api/finance/attachments/{attachment_id}` | DELETE | Delete attachment (uploader/admin only) |
| `/api/finance/attachments/by-ids` | GET | Get attachments by IDs (for exports) |

### Frontend Integration
- **AttachmentUploader component**: `/app/frontend/src/components/AttachmentUploader.jsx`
- **CashBook**: View transaction dialog → Supporting Documents section
- **ExpenseRequests**: View details dialog → Supporting Documents section
- **Liabilities**: View liability dialog → Supporting Documents section
- **ProjectFinanceDetail**: Project Documents section (max 50 files)

### Testing
- 25/25 backend API tests passed
- Frontend UI verified
- Test file: `/app/tests/test_document_attachments.py`

### CashBook Transaction Attachments Fix - COMPLETED Jan 11, 2026
Fixed partially implemented feature:

**1. CashBook Add Entry Modal**
- Added "Attach Documents" section at bottom of modal
- Supports multiple files (PDF, JPG, PNG up to 15MB)
- Files stored as `pendingFiles` state, uploaded after transaction creation
- Shows file list with remove option before submission

**2. Docs/Eye Icon Wiring**
- Docs column added to transaction table
- Eye icon opens Transaction Details dialog
- Dialog shows full transaction info + AttachmentUploader
- Supports upload/download/delete when day not locked

**3. ProjectFinanceDetail Integration**
- Added Docs column to Recent Transactions table
- Rows are now clickable
- Click opens read-only Transaction Details dialog
- Shows linked cashbook documents

**Testing**: 13 backend + 8 frontend tests passed (100%)


## ✅ BUCKET 1 - Operational Hygiene - COMPLETED Jan 11, 2026

Mandatory features for control and safety before production rollout.

### 1. Audit Trail Enhancement
Full read-only audit trail for all finance-related actions.

**Features:**
- Comprehensive logging of all finance operations (create/edit/delete/verify/settle)
- Logged entity types: cashbook, receipt, liability, project_finance, recurring_template, payment_reminder, system
- Logged actions: create, edit, delete, verify, settle, freeze, lock_override, allow_overrun, backup_created, backup_restored
- Filters: entity_type, action, date_from, date_to, user_id
- Pagination support
- Entity-specific history view
- Admin/Founder only access

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/audit-log` | GET | Get all audit entries with filters |
| `/api/finance/audit-log/entity/{type}/{id}` | GET | Get history for specific entity |

**Audit Log Entry Structure:**
- audit_id, entity_type, entity_id, action
- old_value (for edits/deletes), new_value (for creates/edits)
- user_id, user_name, timestamp, details

### 2. Scheduled Backups
Daily automated database backups via backend cron job.

**Features:**
- Manual backup creation (Admin only)
- **Automated daily backups at midnight (00:00 server time)** using apscheduler
- Backup listing with metadata
- Backup restoration (Admin only, with confirmation)
- Backups stored as JSON files in `/app/backend/backups/`
- Includes: finance, accounting, projects, leads, users, and more (18+ collections)
- Metadata-only for attachments (files not included)
- Scheduler status shown in UI with next run time

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/backup/create` | POST | Create manual backup |
| `/api/admin/backup/list` | GET | List available backups |
| `/api/admin/backup/restore/{id}` | POST | Restore from backup |
| `/api/admin/backup/scheduler-status` | GET | Get scheduler status |

### 3. Customer Payment Reminders (MOCKED)
Email reminder system for overdue payments - logs to DB instead of sending actual emails.

**Features:**
- Get overdue payments with configurable threshold (default 7 days)
- Send manual reminders from project finance
- Custom reminder messages supported
- Reminder history tracking
- Days since last reminder shown

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/reminders/overdue` | GET | Get projects with overdue payments |
| `/api/finance/reminders/send` | POST | Send (log) reminder |
| `/api/finance/reminders/history` | GET | Get reminder history |

**Note:** Emails are MOCKED - logged to `payment_reminders` collection instead of actually sent. Frontend shows "Mocked - Emails logged only" indicator.

### 4. Recurring Transactions
Monthly recurring templates that create **pending payables** (not auto cashbook entries).

**Workflow:**
1. Templates run on due date → Creates pending payable
2. Pending payables shown with overdue status
3. Manual "Record Payment" → Creates cashbook entry
4. Payment history tracked

**Features:**
- Create recurring templates (Admin/Founder/SeniorAccountant)
- Fields: name, amount, category, account, day_of_month (1-28), description, paid_to
- Active/Paused status toggle
- Generate due payables (Admin only)
- Pending payables list with overdue indicators
- Record payment with flexible amount/date/mode
- Cancel/skip occurrence option
- Payment history tracking

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/recurring/templates` | GET | List templates |
| `/api/finance/recurring/templates` | POST | Create template |
| `/api/finance/recurring/templates/{id}` | PUT | Update template |
| `/api/finance/recurring/templates/{id}/toggle` | POST | Pause/Resume |
| `/api/finance/recurring/run-scheduled` | POST | Generate due payables |
| `/api/finance/recurring/payables` | GET | List pending payables |
| `/api/finance/recurring/payables/{id}/pay` | POST | Record payment |
| `/api/finance/recurring/payables/{id}/cancel` | POST | Skip/cancel payable |

**Collections:**
- `recurring_templates` - Template definitions
- `recurring_payables` - Pending/paid payables

### Frontend Pages
| Route | Component | Access |
|-------|-----------|--------|
| `/admin/audit-trail` | AuditTrail.jsx | Admin/Founder |
| `/admin/backup` | BackupManagement.jsx | Admin |
| `/finance/payment-reminders` | PaymentReminders.jsx | Finance team |
| `/finance/recurring-transactions` | RecurringTransactions.jsx | Admin/Founder/SeniorAccountant |

### Files Added/Modified
- **Backend**: `/app/backend/server.py` (audit logging integration + BUCKET 1 endpoints)
- **Frontend Pages**: 
  - `/app/frontend/src/pages/AuditTrail.jsx`
  - `/app/frontend/src/pages/BackupManagement.jsx`
  - `/app/frontend/src/pages/PaymentReminders.jsx`
  - `/app/frontend/src/pages/RecurringTransactions.jsx`
- **Sidebar**: Added navigation links for all 4 pages

**Testing**: 24 backend + frontend tests passed (100%)

---

## ✅ Docker Deployment Package - COMPLETED Jan 16, 2026

Complete Docker-based deployment package for Contabo VPS (or any Ubuntu server).

**Deployment Method:** Docker + Docker Compose

### Files Created

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates all 3 services |
| `mongo-init.js` | Creates MongoDB app user with restricted access |
| `.env.example` | Root environment template |
| `backend/Dockerfile` | Python FastAPI container |
| `backend/.env.example` | Backend env template |
| `frontend/Dockerfile` | Multi-stage React + Nginx build |
| `frontend/nginx.conf` | Production Nginx config with API proxy |
| `frontend/.env.example` | Frontend env template |
| `README_DEPLOYMENT.md` | Complete deployment guide |
| `validate-deployment.sh` | Post-deployment verification script |

### Services

| Service | Port | Description |
|---------|------|-------------|
| MongoDB | 27017 | Database with authentication |
| Backend | 8001 | FastAPI server |
| Frontend | 80, 443 | Nginx serving React |

### MongoDB Security
- Authentication ENABLED (mandatory)
- Two users: `admin` (full), `arkiflo_app` (readWrite only)
- No hardcoded credentials
- App fails clearly if credentials wrong

### Volumes (Persistent)
- `arkiflo_mongo_data` - Database
- `arkiflo_uploads` - File uploads
- `arkiflo_backups` - Backup files

### Deployment Commands (4 only)
```bash
git clone <repo> && cd arkiflo
cp .env.example .env && nano .env  # Set passwords & URL
docker compose up -d
```

---

## 🔜 Upcoming Tasks

### P0 - High Priority
- [ ] Backend Cron Jobs for scheduled backups and recurring transactions (apscheduler integration)
- [ ] Real email integration for payment reminders (when needed)

### P1 - Medium Priority
- [ ] Backend refactoring of server.py monolith (~23,000+ lines)
- [ ] API endpoint deduplication

### P2 - Lower Priority
- [ ] Python linting cleanup
- [ ] 27 potential enhancements (AI insights, bank reconciliation, multi-currency, etc.)


---

## ✅ Docker Deployment Authentication Fix - COMPLETED Jan 19, 2026

**Critical bug fix** for the admin user seeding function that prevented login after fresh Docker deployment.

### Issues Fixed

1. **Field Name Mismatch**: `seed_initial_admin()` was creating users with `password_hash` field, but `local_login()` endpoint looks for `local_password` field
2. **Hashing Method Mismatch**: Seeder used direct `hashlib.sha256()`, but login verification uses `hash_password()` with a salt
3. **Missing Status Field**: Seeder didn't set `status: "Active"` which is required by the login endpoint

### Changes Made

**File:** `/app/backend/server.py` - `seed_initial_admin()` function

| Before | After |
|--------|-------|
| `"password_hash": hashlib.sha256(...)` | `"local_password": hash_password(...)` |
| `"is_active": True` | `"status": "Active"` |
| Missing `updated_at` | Added `"updated_at": datetime...` |

### Validation Steps for Contabo Deployment

```bash
# 1. Clean slate (WARNING: deletes all data)
docker compose down -v

# 2. Build and start
docker compose up -d --build

# 3. Wait for services
sleep 60

# 4. Check all services healthy
docker compose ps

# 5. Test health endpoint
curl http://localhost:8001/api/health

# 6. Test login with seed credentials from .env
curl -X POST http://localhost:8001/api/auth/local-login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_SEED_ADMIN_EMAIL","password":"YOUR_SEED_ADMIN_PASSWORD"}'
```

### Expected Login Response

```json
{"success":true,"message":"Login successful","user":{...}}
```

### Deployment File Checklist

- [x] `/app/docker-compose.yml` - Service orchestration
- [x] `/app/mongo-init.js` - MongoDB user initialization (authSource=admin)
- [x] `/app/.env.example` - Root environment template
- [x] `/app/backend/Dockerfile` - Backend container
- [x] `/app/frontend/Dockerfile` - Frontend container  
- [x] `/app/frontend/nginx.conf` - Nginx with API proxy
- [x] `/app/README_DEPLOYMENT.md` - Complete deployment guide
- [x] `/app/validate-deployment.sh` - Post-deployment verification
- [x] `/app/backend/server.py` - Fixed seed_initial_admin() function

---

## ✅ Financial Gates (Milestone Payment Control) - COMPLETED Jan 28, 2026

A strict financial control system that blocks specific project milestones until payment is confirmed by Accounts or explicitly overridden by Admin/Founder.

### Features Implemented:
- [x] **Payment-Gated Milestones** - Two milestones require payment confirmation before completion:
  - `payment_collection_50` (50% Payment Collection - Design Finalization stage)
  - `full_order_confirmation_45` (45% Payment Collection - Production stage)
- [x] **Role-Based Blocking** - Operational roles (Designer, ProductionOpsManager, etc.) are HARD BLOCKED from completing gated milestones
- [x] **Accountant Confirmation** - All accountant roles can confirm payment, unlocking the milestone
- [x] **Admin Override** - Admin/Founder can complete milestones without payment confirmation
- [x] **Audit Trail** - Admin overrides are logged as system comments with metadata
- [x] **Automatic Notifications** - Accounts team notified when a blocked user attempts to complete

### Blocking Logic:
```
If milestone is payment_collection_50 OR full_order_confirmation_45:
  If user role is Admin OR Founder:
    ALLOW + LOG OVERRIDE (if not confirmed)
  Else if payment NOT confirmed by Accounts:
    BLOCK with 403 error + notify Accounts team
  Else:
    ALLOW (payment confirmed)
```

### Override Logging:
When Admin/Founder overrides a payment gate, a system comment is created:
```json
{
  "type": "payment_gate_override",
  "milestone_id": "payment_collection_50",
  "milestone_name": "50% Payment Collection",
  "override_by": "user_id",
  "override_by_name": "Admin Name",
  "override_by_role": "Admin",
  "timestamp": "2026-01-28T17:30:00Z"
}
```

### Accountant Roles (Can Confirm Payment):
- JuniorAccountant
- SeniorAccountant
- FinanceManager
- CharteredAccountant
- Accountant

### API Endpoints:
- `POST /api/projects/{project_id}/substage/complete` - Modified to check payment gates
- `POST /api/projects/{project_id}/confirm-milestone-payment/{milestone_id}` - Accountant confirms payment
- `GET /api/projects/{project_id}/milestone-payment-status` - Get confirmation status for gated milestones

### Test Credentials:
- **Admin**: test.admin.gates@example.com
- **Designer**: test.designer.gates@example.com
- **Accountant**: test.accountant.gates@example.com
- **Test Project**: proj_gatetest_622f737e

### Test File:
- `/app/backend/tests/test_financial_gates.py`

---

## ✅ Direct Google OAuth Migration - COMPLETED Jan 19, 2026

**Removed Emergent as OAuth middleman.** Google authentication is now handled entirely by our backend.

### What Changed

| Component | Before | After |
|-----------|--------|-------|
| OAuth Flow | Via `auth.emergentagent.com` | Direct to Google |
| Token Verification | Emergent API | Google's public keys |
| Client ID | Emergent's | Your own (Google Cloud Console) |
| Control | Third-party dependency | Full ownership |

### New Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/google/login` | GET | Redirects to Google consent screen |
| `/api/auth/google/callback` | GET | Handles Google response, creates session |

### New Environment Variables

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
```

### Files Modified

- `/app/backend/server.py` - Added Google OAuth endpoints and imports
- `/app/backend/requirements.txt` - Added google-auth libraries
- `/app/backend/.env` - Added Google OAuth variables
- `/app/frontend/src/pages/Login.jsx` - Changed Google button to use our backend
- `/app/docker-compose.yml` - Added Google OAuth env vars to backend service
- `/app/.env.example` - Added Google OAuth configuration section

### Files Created

- `/app/GOOGLE_OAUTH_SETUP.md` - Step-by-step Google Cloud Console setup guide

### Session Handling

Uses **exactly the same mechanism** as local login:
- `session_token` in httpOnly cookie
- `user_sessions` collection in MongoDB
- 7-day expiration
- Same cookie flags (secure, samesite=none)

### Backward Compatibility

- ✅ Local login (`/api/auth/local-login`) unchanged and working
- ✅ User schema unchanged (added optional `google_sub` field)
- ✅ Session handling unchanged
- ✅ All other auth endpoints unchanged

---

## ✅ Frontend Docker Build Fix - Jan 19, 2026

Fixed AJV/node-gyp module errors in Docker build.

### Change

| Before | After |
|--------|-------|
| `node:18-alpine` | `node:18-bullseye-slim` |

**Reason:** Alpine uses musl libc which causes issues with some native npm modules (like AJV's optional native dependencies). Debian-based image (bullseye-slim) uses glibc which is more compatible.

### Dockerfile Changes

```dockerfile
# Before
FROM node:18-alpine AS builder

# After  
FROM node:18-bullseye-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ git
```

---

## ✅ Leads Status Filter - COMPLETED Feb 3, 2026

Added a status filter dropdown (Active, Hold, Deactivated) to the Leads page, matching the filtering capabilities of the Projects page.

### Features Implemented:
- [x] **Status Dropdown Filter** - All Status, Active, On Hold, Deactivated options
- [x] **Backend Filter Support** - `hold_status` query parameter on GET /api/leads
- [x] **Active Status Logic** - Shows leads with `hold_status='Active'` or null (default active)
- [x] **localStorage Persistence** - Filter selection persists across page reloads
- [x] **Clear Filters Button** - Resets status filter to "All Status"
- [x] **Visual Badge Display** - Hold/Deactivated badges shown on lead rows

### Files Modified:
- `/app/backend/server.py` - Added `hold_status` parameter to `GET /api/leads` endpoint
- `/app/frontend/src/pages/Leads.jsx` - Added `showHoldStatus={true}` to AdvancedFilters component and `hold_status` API parameter

### API Changes:
- `GET /api/leads?hold_status=Active|Hold|Deactivated` - Filter leads by activity status

### Testing:
- Backend: 11/11 tests passed
- Frontend: 6/6 features verified
- Test file: `/app/backend/tests/test_leads_hold_status_filter.py`

---

## ✅ Incentive & Commission Approval Workflow - COMPLETED Feb 17, 2026

Implemented a full approval lifecycle for Incentives and Commissions modules with audit trail tracking.

### Features Implemented:

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **Draft Status** | Create incentives/commissions as draft for later submission | ✅ |
| 2 | **Pending Approval Status** | Default status when created without explicit draft | ✅ |
| 3 | **Submit for Approval** | Draft → Pending Approval transition | ✅ |
| 4 | **Approve Action** | Managers can approve pending items for payment | ✅ |
| 5 | **Reject Action** | Managers can reject with mandatory reason | ✅ |
| 6 | **Payout Action** | Only approved items can be paid out | ✅ |
| 7 | **Edit Restrictions** | Cannot edit paid or approved items | ✅ |
| 8 | **Delete Restrictions** | Cannot delete approved/paid items | ✅ |
| 9 | **Re-submission Flow** | Rejected items auto-resubmit when edited | ✅ |
| 10 | **Full Audit Trail** | History array tracks all status changes with user info | ✅ |

### Status Lifecycle:
```
draft → pending_approval → approved → paid
                       ↘ rejected → (edit) → pending_approval
```

### Data Model Updates:
```json
{
  "status": "draft | pending_approval | approved | paid | rejected",
  "approved_by": "user_id",
  "approved_by_name": "User Name",
  "approved_at": "datetime",
  "rejected_by": "user_id",
  "rejected_by_name": "User Name",
  "rejected_at": "datetime",
  "rejection_reason": "string",
  "paid_by": "user_id",
  "paid_by_name": "User Name",
  "paid_at": "datetime",
  "history": [
    {
      "action": "created | submitted | approved | rejected | edited | paid",
      "status": "current_status",
      "by": "user_id",
      "by_name": "User Name",
      "at": "datetime",
      "notes": "optional notes"
    }
  ]
}
```

### API Endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/incentives` | POST | Create incentive (status: draft/pending_approval) |
| `/api/finance/incentives/{id}/submit` | PUT | Submit draft for approval |
| `/api/finance/incentives/{id}/approve` | PUT | Approve incentive |
| `/api/finance/incentives/{id}/reject` | PUT | Reject with reason |
| `/api/finance/incentives/{id}` | PUT | Edit (draft/pending/rejected only) |
| `/api/finance/incentives/{id}` | DELETE | Delete (draft/pending only) |
| `/api/finance/incentives/{id}/payout` | POST | Process payout (approved only) |
| `/api/finance/commissions` | POST | Create commission |
| `/api/finance/commissions/{id}/submit` | PUT | Submit draft for approval |
| `/api/finance/commissions/{id}/approve` | PUT | Approve commission |
| `/api/finance/commissions/{id}/reject` | PUT | Reject with reason |
| `/api/finance/commissions/{id}` | PUT | Edit (draft/pending/rejected only) |
| `/api/finance/commissions/{id}` | DELETE | Delete (draft/pending only) |
| `/api/finance/commissions/{id}/payout` | POST | Process payout (approved only) |

### Files Modified:
- `/app/backend/server.py` - Added status field to Pydantic models, fixed commission payout history tracking, updated payout request models

### Test File Created:
- `/app/backend/tests/test_approval_workflow.py` - 13 comprehensive tests for approval lifecycle

### Testing Results:
- 13/13 tests passed
- Covers: create, submit, approve, reject, edit restrictions, delete restrictions, payout, audit trail

---

## Next Priority Tasks

### P1 - Quotation Builder Module
- Lightweight, canvas-based tool for creating tentative quotations
- PDF export capability

### P2 - Backend Refactoring
- Decompose monolithic `/app/backend/server.py` (~11,000 lines) into modular structure
- Separate routes, models, and services

### Future Tasks
- Finance Overview Dashboard
- Intern/Trainee Role
- Authentication Rules Refinement
