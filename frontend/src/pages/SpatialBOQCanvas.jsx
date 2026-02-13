import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Save, Download, Grid,
  Square, ZoomIn, ZoomOut, MousePointer,
  Eye, Package, FileText, ChevronLeft, ChevronRight,
  DoorOpen, PanelTop, Layers, Move, Maximize2, X,
  RectangleHorizontal, SquareIcon, Pencil, GripVertical,
  Undo2, Redo2, RotateCw, FlipHorizontal, FlipVertical,
  Slice, Circle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

const API = process.env.REACT_APP_BACKEND_URL;

// Scale: pixels per mm
const DEFAULT_SCALE = 0.15;
const DEFAULT_WALL_THICKNESS = 150;
const DEFAULT_WALL_HEIGHT = 3000; // Item #1 - Wall height default
const SNAP_THRESHOLD = 100; // mm - magnetic snap distance
const CORNER_SNAP_THRESHOLD = 150; // mm - for corner joining
const MOVE_STEP = 10; // mm per arrow key press
const ENDPOINT_HANDLE_SIZE = 12; // pixels
const VERTEX_HITBOX_RADIUS = 16; // pixels - invisible hitbox for vertex selection (larger than visual)
const MAX_HISTORY_SIZE = 50; // Undo/Redo history limit
const ANGLE_SNAP_TOLERANCE = 8; // degrees - Item #2 - Auto straight line assistance
const CLOSURE_TOLERANCE = 200; // mm - tolerance for auto-sealing room closure gaps

// CAD Precision Enhancement Constants
const ENDPOINT_SNAP_THRESHOLD = 150; // mm - high priority endpoint snap (increased for better UX)
const MIDPOINT_SNAP_THRESHOLD = 120; // mm - midpoint snap threshold (increased for better UX)
const GRID_SNAP_SIZE = 50; // mm - grid snap increment
const ALIGNMENT_THRESHOLD = 50; // mm - alignment guide threshold (increased)
const VERTEX_MERGE_THRESHOLD = 150; // mm - auto-merge vertices when dragged close (increased)

// Module colors
const MODULE_COLORS = {
  base_cabinet: '#8B5CF6',
  wall_cabinet: '#3B82F6',
  tall_unit: '#10B981',
  loft_unit: '#F59E0B',
  appliance_hob: '#EF4444',
  appliance_chimney: '#6366F1',
  appliance_microwave: '#EC4899',
  appliance_oven: '#F97316',
  appliance_dishwasher: '#14B8A6',
  appliance_sink: '#0EA5E9',
  door: '#78716C',
  window: '#38BDF8'
};

// Carcass material options
const CARCASS_MATERIALS = {
  plywood_710: { name: 'BWR Plywood 710', grade: 'Premium' },
  plywood_303: { name: 'MR Plywood 303', grade: 'Standard' },
  hdhmr: { name: 'HDHMR', grade: 'Premium' },
  particle_board: { name: 'Particle Board', grade: 'Economy' },
  mdf: { name: 'MDF', grade: 'Standard' }
};

// Carcass finish options (NEW - Item #8)
const CARCASS_FINISHES = {
  laminate: { name: 'Laminate', description: 'Standard laminate finish' },
  pu_white: { name: 'PU White', description: 'White polyurethane paint' },
  pu_color: { name: 'PU Colored', description: 'Colored polyurethane paint' },
  melamine: { name: 'Melamine', description: 'Pre-laminated melamine' },
  veneer: { name: 'Veneer', description: 'Natural wood veneer' },
  raw: { name: 'Raw/Unfinished', description: 'No carcass finish' }
};

// Door types library (Item #5)
const DOOR_TYPES = [
  { id: 'single_swing', name: 'Single Swing', width: 900, height: 2100, icon: '🚪' },
  { id: 'double_swing', name: 'Double Swing', width: 1500, height: 2100, icon: '🚪🚪' },
  { id: 'sliding', name: 'Sliding Door', width: 1200, height: 2100, icon: '↔️' },
  { id: 'pocket', name: 'Pocket Door', width: 900, height: 2100, icon: '📥' },
  { id: 'french', name: 'French Door', width: 1800, height: 2100, icon: '🏠' }
];

// Window types library (Item #5)
const WINDOW_TYPES = [
  { id: 'standard', name: 'Standard Window', width: 1200, height: 1200, icon: '🪟' },
  { id: 'large', name: 'Large Window', width: 1800, height: 1500, icon: '🪟' },
  { id: 'small', name: 'Small Window', width: 600, height: 600, icon: '◽' },
  { id: 'floor_ceiling', name: 'Floor to Ceiling', width: 1500, height: 2400, icon: '📐' },
  { id: 'bay', name: 'Bay Window', width: 2000, height: 1200, icon: '🏠' }
];

// Wall drawing modes (Item #4)
const WALL_DRAW_MODES = {
  free: { name: 'Straight Wall', icon: Pencil, desc: 'Draw individual walls' },
  rectangle: { name: 'Rectangle Room', icon: RectangleHorizontal, desc: 'Drag to create 4 walls' },
  square: { name: 'Square Room', icon: SquareIcon, desc: 'Create equal-sided room' },
  arc: { name: 'Arc Wall', icon: Circle, desc: 'Draw curved walls' }
};

// Arc wall input methods
const ARC_INPUT_METHODS = {
  radius: { name: 'Radius', desc: 'Define by radius value' },
  chordHeight: { name: 'Chord Height (String Height)', desc: 'Define by bulge height' }
};

export default function SpatialBOQCanvas() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [moduleLibrary, setModuleLibrary] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Canvas state
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [panOffset, setPanOffset] = useState({ x: 50, y: 50 });
  const [tool, setTool] = useState('select');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedModuleType, setSelectedModuleType] = useState(null);
  const [splitPreview, setSplitPreview] = useState(null); // { wallId, x, y } - preview split point
  const [splitMarkers, setSplitMarkers] = useState([]); // Array of {x, y, angle} - shows dotted lines at split points
  const [selectedVertex, setSelectedVertex] = useState(null); // { x, y, walls: [] } - selected junction point

  // Panel collapse state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);

  // Pan state (Item #1 - Canvas pan)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [spacePressed, setSpacePressed] = useState(false);

  // Elevation view drag state (Item #3 - Editable elevation)
  const [elevationDragModule, setElevationDragModule] = useState(null);
  const [elevationDragStart, setElevationDragStart] = useState(null);

  // Undo/Redo history (Item #6-add)
  const [undoHistory, setUndoHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const lastLayoutRef = useRef(null);

  // Inline dimension editing (Item #6)
  const [editingDimension, setEditingDimension] = useState(null);
  const [dimensionInputValue, setDimensionInputValue] = useState('');
  const dimensionInputRef = useRef(null);

  // Floor polygon detection (Item #5)
  const [detectedFloor, setDetectedFloor] = useState(null);
  const [manualFloorFill, setManualFloorFill] = useState(null); // Manual floor fill backup
  const [floorMaterial, setFloorMaterial] = useState('tiles-white'); // Floor material selection

  // Floor material options
  const FLOOR_MATERIALS = {
    'tiles-white': { name: 'Tiles – White', color: '#F5F5F5', pattern: 'tiles' },
    'tiles-grey': { name: 'Tiles – Grey', color: '#D1D5DB', pattern: 'tiles' },
    'tiles-beige': { name: 'Tiles – Beige', color: '#E8DCC8', pattern: 'tiles' },
    'wood-light': { name: 'Wood – Light Oak', color: '#DEB887', pattern: 'wood' },
    'wood-walnut': { name: 'Wood – Walnut', color: '#8B5A2B', pattern: 'wood' },
    'marble-white': { name: 'Marble – White', color: '#FAFAFA', pattern: 'marble' },
    'granite-black': { name: 'Granite – Black', color: '#2D2D2D', pattern: 'granite' },
    'concrete': { name: 'Concrete', color: '#9CA3AF', pattern: 'solid' }
  };

  // Wall drawing state - Click-Release mode (Item #4)
  const [wallDrawMode, setWallDrawMode] = useState('free'); // rectangle, square, free, arc
  const [showWallModePanel, setShowWallModePanel] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [tempWall, setTempWall] = useState(null);
  const [tempRectWalls, setTempRectWalls] = useState(null);
  const [wallClickMode, setWallClickMode] = useState(null); // 'waiting_end' for click-release mode

  // Arc wall state
  const [arcInputMethod, setArcInputMethod] = useState('radius'); // 'radius' or 'chordHeight'
  const [arcRadiusInput, setArcRadiusInput] = useState('1000'); // Default radius in mm
  const [arcChordHeightInput, setArcChordHeightInput] = useState('500'); // Default chord height in mm
  const [tempArcWall, setTempArcWall] = useState(null); // { start, end, radius, chordHeight, bulgeDirection, centerX, centerY, startAngle, endAngle, sweepFlag }
  const [arcBulgeDirection, setArcBulgeDirection] = useState(1); // 1 or -1 for left/right bulge

  // Module-to-Wall distance editing (Item #8)
  const [editingModuleDistance, setEditingModuleDistance] = useState(null);
  const [moduleDistanceValue, setModuleDistanceValue] = useState('');
  const moduleDistanceInputRef = useRef(null);

  // Drag state for modules/walls/openings
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragType, setDragType] = useState(null); // 'module', 'wall', 'wall_endpoint', 'door', 'window'
  const [dragEndpoint, setDragEndpoint] = useState(null); // 'start' or 'end' for wall endpoints
  const [activeRectLoop, setActiveRectLoop] = useState(null); // Stores detected rectangular loop at drag start

  // CAD Precision Enhancement State - Coohom-style
  const [snapIndicator, setSnapIndicator] = useState(null); // { x, y, type: 'endpoint'|'grid' }
  const [alignmentGuides, setAlignmentGuides] = useState([]); // [{ type: 'horizontal'|'vertical', position }]
  const [shiftKeyHeld, setShiftKeyHeld] = useState(false); // For orthogonal constraint
  const [orthoMode, setOrthoMode] = useState(true); // Coohom-style ortho mode (default ON)
  const [drawingDimension, setDrawingDimension] = useState(null); // { length, angle, x, y } - live dimension display
  const [preClickSnap, setPreClickSnap] = useState(null); // { x, y, type } - shows snap point BEFORE click
  const [hoveredVertex, setHoveredVertex] = useState(null); // { x, y, wallIds } - vertex being hovered
  const [connectionSuggestions, setConnectionSuggestions] = useState([]); // Suggested endpoints to connect to
  const [canCloseShape, setCanCloseShape] = useState(null); // { x, y } - if current line can close a shape
  const [chainStartIndicator, setChainStartIndicator] = useState(null); // { x, y } - start point of open chain for visual
  const [projectedIntersections, setProjectedIntersections] = useState([]); // Predicted wall intersections
  const [loopClosureProjection, setLoopClosureProjection] = useState(null); // Projected room closure point

  // Elevation view - full screen mode (Item #9)
  const [showElevationModal, setShowElevationModal] = useState(false);

  // Floor material panel toggle
  const [showFloorMaterialPanel, setShowFloorMaterialPanel] = useState(true);

  // Door/Window library panel (Item #5)
  const [showDoorLibrary, setShowDoorLibrary] = useState(false);
  const [showWindowLibrary, setShowWindowLibrary] = useState(false);
  const [selectedDoorType, setSelectedDoorType] = useState(null);
  const [selectedWindowType, setSelectedWindowType] = useState(null);

  // Modals
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Room name
  const [roomName, setRoomName] = useState('Kitchen');

  // Save layout to undo history (Item #6-add)
  const saveToHistory = useCallback(() => {
    if (!layout) return;
    const snapshot = JSON.stringify(layout);
    if (snapshot !== lastLayoutRef.current) {
      setUndoHistory(prev => {
        const newHistory = [...prev, lastLayoutRef.current].filter(Boolean);
        if (newHistory.length > MAX_HISTORY_SIZE) {
          return newHistory.slice(-MAX_HISTORY_SIZE);
        }
        return newHistory;
      });
      setRedoHistory([]);
      lastLayoutRef.current = snapshot;
    }
  }, [layout]);

  // Undo function (Item #6-add)
  const handleUndo = useCallback(() => {
    if (undoHistory.length === 0) return;
    const currentSnapshot = JSON.stringify(layout);
    const previousSnapshot = undoHistory[undoHistory.length - 1];
    
    setRedoHistory(prev => [...prev, currentSnapshot]);
    setUndoHistory(prev => prev.slice(0, -1));
    setLayout(JSON.parse(previousSnapshot));
    lastLayoutRef.current = previousSnapshot;
    setHasChanges(true);
  }, [undoHistory, layout]);

  // Redo function (Item #6-add)
  const handleRedo = useCallback(() => {
    if (redoHistory.length === 0) return;
    const currentSnapshot = JSON.stringify(layout);
    const nextSnapshot = redoHistory[redoHistory.length - 1];
    
    setUndoHistory(prev => [...prev, currentSnapshot]);
    setRedoHistory(prev => prev.slice(0, -1));
    setLayout(JSON.parse(nextSnapshot));
    lastLayoutRef.current = nextSnapshot;
    setHasChanges(true);
  }, [redoHistory, layout]);

  // Detect closed floor polygon (Item #2 - Auto Floor Detection - IMPROVED)
  const detectFloorPolygon = useCallback(() => {
    if (!layout?.walls || layout.walls.length < 3) {
      setDetectedFloor(null);
      return;
    }

    // Use generous tolerance for coordinate matching (auto-seal small gaps)
    const COORD_TOLERANCE = CLOSURE_TOLERANCE;

    // Helper to check if two points are close enough to be considered same
    const pointsMatch = (x1, y1, x2, y2) => {
      const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      return dist <= COORD_TOLERANCE;
    };

    // Round coordinates to nearest tolerance bucket
    const coordKey = (x, y) => `${Math.round(x / COORD_TOLERANCE) * COORD_TOLERANCE},${Math.round(y / COORD_TOLERANCE) * COORD_TOLERANCE}`;

    // Build adjacency map of wall endpoints with tolerance
    const endpoints = new Map();
    
    for (const wall of layout.walls) {
      const startKey = coordKey(wall.start_x, wall.start_y);
      const endKey = coordKey(wall.end_x, wall.end_y);
      
      if (!endpoints.has(startKey)) endpoints.set(startKey, []);
      if (!endpoints.has(endKey)) endpoints.set(endKey, []);
      
      endpoints.get(startKey).push({ wall, isStart: true, other: endKey, x: wall.start_x, y: wall.start_y });
      endpoints.get(endKey).push({ wall, isStart: false, other: startKey, x: wall.end_x, y: wall.end_y });
    }

    // Try to find closed loops - allow some tolerance in connection counts
    // A closed polygon should have each vertex connected to exactly 2 walls
    let validVertices = 0;
    let totalVertices = 0;
    for (const [key, connections] of endpoints) {
      totalVertices++;
      if (connections.length === 2) {
        validVertices++;
      }
    }

    // Need at least 3 vertices and most should have 2 connections
    if (totalVertices < 3) {
      setDetectedFloor(null);
      return;
    }

    // Calculate the polygon by traversing connected walls
    // Try starting from different vertices if needed
    let bestPolygon = null;
    
    for (const [startKey, startConnections] of endpoints) {
      if (startConnections.length < 2) continue;
      
      const polygon = [];
      const visitedWalls = new Set();
      let currentKey = startKey;
      let prevWallId = null;
      let iterations = 0;
      const maxIterations = layout.walls.length * 3;

      while (iterations < maxIterations) {
        iterations++;
        const connections = endpoints.get(currentKey);
        if (!connections || connections.length === 0) break;

        // Find the average position for this vertex (in case of slight misalignment)
        const avgX = connections.reduce((sum, c) => sum + c.x, 0) / connections.length;
        const avgY = connections.reduce((sum, c) => sum + c.y, 0) / connections.length;
        polygon.push({ x: avgX, y: avgY });

        // Find next unvisited wall connection
        const next = connections.find(c => !visitedWalls.has(c.wall.wall_id) && c.wall.wall_id !== prevWallId);
        if (!next) {
          // Try to find any connection back to start
          const backToStart = connections.find(c => c.other === startKey);
          if (backToStart && polygon.length >= 3) {
            // We've completed the loop
            if (!bestPolygon || polygon.length > bestPolygon.length) {
              bestPolygon = [...polygon];
            }
          }
          break;
        }

        prevWallId = next.wall.wall_id;
        visitedWalls.add(next.wall.wall_id);
        currentKey = next.other;

        // Check if we're back at start
        if (currentKey === startKey && polygon.length >= 3) {
          if (!bestPolygon || polygon.length > bestPolygon.length) {
            bestPolygon = [...polygon];
          }
          break;
        }
      }
    }

    if (bestPolygon && bestPolygon.length >= 3) {
      // Calculate interior polygon (account for wall thickness)
      const interiorPolygon = calculateInteriorPolygon(bestPolygon, DEFAULT_WALL_THICKNESS / 2);
      setDetectedFloor(interiorPolygon);
      return;
    }

    // Fallback: try to detect rectangle from 4 walls even if not perfectly connected
    if (layout.walls.length === 4) {
      const allPoints = [];
      for (const wall of layout.walls) {
        allPoints.push({ x: wall.start_x, y: wall.start_y });
        allPoints.push({ x: wall.end_x, y: wall.end_y });
      }
      
      // Find bounding rectangle
      const minX = Math.min(...allPoints.map(p => p.x));
      const maxX = Math.max(...allPoints.map(p => p.x));
      const minY = Math.min(...allPoints.map(p => p.y));
      const maxY = Math.max(...allPoints.map(p => p.y));
      
      // Check if points roughly form a rectangle
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
      
      let matchedCorners = 0;
      for (const corner of corners) {
        if (allPoints.some(p => pointsMatch(p.x, p.y, corner.x, corner.y))) {
          matchedCorners++;
        }
      }
      
      // If at least 3 corners match, treat as rectangle
      if (matchedCorners >= 3) {
        const halfThickness = DEFAULT_WALL_THICKNESS / 2;
        const interiorPolygon = [
          { x: minX + halfThickness, y: minY + halfThickness },
          { x: maxX - halfThickness, y: minY + halfThickness },
          { x: maxX - halfThickness, y: maxY - halfThickness },
          { x: minX + halfThickness, y: maxY - halfThickness }
        ];
        setDetectedFloor(interiorPolygon);
        return;
      }
    }

    setDetectedFloor(null);
  }, [layout?.walls]);

  // Helper function to calculate interior polygon offset by wall thickness
  const calculateInteriorPolygon = (polygon, offset) => {
    if (polygon.length < 3) return polygon;
    
    // Simple interior offset - move each vertex toward center
    const centroidX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
    const centroidY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
    
    return polygon.map(p => {
      const dx = centroidX - p.x;
      const dy = centroidY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return p;
      
      const moveX = (dx / dist) * offset;
      const moveY = (dy / dist) * offset;
      
      return { x: p.x + moveX, y: p.y + moveY };
    });
  };

  // ============================================
  // UNIFIED WALL BOUNDARY ENGINE
  // Detects closed wall loops AND open wall chains, generates unified boundary polygons
  // with proper miter joins at all corners (no overlap)
  // Handles multiple separate groups in the same layout
  // Also handles T-junctions where one wall meets the middle of another
  // ============================================
  
  // Helper: Check if two walls are collinear (same direction) at a shared vertex
  const areWallsCollinear = (wall1, wall2, sharedX, sharedY, angleTolerance = 15) => {
    // Get directions of both walls FROM the shared point
    const getWallDirection = (wall, fromX, fromY) => {
      const isStart = Math.abs(wall.start_x - fromX) < 10 && Math.abs(wall.start_y - fromY) < 10;
      if (isStart) {
        return { dx: wall.end_x - wall.start_x, dy: wall.end_y - wall.start_y };
      } else {
        return { dx: wall.start_x - wall.end_x, dy: wall.start_y - wall.end_y };
      }
    };
    
    const dir1 = getWallDirection(wall1, sharedX, sharedY);
    const dir2 = getWallDirection(wall2, sharedX, sharedY);
    
    // Calculate angle between the two directions
    const dot = dir1.dx * dir2.dx + dir1.dy * dir2.dy;
    const len1 = Math.sqrt(dir1.dx * dir1.dx + dir1.dy * dir1.dy);
    const len2 = Math.sqrt(dir2.dx * dir2.dx + dir2.dy * dir2.dy);
    
    if (len1 === 0 || len2 === 0) return false;
    
    const cosAngle = dot / (len1 * len2);
    // Collinear means angle is ~180° (walls go in opposite directions from shared point)
    // or ~0° (walls continue in same direction - but this shouldn't happen at same vertex)
    return Math.abs(cosAngle + 1) < Math.cos((180 - angleTolerance) * Math.PI / 180) + 1;
  };
  
  const computeUnifiedWallBoundary = useCallback(() => {
    if (!layout?.walls || layout.walls.length === 0) {
      return null;
    }

    const walls = layout.walls;
    const tolerance = CLOSURE_TOLERANCE;

    // Build adjacency graph from wall endpoints
    const coordKey = (x, y) => `${Math.round(x / tolerance) * tolerance},${Math.round(y / tolerance) * tolerance}`;
    
    const vertices = new Map(); // key -> { x, y, walls: [{wall, isStart, otherKey}] }
    
    for (const wall of walls) {
      const startKey = coordKey(wall.start_x, wall.start_y);
      const endKey = coordKey(wall.end_x, wall.end_y);
      
      if (!vertices.has(startKey)) {
        vertices.set(startKey, { x: wall.start_x, y: wall.start_y, walls: [] });
      }
      if (!vertices.has(endKey)) {
        vertices.set(endKey, { x: wall.end_x, y: wall.end_y, walls: [] });
      }
      
      vertices.get(startKey).walls.push({ wall, isStart: true, otherKey: endKey });
      vertices.get(endKey).walls.push({ wall, isStart: false, otherKey: startKey });
    }

    // ============================================
    // MID-SPAN T-JUNCTION DETECTION
    // Detect when a wall endpoint lies on the middle of another wall
    // ============================================
    const midSpanTJunctions = [];
    const T_JUNCTION_DIST_THRESHOLD = 50; // mm - how close endpoint must be to wall line
    
    for (const stemWall of walls) {
      // Check both endpoints of the stem wall
      for (const isStart of [true, false]) {
        const endpointX = isStart ? stemWall.start_x : stemWall.end_x;
        const endpointY = isStart ? stemWall.start_y : stemWall.end_y;
        
        // Check against all other walls
        for (const throughWall of walls) {
          if (throughWall.wall_id === stemWall.wall_id) continue;
          
          // Check if endpoint is at either endpoint of the through wall (not mid-span)
          const atThroughStart = Math.abs(endpointX - throughWall.start_x) < tolerance && 
                                 Math.abs(endpointY - throughWall.start_y) < tolerance;
          const atThroughEnd = Math.abs(endpointX - throughWall.end_x) < tolerance && 
                               Math.abs(endpointY - throughWall.end_y) < tolerance;
          
          if (atThroughStart || atThroughEnd) continue; // Not mid-span
          
          // Calculate distance from endpoint to through-wall line segment
          const twDx = throughWall.end_x - throughWall.start_x;
          const twDy = throughWall.end_y - throughWall.start_y;
          const twLen = Math.sqrt(twDx * twDx + twDy * twDy);
          
          if (twLen < 10) continue;
          
          // Project endpoint onto through-wall line
          const toEndpointX = endpointX - throughWall.start_x;
          const toEndpointY = endpointY - throughWall.start_y;
          const t = (toEndpointX * twDx + toEndpointY * twDy) / (twLen * twLen);
          
          // Check if projection is within the wall segment (not at endpoints)
          if (t < 0.05 || t > 0.95) continue;
          
          // Calculate closest point on wall
          const closestX = throughWall.start_x + t * twDx;
          const closestY = throughWall.start_y + t * twDy;
          
          // Distance from endpoint to closest point on wall
          const dist = Math.sqrt(
            (endpointX - closestX) * (endpointX - closestX) + 
            (endpointY - closestY) * (endpointY - closestY)
          );
          
          if (dist < T_JUNCTION_DIST_THRESHOLD) {
            // Found a mid-span T-junction!
            const throughThickness = throughWall.thickness || DEFAULT_WALL_THICKNESS;
            const stemThickness = stemWall.thickness || DEFAULT_WALL_THICKNESS;
            
            // Get stem direction (away from through wall)
            const stemOtherX = isStart ? stemWall.end_x : stemWall.start_x;
            const stemOtherY = isStart ? stemWall.end_y : stemWall.start_y;
            const stemDx = stemOtherX - endpointX;
            const stemDy = stemOtherY - endpointY;
            const stemLen = Math.sqrt(stemDx * stemDx + stemDy * stemDy);
            
            // Through wall direction (normalized)
            const throughDirX = twDx / twLen;
            const throughDirY = twDy / twLen;
            
            midSpanTJunctions.push({
              x: closestX, // Use the closest point on through wall as junction point
              y: closestY,
              throughWall: throughWall,
              throughWallIds: [throughWall.wall_id],
              stemWall: stemWall,
              throughThickness: throughThickness,
              stemThickness: stemThickness,
              stemDirX: stemLen > 0 ? stemDx / stemLen : 0,
              stemDirY: stemLen > 0 ? stemDy / stemLen : 0,
              throughDirX: throughDirX,
              throughDirY: throughDirY,
              isMidSpan: true
            });
            
            console.log(`[T-Junction] Mid-span detected: stem ${stemWall.wall_id} connects to ${throughWall.wall_id} at (${closestX.toFixed(0)}, ${closestY.toFixed(0)})`);
          }
        }
      }
    }

    // Find all closed loops by looking for cycles in the graph
    const closedLoops = [];
    const processedWalls = new Set();

    // Helper: At a T-junction vertex, find the wall that continues collinearly with the incoming wall
    const findCollinearContinuation = (vertex, incomingWallId) => {
      if (vertex.walls.length !== 3) return null;
      
      const incomingConn = vertex.walls.find(c => c.wall.wall_id === incomingWallId);
      if (!incomingConn) return null;
      
      // Find which of the other two walls is collinear with the incoming wall
      const otherConns = vertex.walls.filter(c => c.wall.wall_id !== incomingWallId);
      for (const conn of otherConns) {
        if (areWallsCollinear(incomingConn.wall, conn.wall, vertex.x, vertex.y)) {
          return conn;
        }
      }
      return null;
    };

    // Start from vertices that have exactly 2 connections (potential loop members)
    // Also handle T-junctions by treating collinear walls as connected
    for (const [startKey, startVertex] of vertices) {
      // Skip vertices with 1 or 4+ connections
      if (startVertex.walls.length < 2 || startVertex.walls.length > 3) continue;
      // For 3-connection vertices (T-junctions), we start loops from 2-connection vertices
      if (startVertex.walls.length === 3) continue;
      
      const unprocessedWall = startVertex.walls.find(conn => !processedWalls.has(conn.wall.wall_id));
      if (!unprocessedWall) continue;

      // Try to trace a closed loop from this vertex
      const loopVertices = [];
      const loopWallIds = [];
      const localVisited = new Set();
      
      let currentKey = startKey;
      let prevWallId = null;
      let iterations = 0;
      const maxIterations = walls.length + 2;

      while (iterations < maxIterations) {
        iterations++;
        const vertex = vertices.get(currentKey);
        if (!vertex) break;
        
        // Handle different vertex types
        if (vertex.walls.length === 2) {
          // Normal corner - continue as before
          loopVertices.push({ x: vertex.x, y: vertex.y });
          
          const nextConn = vertex.walls.find(conn => 
            conn.wall.wall_id !== prevWallId && !localVisited.has(conn.wall.wall_id)
          );
          
          if (!nextConn) break;
          
          localVisited.add(nextConn.wall.wall_id);
          loopWallIds.push(nextConn.wall.wall_id);
          prevWallId = nextConn.wall.wall_id;
          currentKey = nextConn.otherKey;
        } else if (vertex.walls.length === 3 && prevWallId) {
          // T-junction - try to continue along collinear wall
          const collinearConn = findCollinearContinuation(vertex, prevWallId);
          if (collinearConn && !localVisited.has(collinearConn.wall.wall_id)) {
            loopVertices.push({ x: vertex.x, y: vertex.y });
            localVisited.add(collinearConn.wall.wall_id);
            loopWallIds.push(collinearConn.wall.wall_id);
            prevWallId = collinearConn.wall.wall_id;
            currentKey = collinearConn.otherKey;
          } else {
            break; // No collinear continuation, end the chain
          }
        } else {
          break; // Other vertex types not supported
        }
        
        if (currentKey === startKey && loopVertices.length >= 3) {
          loopWallIds.forEach(wid => processedWalls.add(wid));
          closedLoops.push({
            vertices: loopVertices,
            wallIds: loopWallIds,
            isClosed: true
          });
          break;
        }
      }
    }

    // Find open wall chains (connected walls that don't form closed loops)
    // These need miter joins at internal corners but flat caps at endpoints
    // Also handles T-junctions by continuing along collinear walls
    const openChains = [];
    
    for (const wall of walls) {
      if (processedWalls.has(wall.wall_id)) continue;
      
      // Start tracing from this wall - collect all connected walls into one chain
      const chainWallIds = [wall.wall_id];
      processedWalls.add(wall.wall_id);
      
      // Build chain by following connections in both directions from this wall
      // Direction 1: from wall.start
      const traceDirection = (startX, startY, excludeWallId) => {
        const traced = [];
        let currentKey = coordKey(startX, startY);
        let prevWallId = excludeWallId;
        
        while (true) {
          const vertex = vertices.get(currentKey);
          if (!vertex) break;
          
          let nextConn = null;
          
          if (vertex.walls.length === 2) {
            // Normal vertex - find next unprocessed wall
            nextConn = vertex.walls.find(conn => 
              conn.wall.wall_id !== prevWallId && !processedWalls.has(conn.wall.wall_id)
            );
          } else if (vertex.walls.length === 3 && prevWallId) {
            // T-junction - try to continue along collinear wall
            const collinearConn = findCollinearContinuation(vertex, prevWallId);
            if (collinearConn && !processedWalls.has(collinearConn.wall.wall_id)) {
              nextConn = collinearConn;
            }
          } else if (vertex.walls.length === 1) {
            // Dead end - this is a true endpoint
            traced.push({ x: vertex.x, y: vertex.y, isEndpoint: true });
            break;
          }
          
          if (!nextConn) {
            // No more connections or can't continue through T-junction
            traced.push({ x: vertex.x, y: vertex.y, isEndpoint: vertex.walls.length === 1 || (vertex.walls.length === 3) });
            break;
          }
          
          // Found another wall - add the corner vertex and continue
          traced.push({ x: vertex.x, y: vertex.y, isEndpoint: false });
          chainWallIds.push(nextConn.wall.wall_id);
          processedWalls.add(nextConn.wall.wall_id);
          prevWallId = nextConn.wall.wall_id;
          currentKey = nextConn.otherKey;
        }
        
        return traced;
      };
      
      // Trace from both ends of the starting wall
      const startTrace = traceDirection(wall.start_x, wall.start_y, wall.wall_id);
      const endTrace = traceDirection(wall.end_x, wall.end_y, wall.wall_id);
      
      // Build the complete vertex chain:
      // [startTrace reversed (without endpoint)] + [wall.start] + [wall.end] + [endTrace]
      const chainVertices = [];
      
      // Add start trace in reverse (from far endpoint to wall.start)
      for (let i = startTrace.length - 1; i >= 0; i--) {
        chainVertices.push(startTrace[i]);
      }
      
      // Add the original wall endpoints if not already added
      if (chainVertices.length === 0 || 
          (chainVertices[chainVertices.length-1].x !== wall.start_x || 
           chainVertices[chainVertices.length-1].y !== wall.start_y)) {
        chainVertices.push({ x: wall.start_x, y: wall.start_y, isEndpoint: startTrace.length === 0 });
      }
      
      chainVertices.push({ x: wall.end_x, y: wall.end_y, isEndpoint: endTrace.length === 0 });
      
      // Add end trace
      for (const v of endTrace) {
        if (v.x !== wall.end_x || v.y !== wall.end_y) {
          chainVertices.push(v);
        }
      }
      
      console.log('[OpenChain] Built chain with', chainVertices.length, 'vertices from', chainWallIds.length, 'walls');
      
      if (chainVertices.length >= 2) {
        openChains.push({
          vertices: chainVertices,
          wallIds: chainWallIds,
          isClosed: false
        });
      }
    }

    console.log('[UnifiedBoundary] Found', closedLoops.length, 'closed loop(s) and', openChains.length, 'open chain(s) from', walls.length, 'walls');

    // Process each closed loop
    const loopBoundaries = closedLoops.map(loop => {
      const thickness = walls.find(w => loop.wallIds.includes(w.wall_id))?.thickness || DEFAULT_WALL_THICKNESS;
      const halfThickness = thickness / 2;

      const outerBoundary = offsetPolygon(loop.vertices, halfThickness, 'outward');
      const innerBoundary = offsetPolygon(loop.vertices, halfThickness, 'inward');

      return {
        centerline: loop.vertices,
        outer: outerBoundary,
        inner: innerBoundary,
        thickness: thickness,
        wallIds: loop.wallIds,
        isClosed: true
      };
    });

    // Process each open chain - create proper miter joins at internal corners
    // Also add notches at T-junction points for proper merging
    const chainBoundaries = openChains.map(chain => {
      const thickness = walls.find(w => chain.wallIds.includes(w.wall_id))?.thickness || DEFAULT_WALL_THICKNESS;
      const halfThickness = thickness / 2;

      // For open chains, we need to create a proper outline with flat caps at ends
      const outline = offsetOpenChain(chain.vertices, halfThickness);

      return {
        centerline: chain.vertices,
        outline: outline,
        thickness: thickness,
        wallIds: chain.wallIds,
        isClosed: false
      };
    });

    const allBoundaries = [...loopBoundaries, ...chainBoundaries];
    
    // Detect T-junction vertices (vertices with 3 connections)
    // AND compute the notch geometry for proper merging
    const tJunctions = [];
    for (const [key, vertex] of vertices) {
      if (vertex.walls.length === 3) {
        // Find which walls form the "through" line and which is the "stem"
        const wallPairs = [];
        for (let i = 0; i < vertex.walls.length; i++) {
          for (let j = i + 1; j < vertex.walls.length; j++) {
            if (areWallsCollinear(vertex.walls[i].wall, vertex.walls[j].wall, vertex.x, vertex.y)) {
              wallPairs.push({ through: [vertex.walls[i], vertex.walls[j]], stem: vertex.walls.find((w, k) => k !== i && k !== j) });
            }
          }
        }
        if (wallPairs.length > 0) {
          const pair = wallPairs[0];
          const throughWall1 = pair.through[0].wall;
          const throughThickness = throughWall1.thickness || DEFAULT_WALL_THICKNESS;
          const stemWall = pair.stem.wall;
          const stemThickness = stemWall.thickness || DEFAULT_WALL_THICKNESS;
          
          // Calculate stem direction and notch dimensions
          const stemAtJunctionIsStart = 
            Math.abs(stemWall.start_x - vertex.x) < 50 && Math.abs(stemWall.start_y - vertex.y) < 50;
          const stemOtherX = stemAtJunctionIsStart ? stemWall.end_x : stemWall.start_x;
          const stemOtherY = stemAtJunctionIsStart ? stemWall.end_y : stemWall.start_y;
          
          const stemDx = stemOtherX - vertex.x;
          const stemDy = stemOtherY - vertex.y;
          const stemLen = Math.sqrt(stemDx * stemDx + stemDy * stemDy);
          
          // Through wall direction
          const tw1Dx = throughWall1.end_x - throughWall1.start_x;
          const tw1Dy = throughWall1.end_y - throughWall1.start_y;
          const tw1Len = Math.sqrt(tw1Dx * tw1Dx + tw1Dy * tw1Dy);
          
          tJunctions.push({
            x: vertex.x,
            y: vertex.y,
            throughWalls: pair.through.map(c => c.wall),
            throughWallIds: pair.through.map(c => c.wall.wall_id),
            stemWall: stemWall,
            throughThickness: throughThickness,
            stemThickness: stemThickness,
            stemDirX: stemLen > 0 ? stemDx / stemLen : 0,
            stemDirY: stemLen > 0 ? stemDy / stemLen : 0,
            throughDirX: tw1Len > 0 ? tw1Dx / tw1Len : 1,
            throughDirY: tw1Len > 0 ? tw1Dy / tw1Len : 0
          });
        }
      }
    }
    
    // Combine regular T-junctions (3 walls at same vertex) with mid-span T-junctions
    const allTJunctions = [...tJunctions, ...midSpanTJunctions];
    
    if (allBoundaries.length === 0 && allTJunctions.length === 0) {
      return null;
    }
    
    // Debug: Log T-junction detection
    if (allTJunctions.length > 0) {
      console.log('[T-Junction] Detected', allTJunctions.length, 'T-junction(s) total');
      allTJunctions.forEach((tj, i) => {
        const type = tj.isMidSpan ? 'mid-span' : 'vertex';
        console.log(`  T-Junction ${i} (${type}): at (${tj.x?.toFixed(0)}, ${tj.y?.toFixed(0)}), stem: ${tj.stemWall?.wall_id}`);
      });
    }

    return {
      loops: loopBoundaries,
      chains: chainBoundaries,
      tJunctions: allTJunctions,
      allWallIds: allBoundaries.flatMap(b => b.wallIds)
    };
  }, [layout?.walls]);

  // Offset polygon with proper miter joins at vertices
  // Uses correct miter join math: offset / cos(half_angle)
  const offsetPolygon = (vertices, offset, direction) => {
    if (vertices.length < 3) return vertices;
    
    const n = vertices.length;
    const result = [];
    // For outward offset, we move in the direction of the inward normal of the polygon
    // Assuming polygon vertices are in counter-clockwise order for a closed room
    const sign = direction === 'outward' ? -1 : 1;

    for (let i = 0; i < n; i++) {
      const prev = vertices[(i - 1 + n) % n];
      const curr = vertices[i];
      const next = vertices[(i + 1) % n];

      // Edge vectors (incoming and outgoing)
      const e1x = curr.x - prev.x;
      const e1y = curr.y - prev.y;
      const e2x = next.x - curr.x;
      const e2y = next.y - curr.y;

      // Normalize edge vectors
      const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
      const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
      
      if (len1 === 0 || len2 === 0) {
        result.push({ x: curr.x, y: curr.y });
        continue;
      }

      const d1x = e1x / len1;
      const d1y = e1y / len1;
      const d2x = e2x / len2;
      const d2y = e2y / len2;

      // Perpendicular normals (rotate 90° CCW: (-y, x))
      const n1x = -d1y;
      const n1y = d1x;
      const n2x = -d2y;
      const n2y = d2x;

      // Bisector direction (sum of normals, normalized)
      const bisectX = n1x + n2x;
      const bisectY = n1y + n2y;
      const bisectLen = Math.sqrt(bisectX * bisectX + bisectY * bisectY);

      if (bisectLen < 0.0001) {
        // Edges are parallel (180° turn) - shouldn't happen in closed polygon
        result.push({
          x: curr.x + n1x * offset * sign,
          y: curr.y + n1y * offset * sign
        });
        continue;
      }

      // Normalized bisector
      const bx = bisectX / bisectLen;
      const by = bisectY / bisectLen;

      // The miter length is offset / cos(half_angle)
      // cos(half_angle) = dot(normal1, bisector) = n1x*bx + n1y*by
      const cosHalfAngle = n1x * bx + n1y * by;
      
      // Clamp to avoid extreme miter lengths at sharp angles
      const clampedCos = Math.max(cosHalfAngle, 0.25); // Limit miter to 4x offset
      const miterLength = offset / clampedCos;

      result.push({
        x: curr.x + bx * miterLength * sign,
        y: curr.y + by * miterLength * sign
      });
    }

    return result;
  };

  // Offset open chain with miter joins at internal corners and flat caps at ends
  // Returns a single closed polygon outline for the entire chain
  const offsetOpenChain = (vertices, offset) => {
    if (vertices.length < 2) return [];
    
    const n = vertices.length;
    const leftSide = [];  // Left side of the chain (offset in one direction)
    const rightSide = []; // Right side of the chain (offset in other direction)

    for (let i = 0; i < n; i++) {
      const curr = vertices[i];
      const isFirst = i === 0;
      const isLast = i === n - 1;
      const isEndpoint = curr.isEndpoint || isFirst || isLast;

      if (isFirst) {
        // First vertex - flat cap perpendicular to first edge
        const next = vertices[i + 1];
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        
        const perpX = -dy / len;
        const perpY = dx / len;
        
        leftSide.push({ x: curr.x + perpX * offset, y: curr.y + perpY * offset });
        rightSide.push({ x: curr.x - perpX * offset, y: curr.y - perpY * offset });
      } else if (isLast) {
        // Last vertex - flat cap perpendicular to last edge
        const prev = vertices[i - 1];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        
        const perpX = -dy / len;
        const perpY = dx / len;
        
        leftSide.push({ x: curr.x + perpX * offset, y: curr.y + perpY * offset });
        rightSide.push({ x: curr.x - perpX * offset, y: curr.y - perpY * offset });
      } else {
        // Internal vertex - MITER JOIN for clean L-corner
        const prev = vertices[i - 1];
        const next = vertices[i + 1];
        
        // Edge vectors (incoming and outgoing)
        const e1x = curr.x - prev.x;
        const e1y = curr.y - prev.y;
        const e2x = next.x - curr.x;
        const e2y = next.y - curr.y;
        
        const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
        const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
        
        if (len1 === 0 || len2 === 0) {
          // Degenerate case - use simple perpendicular
          const perpX = len1 > 0 ? -e1y / len1 : -e2y / len2;
          const perpY = len1 > 0 ? e1x / len1 : e2x / len2;
          leftSide.push({ x: curr.x + perpX * offset, y: curr.y + perpY * offset });
          rightSide.push({ x: curr.x - perpX * offset, y: curr.y - perpY * offset });
          continue;
        }
        
        // Normalized edge directions
        const d1x = e1x / len1, d1y = e1y / len1;
        const d2x = e2x / len2, d2y = e2y / len2;
        
        // Perpendicular normals (pointing "left" of each edge)
        const n1x = -d1y, n1y = d1x;
        const n2x = -d2y, n2y = d2x;
        
        // Calculate the miter direction as the average of the two normals
        const miterX = n1x + n2x;
        const miterY = n1y + n2y;
        const miterLen = Math.sqrt(miterX * miterX + miterY * miterY);
        
        if (miterLen < 0.001) {
          // Edges are parallel (180° turn) - use simple perpendicular
          leftSide.push({ x: curr.x + n1x * offset, y: curr.y + n1y * offset });
          rightSide.push({ x: curr.x - n1x * offset, y: curr.y - n1y * offset });
          continue;
        }
        
        // Normalized miter direction
        const mx = miterX / miterLen;
        const my = miterY / miterLen;
        
        // Calculate miter length using the dot product
        // miterLength = offset / cos(halfAngle) where halfAngle is angle between normal and miter
        const dotProduct = n1x * mx + n1y * my;
        const clampedDot = Math.max(Math.abs(dotProduct), 0.3); // Clamp to prevent infinite miter
        const miterOffset = offset / clampedDot;
        
        // Apply miter offset in both directions
        leftSide.push({ x: curr.x + mx * miterOffset, y: curr.y + my * miterOffset });
        rightSide.push({ x: curr.x - mx * miterOffset, y: curr.y - my * miterOffset });
      }
    }

    // Combine into single closed polygon: left side forward + right side backward
    const outline = [...leftSide, ...rightSide.reverse()];
    return outline;
  };

  // Get unified boundary (memoized)
  const unifiedBoundary = useMemo(() => computeUnifiedWallBoundary(), [computeUnifiedWallBoundary]);

  // ============================================
  // RECTANGULAR LOOP PARAMETRIC EDITING
  // Detects if a wall is part of a rectangular loop
  // and provides parametric deformation
  // ============================================

  // Check if a wall is part of a rectangular (4-wall orthogonal) loop
  const detectRectangularLoop = useCallback((wallId) => {
    if (!layout?.walls || layout.walls.length < 4) return null;
    
    const tolerance = CLOSURE_TOLERANCE;
    const coordKey = (x, y) => `${Math.round(x / tolerance) * tolerance},${Math.round(y / tolerance) * tolerance}`;
    
    // Build adjacency for current wall
    const targetWall = layout.walls.find(w => w.wall_id === wallId);
    if (!targetWall) return null;
    
    // Check if wall is orthogonal (horizontal or vertical)
    const isHorizontal = Math.abs(targetWall.end_y - targetWall.start_y) < tolerance;
    const isVertical = Math.abs(targetWall.end_x - targetWall.start_x) < tolerance;
    if (!isHorizontal && !isVertical) return null; // Not orthogonal
    
    // Build vertex map for all walls
    const vertices = new Map();
    for (const wall of layout.walls) {
      const startKey = coordKey(wall.start_x, wall.start_y);
      const endKey = coordKey(wall.end_x, wall.end_y);
      
      if (!vertices.has(startKey)) vertices.set(startKey, { x: wall.start_x, y: wall.start_y, walls: [] });
      if (!vertices.has(endKey)) vertices.set(endKey, { x: wall.end_x, y: wall.end_y, walls: [] });
      
      vertices.get(startKey).walls.push({ wall, isStart: true, otherKey: endKey });
      vertices.get(endKey).walls.push({ wall, isStart: false, otherKey: startKey });
    }
    
    // Try to trace a 4-wall rectangular loop containing this wall
    const startKey = coordKey(targetWall.start_x, targetWall.start_y);
    const endKey = coordKey(targetWall.end_x, targetWall.end_y);
    
    // From each endpoint, try to find a path back that forms a rectangle
    const traceRectLoop = (fromKey, initialWallId) => {
      const path = [{ wallId: initialWallId, key: fromKey }];
      let currentKey = fromKey;
      let prevWallId = initialWallId;
      
      for (let i = 0; i < 3; i++) { // Need 3 more walls to complete rectangle
        const vertex = vertices.get(currentKey);
        if (!vertex || vertex.walls.length !== 2) return null;
        
        // Find the other wall at this vertex
        const nextConn = vertex.walls.find(c => c.wall.wall_id !== prevWallId);
        if (!nextConn) return null;
        
        const nextWall = nextConn.wall;
        
        // Check orthogonality - each wall should be perpendicular to previous
        const prevWall = layout.walls.find(w => w.wall_id === prevWallId);
        const prevIsHoriz = Math.abs(prevWall.end_y - prevWall.start_y) < tolerance;
        const nextIsHoriz = Math.abs(nextWall.end_y - nextWall.start_y) < tolerance;
        
        // Adjacent walls must be perpendicular
        if (prevIsHoriz === nextIsHoriz) return null;
        
        path.push({ wallId: nextWall.wall_id, key: nextConn.otherKey });
        prevWallId = nextWall.wall_id;
        currentKey = nextConn.otherKey;
      }
      
      // Check if we've closed the loop back to the start of target wall
      const targetStartKey = coordKey(targetWall.start_x, targetWall.start_y);
      const targetEndKey = coordKey(targetWall.end_x, targetWall.end_y);
      
      if (currentKey === targetStartKey || currentKey === targetEndKey) {
        return path.map(p => p.wallId);
      }
      return null;
    };
    
    // Try from end of target wall
    const loop = traceRectLoop(endKey, targetWall.wall_id);
    if (loop && loop.length === 4) {
      // Identify wall positions in the rectangle
      const walls = loop.map(wid => layout.walls.find(w => w.wall_id === wid));
      
      // Classify walls as horizontal/vertical
      const classified = walls.map(w => ({
        wall: w,
        isHorizontal: Math.abs(w.end_y - w.start_y) < tolerance,
        isVertical: Math.abs(w.end_x - w.start_x) < tolerance
      }));
      
      return {
        wallIds: loop,
        walls: classified,
        targetWall: targetWall,
        targetIsHorizontal: isHorizontal
      };
    }
    
    return null;
  }, [layout?.walls]);

  // Parametric update for rectangular loop - maintains rectangle shape
  // Uses activeRectLoop (detected at drag start) and total delta from original positions
  const updateRectangularLoopWall = useCallback((wallId, totalDelta, rectLoop) => {
    if (!rectLoop) {
      console.log('[ParametricEdit] No active rect loop');
      return false;
    }
    
    const { walls, targetWall, targetIsHorizontal } = rectLoop;
    const tolerance = CLOSURE_TOLERANCE;
    
    // Calculate movement perpendicular to wall (total from original position)
    let perpMovement;
    if (targetIsHorizontal) {
      perpMovement = totalDelta.dy; // Horizontal wall moves in Y
    } else {
      perpMovement = totalDelta.dx; // Vertical wall moves in X
    }
    
    if (Math.abs(perpMovement) < 1) return false;
    
    console.log('[ParametricEdit] Moving wall', wallId, 'by', perpMovement, 'isHorizontal:', targetIsHorizontal);
    
    // Identify which walls share endpoints with the target wall
    // In a rectangle: targetWall has 2 adjacent walls (perpendicular) and 1 opposite wall (parallel)
    const coordKey = (x, y) => `${Math.round(x / tolerance) * tolerance},${Math.round(y / tolerance) * tolerance}`;
    
    // Use ORIGINAL wall coordinates from rectLoop (captured at drag start)
    const targetStartKey = coordKey(targetWall.start_x, targetWall.start_y);
    const targetEndKey = coordKey(targetWall.end_x, targetWall.end_y);
    
    const updates = [];
    
    for (const { wall, isHorizontal } of walls) {
      // Use original coordinates from the loop captured at drag start
      const wallStartKey = coordKey(wall.start_x, wall.start_y);
      const wallEndKey = coordKey(wall.end_x, wall.end_y);
      
      if (wall.wall_id === wallId) {
        // This is the target wall - move it entirely in perpendicular direction
        if (targetIsHorizontal) {
          updates.push({
            wallId: wall.wall_id,
            changes: {
              start_x: wall.start_x, // Keep X unchanged
              start_y: wall.start_y + perpMovement,
              end_x: wall.end_x, // Keep X unchanged
              end_y: wall.end_y + perpMovement
            }
          });
        } else {
          updates.push({
            wallId: wall.wall_id,
            changes: {
              start_x: wall.start_x + perpMovement,
              start_y: wall.start_y, // Keep Y unchanged
              end_x: wall.end_x + perpMovement,
              end_y: wall.end_y // Keep Y unchanged
            }
          });
        }
      } else if (isHorizontal !== targetIsHorizontal) {
        // Perpendicular wall - extend/shrink one endpoint to stay connected
        
        // Check which endpoint of this wall connects to target wall (using original coords)
        const startConnectsToTarget = (wallStartKey === targetStartKey || wallStartKey === targetEndKey);
        const endConnectsToTarget = (wallEndKey === targetStartKey || wallEndKey === targetEndKey);
        
        if (startConnectsToTarget) {
          // Move the start endpoint to follow target wall
          if (targetIsHorizontal) {
            updates.push({ 
              wallId: wall.wall_id, 
              changes: { 
                start_x: wall.start_x, // Keep original X
                start_y: wall.start_y + perpMovement,
                end_x: wall.end_x, // Keep original
                end_y: wall.end_y // Keep original
              } 
            });
          } else {
            updates.push({ 
              wallId: wall.wall_id, 
              changes: { 
                start_x: wall.start_x + perpMovement,
                start_y: wall.start_y, // Keep original Y
                end_x: wall.end_x, // Keep original
                end_y: wall.end_y // Keep original
              } 
            });
          }
        } else if (endConnectsToTarget) {
          // Move the end endpoint to follow target wall
          if (targetIsHorizontal) {
            updates.push({ 
              wallId: wall.wall_id, 
              changes: { 
                start_x: wall.start_x, // Keep original
                start_y: wall.start_y, // Keep original  
                end_x: wall.end_x, // Keep original X
                end_y: wall.end_y + perpMovement 
              } 
            });
          } else {
            updates.push({ 
              wallId: wall.wall_id, 
              changes: { 
                start_x: wall.start_x, // Keep original
                start_y: wall.start_y, // Keep original
                end_x: wall.end_x + perpMovement,
                end_y: wall.end_y // Keep original Y
              } 
            });
          }
        }
      }
      // Opposite parallel wall stays unchanged - but we still need to include it to preserve coordinates
    }
    
    console.log('[ParametricEdit] Applying updates to', updates.length, 'walls:', updates);
    
    // Apply all updates atomically
    if (updates.length > 0) {
      setLayout(prev => ({
        ...prev,
        walls: prev.walls.map(w => {
          const update = updates.find(u => u.wallId === w.wall_id);
          if (!update) return w;
          const updated = { ...w, ...update.changes };
          // Recalculate length
          updated.length = Math.round(Math.sqrt(
            Math.pow(updated.end_x - updated.start_x, 2) +
            Math.pow(updated.end_y - updated.start_y, 2)
          ));
          return updated;
        })
      }));
      setHasChanges(true);
      
      // Update selected item if it's one of the updated walls
      const targetUpdate = updates.find(u => u.wallId === wallId);
      if (targetUpdate && selectedItem?.item?.wall_id === wallId) {
        setSelectedItem(prev => {
          const updated = { ...prev.item, ...targetUpdate.changes };
          updated.length = Math.round(Math.sqrt(
            Math.pow(updated.end_x - updated.start_x, 2) +
            Math.pow(updated.end_y - updated.start_y, 2)
          ));
          return { ...prev, item: updated };
        });
      }
      
      return true;
    }
    
    return false;
  }, [selectedItem]);

  // Manual floor fill function - click inside room to fill
  const handleFillFloor = useCallback((clickX, clickY) => {
    if (!layout?.walls || layout.walls.length < 3) {
      toast.error('Need at least 3 walls to create floor');
      return;
    }

    // Get all wall endpoints
    const allPoints = [];
    for (const wall of layout.walls) {
      allPoints.push({ x: wall.start_x, y: wall.start_y });
      allPoints.push({ x: wall.end_x, y: wall.end_y });
    }

    // Find bounding box
    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y));
    const maxY = Math.max(...allPoints.map(p => p.y));

    // Check if click is inside bounding box
    if (clickX >= minX && clickX <= maxX && clickY >= minY && clickY <= maxY) {
      const halfThickness = DEFAULT_WALL_THICKNESS / 2;
      const floorPolygon = [
        { x: minX + halfThickness, y: minY + halfThickness },
        { x: maxX - halfThickness, y: minY + halfThickness },
        { x: maxX - halfThickness, y: maxY - halfThickness },
        { x: minX + halfThickness, y: maxY - halfThickness }
      ];
      setManualFloorFill(floorPolygon);
      setTool('select');
      toast.success('Floor fill applied');
    } else {
      toast.error('Click inside the room to fill floor');
    }
  }, [layout?.walls]);

  // Detect floor when walls change - also clear manual fill if auto-detection succeeds
  useEffect(() => {
    detectFloorPolygon();
    // Clear manual fill when walls change since auto-detection re-runs
    setManualFloorFill(null);
  }, [detectFloorPolygon]);

  // NOTE: Removed auto-expand of right panel on selection - user should manually open/close

  // Zoom helper - zoom centered on cursor position (Item #2)
  const zoomAtCursor = useCallback((newScale, cursorX, cursorY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      setScale(newScale);
      return;
    }

    // Calculate cursor position relative to canvas
    const cursorCanvasX = cursorX - rect.left;
    const cursorCanvasY = cursorY - rect.top;

    // Calculate offset adjustment to keep cursor point fixed
    const scaleRatio = newScale / scale;
    const newPanX = cursorCanvasX - (cursorCanvasX - panOffset.x) * scaleRatio;
    const newPanY = cursorCanvasY - (cursorCanvasY - panOffset.y) * scaleRatio;

    setScale(newScale);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [scale, panOffset]);

  // Reset zoom to fit canvas (Item #2)
  const resetZoomToFit = useCallback(() => {
    setScale(DEFAULT_SCALE);
    setPanOffset({ x: 50, y: 50 });
  }, []);

  // Keyboard event handler - enhanced with zoom shortcuts and spacebar pan
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Spacebar for pan mode (Item #1)
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      // Escape key - universal cancel (Item #4)
      if (e.key === 'Escape') {
        e.preventDefault();
        // Cancel wall drawing (including click-release mode)
        if (isDrawing || wallClickMode) {
          setIsDrawing(false);
          setWallClickMode(null);
          setTempWall(null);
          setTempRectWalls(null);
          setDrawStart(null);
        }
        // Cancel inline dimension editing
        if (editingDimension) {
          setEditingDimension(null);
          setDimensionInputValue('');
        }
        // Cancel module distance editing
        if (editingModuleDistance) {
          setEditingModuleDistance(null);
          setModuleDistanceValue('');
        }
        // Cancel any drag operation
        if (isDragging) {
          setIsDragging(false);
          setDragStart(null);
          setDragType(null);
          setDragEndpoint(null);
        }
        // Deselect everything and return to select tool
        setSelectedItem(null);
        setTool('select');
        setSelectedModuleType(null);
        setSelectedDoorType(null);
        setSelectedWindowType(null);
        setShowWallModePanel(false);
        setShowDoorLibrary(false);
        setShowWindowLibrary(false);
        return;
      }

      // Undo/Redo shortcuts (Item #6-add)
      if ((e.ctrlKey || e.metaKey) && document.activeElement.tagName !== 'INPUT') {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      // Zoom keyboard shortcuts (Item #2)
      if ((e.ctrlKey || e.metaKey) && document.activeElement.tagName !== 'INPUT') {
        const rect = svgRef.current?.getBoundingClientRect();
        const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const newScale = Math.min(scale * 1.2, 0.5);
          zoomAtCursor(newScale, centerX, centerY);
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          const newScale = Math.max(scale / 1.2, 0.05);
          zoomAtCursor(newScale, centerX, centerY);
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          resetZoomToFit();
          return;
        }
      }

      // Tool shortcuts (when not in input field)
      if (document.activeElement.tagName !== 'INPUT') {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          if (layout?.walls?.length >= 3) {
            setTool('fill');
            setShowFloorMaterialPanel(true);
          }
          return;
        }
        // L key - Free line drawing mode
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          setTool('wall');
          setWallDrawMode('free');
          setShowWallModePanel(true);
          return;
        }
        // W key - Wall tool (rectangle mode by default)
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          setTool('wall');
          setWallDrawMode('rectangle');
          setShowWallModePanel(true);
          return;
        }
        // V key - Select tool
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          setTool('select');
          return;
        }
        // S key - Split wall tool
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          setTool('split');
          return;
        }
      }

      if (!selectedItem) return;

      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          deleteSelected();
        }
      }

      // Arrow keys for movement (modules, doors, windows)
      if (['module', 'door', 'window'].includes(selectedItem.type) && document.activeElement.tagName !== 'INPUT') {
        let dx = 0, dy = 0;
        switch (e.key) {
          case 'ArrowUp': dy = -MOVE_STEP; break;
          case 'ArrowDown': dy = MOVE_STEP; break;
          case 'ArrowLeft': dx = -MOVE_STEP; break;
          case 'ArrowRight': dx = MOVE_STEP; break;
          default: return;
        }
        e.preventDefault();

        if (selectedItem.type === 'module') {
          const module = selectedItem.item;
          const newX = module.x + dx;
          const newY = module.y + dy;
          const snapped = snapModuleToWall(newX, newY, module.width, module.depth);
          updateModule(module.module_id, snapped);
        } else {
          // Door or window - move along wall
          moveOpeningAlongWall(selectedItem, dx, dy);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
      // CAD Enhancement: Release orthogonal lock on Shift release
      if (e.key === 'Shift') {
        setShiftKeyHeld(false);
      }
    };

    // CAD Enhancement: Track Shift key for orthogonal constraint
    const handleShiftDown = (e) => {
      if (e.key === 'Shift') {
        setShiftKeyHeld(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleShiftDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleShiftDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedItem, layout, scale, zoomAtCursor, resetZoomToFit, handleUndo, handleRedo, isDrawing, isDragging, editingDimension]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectRes, libraryRes] = await Promise.all([
        axios.get(`${API}/api/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/api/spatial/module-library`, { withCredentials: true })
      ]);

      setProject(projectRes.data);
      setModuleLibrary(libraryRes.data);

      try {
        const layoutRes = await axios.get(
          `${API}/api/projects/${projectId}/spatial-layout?room_name=${roomName}`,
          { withCredentials: true }
        );
        if (layoutRes.data?.layouts?.length > 0) {
          setLayout(layoutRes.data.layouts[0]);
        } else {
          setLayout({
            room_name: roomName,
            walls: [],
            modules: [],
            doors: [],
            windows: [],
            canvas_width: 5000,
            canvas_height: 4000
          });
        }
      } catch {
        setLayout({
          room_name: roomName,
          walls: [],
          modules: [],
          doors: [],
          windows: [],
          canvas_width: 5000,
          canvas_height: 4000
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId, roomName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Convert screen coords to canvas coords
  const screenToCanvas = (screenX, screenY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - panOffset.x) / scale,
      y: (screenY - rect.top - panOffset.y) / scale
    };
  };

  // Coohom-style Snapping System - Simple endpoint and grid snap with small circle indicators
  const findSnapPoint = useCallback((x, y, excludeWallId = null) => {
    let bestSnap = null;
    let minDist = Infinity;

    // Priority 1: Endpoint snapping - snap to existing wall endpoints
    if (layout?.walls?.length) {
      for (const wall of layout.walls) {
        if (wall.wall_id === excludeWallId) continue;
        
        // Check start point
        const distStart = Math.sqrt(Math.pow(x - wall.start_x, 2) + Math.pow(y - wall.start_y, 2));
        if (distStart < ENDPOINT_SNAP_THRESHOLD && distStart < minDist) {
          minDist = distStart;
          bestSnap = { x: wall.start_x, y: wall.start_y, snapped: true, type: 'endpoint' };
        }
        
        // Check end point
        const distEnd = Math.sqrt(Math.pow(x - wall.end_x, 2) + Math.pow(y - wall.end_y, 2));
        if (distEnd < ENDPOINT_SNAP_THRESHOLD && distEnd < minDist) {
          minDist = distEnd;
          bestSnap = { x: wall.end_x, y: wall.end_y, snapped: true, type: 'endpoint' };
        }
      }
    }

    // If endpoint found, use it
    if (bestSnap) {
      setSnapIndicator({ x: bestSnap.x, y: bestSnap.y, type: 'endpoint' });
      return bestSnap;
    }

    // Priority 2: Grid snapping (always active like Coohom)
    const gridX = Math.round(x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    const gridY = Math.round(y / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    setSnapIndicator({ x: gridX, y: gridY, type: 'grid' });
    return { x: gridX, y: gridY, snapped: true, type: 'grid' };
  }, [layout?.walls]);

  // Legacy findNearestCorner for backward compatibility
  const findNearestCorner = (x, y) => {
    const snap = findSnapPoint(x, y);
    return snap.snapped ? { x: snap.x, y: snap.y } : null;
  };

  // Coohom-style alignment guides - shows when line is close to horizontal/vertical
  // Always shows guides to help draw straight lines
  const findAlignmentGuides = useCallback((startX, startY, endX, endY) => {
    const guides = [];
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 50) return guides; // Too short to determine direction
    
    // Calculate angle from horizontal
    const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
    const normalizedAngle = angle > 90 ? 180 - angle : angle;
    
    // Extended guide lines across canvas
    const extendLength = 5000; // mm
    
    // Show horizontal guide when close to horizontal (within 10 degrees)
    if (normalizedAngle < 10) {
      guides.push({ 
        type: 'horizontal', 
        y: startY,
        x1: startX - extendLength,
        x2: startX + extendLength,
        isLocked: normalizedAngle < 3 // Bright green when locked to straight
      });
    }
    
    // Show vertical guide when close to vertical (within 10 degrees of 90)
    if (normalizedAngle > 80) {
      guides.push({ 
        type: 'vertical', 
        x: startX,
        y1: startY - extendLength,
        y2: startY + extendLength,
        isLocked: normalizedAngle > 87 // Bright green when locked to straight
      });
    }
    
    return guides;
  }, []);

  // ============================================
  // ARC WALL CALCULATION UTILITIES
  // ============================================
  
  // Calculate arc parameters from start, end, and radius
  const calculateArcFromRadius = useCallback((startX, startY, endX, endY, radius, bulgeDirection = 1) => {
    // Chord length (distance between start and end)
    const chordLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    
    // If radius is too small to span the chord, adjust it
    const minRadius = chordLength / 2;
    const actualRadius = Math.max(radius, minRadius + 1);
    
    // Midpoint of chord
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Distance from midpoint to center (perpendicular to chord)
    const halfChord = chordLength / 2;
    const distToCenter = Math.sqrt(actualRadius * actualRadius - halfChord * halfChord);
    
    // Direction perpendicular to chord
    const chordDx = endX - startX;
    const chordDy = endY - startY;
    const perpX = -chordDy / chordLength;
    const perpY = chordDx / chordLength;
    
    // Center point (bulgeDirection determines which side)
    const centerX = midX + perpX * distToCenter * bulgeDirection;
    const centerY = midY + perpY * distToCenter * bulgeDirection;
    
    // Calculate angles for SVG arc
    const startAngle = Math.atan2(startY - centerY, startX - centerX);
    const endAngle = Math.atan2(endY - centerY, endX - centerX);
    
    // Arc length
    let angleDiff = endAngle - startAngle;
    if (bulgeDirection > 0 && angleDiff > 0) angleDiff -= 2 * Math.PI;
    if (bulgeDirection < 0 && angleDiff < 0) angleDiff += 2 * Math.PI;
    const arcLength = Math.abs(angleDiff * actualRadius);
    
    // Chord height (sagitta)
    const chordHeight = actualRadius - distToCenter;
    
    // Determine sweep flag for SVG (0 = counter-clockwise, 1 = clockwise)
    const sweepFlag = bulgeDirection > 0 ? 0 : 1;
    
    // Large arc flag (0 if arc < 180°, 1 if arc > 180°)
    const largeArcFlag = Math.abs(angleDiff) > Math.PI ? 1 : 0;
    
    return {
      startX, startY, endX, endY,
      radius: actualRadius,
      chordLength,
      chordHeight,
      arcLength,
      centerX, centerY,
      startAngle, endAngle,
      sweepFlag,
      largeArcFlag,
      bulgeDirection
    };
  }, []);

  // Calculate arc parameters from start, end, and chord height (string height)
  const calculateArcFromChordHeight = useCallback((startX, startY, endX, endY, chordHeight, bulgeDirection = 1) => {
    // Chord length (distance between start and end)
    const chordLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    
    // Minimum chord height
    const minChordHeight = 10; // 10mm minimum
    const actualChordHeight = Math.max(chordHeight, minChordHeight);
    
    // Calculate radius from chord height: r = (h/2) + (c²/(8h))
    // where h = chord height, c = chord length
    const radius = (actualChordHeight / 2) + (chordLength * chordLength) / (8 * actualChordHeight);
    
    // Use the radius-based calculation
    return calculateArcFromRadius(startX, startY, endX, endY, radius, bulgeDirection);
  }, [calculateArcFromRadius]);

  // Calculate arc wall boundaries (inner and outer curves for wall thickness)
  const calculateArcWallBoundaries = useCallback((arcParams, thickness = DEFAULT_WALL_THICKNESS) => {
    const { centerX, centerY, radius, startAngle, endAngle, sweepFlag, largeArcFlag, startX, startY, endX, endY } = arcParams;
    const halfThickness = thickness / 2;
    
    // Inner and outer radii
    const innerRadius = radius - halfThickness;
    const outerRadius = radius + halfThickness;
    
    // Calculate inner arc points
    const innerStartX = centerX + innerRadius * Math.cos(startAngle);
    const innerStartY = centerY + innerRadius * Math.sin(startAngle);
    const innerEndX = centerX + innerRadius * Math.cos(endAngle);
    const innerEndY = centerY + innerRadius * Math.sin(endAngle);
    
    // Calculate outer arc points
    const outerStartX = centerX + outerRadius * Math.cos(startAngle);
    const outerStartY = centerY + outerRadius * Math.sin(startAngle);
    const outerEndX = centerX + outerRadius * Math.cos(endAngle);
    const outerEndY = centerY + outerRadius * Math.sin(endAngle);
    
    return {
      inner: { startX: innerStartX, startY: innerStartY, endX: innerEndX, endY: innerEndY, radius: innerRadius },
      outer: { startX: outerStartX, startY: outerStartY, endX: outerEndX, endY: outerEndY, radius: outerRadius },
      sweepFlag,
      largeArcFlag
    };
  }, []);

  // Generate SVG path for arc wall with thickness
  const generateArcWallPath = useCallback((arcParams, thickness = DEFAULT_WALL_THICKNESS) => {
    const boundaries = calculateArcWallBoundaries(arcParams, thickness);
    const { inner, outer, sweepFlag, largeArcFlag } = boundaries;
    
    // Create a closed path: outer arc → end cap → inner arc (reversed) → start cap
    const path = [
      `M ${outer.startX} ${outer.startY}`,
      `A ${outer.radius} ${outer.radius} 0 ${largeArcFlag} ${sweepFlag} ${outer.endX} ${outer.endY}`,
      `L ${inner.endX} ${inner.endY}`,
      `A ${inner.radius} ${inner.radius} 0 ${largeArcFlag} ${1 - sweepFlag} ${inner.startX} ${inner.startY}`,
      `Z`
    ].join(' ');
    
    return path;
  }, [calculateArcWallBoundaries]);

  // Calculate tangent angle at a point on the arc (for door/window placement)
  const getArcTangentAngle = useCallback((arcParams, positionRatio) => {
    // positionRatio: 0 = start, 1 = end
    const { centerX, centerY, startAngle, endAngle, bulgeDirection } = arcParams;
    
    let angleDiff = endAngle - startAngle;
    if (bulgeDirection > 0 && angleDiff > 0) angleDiff -= 2 * Math.PI;
    if (bulgeDirection < 0 && angleDiff < 0) angleDiff += 2 * Math.PI;
    
    const angle = startAngle + angleDiff * positionRatio;
    // Tangent is perpendicular to radius
    const tangentAngle = angle + Math.PI / 2;
    
    return tangentAngle * (180 / Math.PI); // Return in degrees
  }, []);

  // Get point on arc at a specific position ratio (for door/window placement)
  const getPointOnArc = useCallback((arcParams, positionRatio) => {
    const { centerX, centerY, radius, startAngle, endAngle, bulgeDirection } = arcParams;
    
    let angleDiff = endAngle - startAngle;
    if (bulgeDirection > 0 && angleDiff > 0) angleDiff -= 2 * Math.PI;
    if (bulgeDirection < 0 && angleDiff < 0) angleDiff += 2 * Math.PI;
    
    const angle = startAngle + angleDiff * positionRatio;
    
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  }, []);

  // Determine bulge direction based on mouse position relative to chord
  const calculateBulgeDirection = useCallback((startX, startY, endX, endY, mouseX, mouseY) => {
    // Vector from start to end
    const chordDx = endX - startX;
    const chordDy = endY - startY;
    
    // Vector from start to mouse
    const toMouseDx = mouseX - startX;
    const toMouseDy = mouseY - startY;
    
    // Cross product determines which side of the chord the mouse is on
    const crossProduct = chordDx * toMouseDy - chordDy * toMouseDx;
    
    return crossProduct >= 0 ? 1 : -1;
  }, []);

  // Find connection suggestions - endpoints that the user might want to connect to
  // Shows dotted guidelines to help complete shapes
  const findConnectionSuggestions = useCallback((fromX, fromY, currentEndX, currentEndY) => {
    if (!layout?.walls?.length) return { suggestions: [], closePoint: null };
    
    const suggestions = [];
    let closePoint = null;
    const maxDistance = 3000; // mm - max distance to show suggestions
    const closeThreshold = 300; // mm - distance to show "close shape" indicator
    
    // Build a set of unique endpoints
    const endpoints = new Map();
    for (const wall of layout.walls) {
      const startKey = `${Math.round(wall.start_x)},${Math.round(wall.start_y)}`;
      const endKey = `${Math.round(wall.end_x)},${Math.round(wall.end_y)}`;
      
      if (!endpoints.has(startKey)) {
        endpoints.set(startKey, { x: wall.start_x, y: wall.start_y, connections: 0 });
      }
      endpoints.get(startKey).connections++;
      
      if (!endpoints.has(endKey)) {
        endpoints.set(endKey, { x: wall.end_x, y: wall.end_y, connections: 0 });
      }
      endpoints.get(endKey).connections++;
    }
    
    // Find the starting point of the current drawing chain (if drawing from an endpoint)
    let chainStartPoint = null;
    const fromKey = `${Math.round(fromX)},${Math.round(fromY)}`;
    if (endpoints.has(fromKey)) {
      // We're drawing from an existing endpoint - find the other end of the chain
      // to see if we can close the shape
      const visited = new Set([fromKey]);
      let currentKey = fromKey;
      
      // FIRST: Check if we need to trace from an endpoint with 1 connection
      // This handles the case where we start from the END of an open chain
      const startEndpoint = endpoints.get(fromKey);
      if (startEndpoint && startEndpoint.connections === 1) {
        // We're at an open end - trace to find the OTHER open end
        // First, find the wall connected to this endpoint
        for (const wall of layout.walls) {
          const wallStartKey = `${Math.round(wall.start_x)},${Math.round(wall.start_y)}`;
          const wallEndKey = `${Math.round(wall.end_x)},${Math.round(wall.end_y)}`;
          
          if (wallStartKey === fromKey && !visited.has(wallEndKey)) {
            visited.add(wallEndKey);
            currentKey = wallEndKey;
            break;
          }
          if (wallEndKey === fromKey && !visited.has(wallStartKey)) {
            visited.add(wallStartKey);
            currentKey = wallStartKey;
            break;
          }
        }
      }
      
      // Trace the chain to find where it started (other open end)
      for (let i = 0; i < layout.walls.length; i++) {
        const currentEndpoint = endpoints.get(currentKey);
        if (!currentEndpoint) break;
        
        // Found an endpoint with only 1 connection = other end of chain
        if (currentEndpoint.connections === 1 && currentKey !== fromKey) {
          chainStartPoint = { x: currentEndpoint.x, y: currentEndpoint.y };
          break;
        }
        
        // If this is a T-junction (3+ connections), stop tracing
        if (currentEndpoint.connections > 2) break;
        
        // Find the next connected endpoint (for endpoints with 2 connections)
        let foundNext = false;
        for (const wall of layout.walls) {
          const wallStartKey = `${Math.round(wall.start_x)},${Math.round(wall.start_y)}`;
          const wallEndKey = `${Math.round(wall.end_x)},${Math.round(wall.end_y)}`;
          
          if (wallStartKey === currentKey && !visited.has(wallEndKey)) {
            visited.add(wallEndKey);
            currentKey = wallEndKey;
            foundNext = true;
            break;
          }
          if (wallEndKey === currentKey && !visited.has(wallStartKey)) {
            visited.add(wallStartKey);
            currentKey = wallStartKey;
            foundNext = true;
            break;
          }
        }
        if (!foundNext) break;
      }
    }
    
    // Find endpoints to suggest connecting to
    for (const [key, endpoint] of endpoints) {
      // Skip the point we're drawing from
      if (Math.abs(endpoint.x - fromX) < 10 && Math.abs(endpoint.y - fromY) < 10) continue;
      
      const distFromCursor = Math.sqrt(
        Math.pow(currentEndX - endpoint.x, 2) + Math.pow(currentEndY - endpoint.y, 2)
      );
      
      // Only suggest endpoints with 1 connection (open ends) or check if it can close shape
      if (endpoint.connections === 1 && distFromCursor < maxDistance) {
        const isAligned = 
          Math.abs(endpoint.x - fromX) < 50 || // Vertically aligned with start
          Math.abs(endpoint.y - fromY) < 50 || // Horizontally aligned with start
          Math.abs(endpoint.x - currentEndX) < 100 || // Close to cursor X
          Math.abs(endpoint.y - currentEndY) < 100;   // Close to cursor Y
        
        suggestions.push({
          x: endpoint.x,
          y: endpoint.y,
          distance: distFromCursor,
          isAligned,
          canClose: chainStartPoint && 
            Math.abs(endpoint.x - chainStartPoint.x) < 10 && 
            Math.abs(endpoint.y - chainStartPoint.y) < 10
        });
      }
    }
    
    // Check if current cursor position can close the shape
    if (chainStartPoint) {
      const distToClose = Math.sqrt(
        Math.pow(currentEndX - chainStartPoint.x, 2) + Math.pow(currentEndY - chainStartPoint.y, 2)
      );
      if (distToClose < closeThreshold) {
        closePoint = { x: chainStartPoint.x, y: chainStartPoint.y, distance: distToClose };
      }
    }
    
    // Sort by distance and take top 3
    suggestions.sort((a, b) => a.distance - b.distance);
    
    return { 
      suggestions: suggestions.slice(0, 3), 
      closePoint,
      chainStart: chainStartPoint // Return chain start for visual indicator
    };
  }, [layout?.walls]);

  // ============================================
  // LOOP CLOSURE PROJECTION DETECTION
  // Detects if the cursor trajectory would pass near the room start point
  // Shows guidance BEFORE drawing the final wall (while drawing 3rd wall)
  // ============================================
  const findLoopClosureProjection = useCallback((startX, startY, endX, endY, chainStart) => {
    if (!chainStart) return null;
    
    // Direction of the line being drawn
    const drawDx = endX - startX;
    const drawDy = endY - startY;
    const drawLen = Math.sqrt(drawDx * drawDx + drawDy * drawDy);
    
    if (drawLen < 50) return null;
    
    // Normalize direction
    const drawDirX = drawDx / drawLen;
    const drawDirY = drawDy / drawLen;
    
    // Vector from draw start to chain start
    const toChainStartX = chainStart.x - startX;
    const toChainStartY = chainStart.y - startY;
    
    // Project chain start onto the drawing line
    // t = (toChainStart · drawDir) = distance along draw direction to perpendicular foot
    const t = toChainStartX * drawDirX + toChainStartY * drawDirY;
    
    // If t <= 0, perpendicular foot is behind the draw start - not useful
    if (t <= 0) return null;
    
    // Perpendicular foot point on the drawing line
    // THIS is where wall 3 should END so wall 4 connects cleanly to chain start
    const footX = startX + t * drawDirX;
    const footY = startY + t * drawDirY;
    
    // Distance from chain start to the perpendicular foot (how far wall 4 needs to travel)
    const wall4Dx = chainStart.x - footX;
    const wall4Dy = chainStart.y - footY;
    const wall4Length = Math.sqrt(wall4Dx * wall4Dx + wall4Dy * wall4Dy);
    
    // Only show if wall 4 length is reasonable (not too short, not too far)
    // Minimum 200mm wall, maximum 5000mm prediction range
    if (wall4Length < 200 || wall4Length > 5000) return null;
    
    // Distance from current cursor to the foot point
    const cursorToFootDist = Math.sqrt(
      (endX - footX) * (endX - footX) + 
      (endY - footY) * (endY - footY)
    );
    
    // Only show when cursor is approaching the foot point (within 2000mm)
    // or has passed it but not too far
    if (cursorToFootDist > 2000 && t > drawLen) return null;
    
    return {
      // The intersection point ON the line being drawn (where wall 3 should end)
      x: footX,
      y: footY,
      // The chain start point (where wall 4 will connect to close the room)
      chainStartX: chainStart.x,
      chainStartY: chainStart.y,
      // Distance from foot to chain start (wall 4 length)
      wall4Length: wall4Length,
      // Distance from cursor to foot point
      cursorDistance: cursorToFootDist,
      // Distance along draw direction to foot
      projectionDistance: t
    };
  }, []);

  // ============================================
  // PREDICTIVE INTERSECTION DETECTION
  // Calculates where the wall being drawn will intersect existing walls
  // Shows snap marker BEFORE cursor reaches the intersection
  // ============================================
  const findProjectedIntersections = useCallback((startX, startY, endX, endY) => {
    if (!layout?.walls?.length) return [];
    
    const intersections = [];
    
    // Direction vector of the line being drawn (from start toward cursor)
    const drawDx = endX - startX;
    const drawDy = endY - startY;
    const drawLen = Math.sqrt(drawDx * drawDx + drawDy * drawDy);
    
    if (drawLen < 10) return [];
    
    // Normalized direction
    const drawDirX = drawDx / drawLen;
    const drawDirY = drawDy / drawLen;
    
    for (const wall of layout.walls) {
      // Wall centerline
      const wallDx = wall.end_x - wall.start_x;
      const wallDy = wall.end_y - wall.start_y;
      const wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
      
      if (wallLen < 10) continue;
      
      // Line-line intersection using parametric form
      // Line 1: P1 + t * D1 (drawing line, extended infinitely in draw direction)
      // Line 2: P2 + s * D2 (wall centerline segment)
      
      // Cross product to check if lines are parallel
      const cross = drawDx * wallDy - drawDy * wallDx;
      
      if (Math.abs(cross) < 0.0001) continue; // Lines are parallel
      
      // Calculate intersection parameters
      const t = ((wall.start_x - startX) * wallDy - (wall.start_y - startY) * wallDx) / cross;
      const s = ((wall.start_x - startX) * drawDy - (wall.start_y - startY) * drawDx) / cross;
      
      // RELAXED FILTERS for better visibility:
      // t > 0 means intersection is ahead of draw start point (in draw direction)
      // s between 0 and 1 means intersection is ON the wall segment
      // Allow intersections anywhere on the wall (s from 0 to 1, inclusive with small margin)
      if (t > 0 && s >= -0.01 && s <= 1.01) {
        // Calculate intersection point
        const intersectX = startX + t * drawDx;
        const intersectY = startY + t * drawDy;
        
        // Distance from current cursor to intersection
        const distFromCursor = Math.sqrt(
          (intersectX - endX) * (intersectX - endX) + 
          (intersectY - endY) * (intersectY - endY)
        );
        
        // Distance from draw start to intersection
        const distFromStart = t * drawLen;
        
        // Check if intersection is ahead of cursor (in draw direction)
        const cursorToIntersectDot = (intersectX - endX) * drawDirX + (intersectY - endY) * drawDirY;
        
        intersections.push({
          x: intersectX,
          y: intersectY,
          wallId: wall.wall_id,
          distanceFromStart: distFromStart,
          distanceFromCursor: distFromCursor,
          isAhead: cursorToIntersectDot > 0, // True if intersection is ahead of cursor
          t: t, // Parameter along draw line
          s: s  // Parameter along wall (0=start, 1=end)
        });
      }
    }
    
    // Sort by distance from draw start point (closest first)
    intersections.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
    
    // Log for debugging
    if (intersections.length > 0) {
      console.log('[ProjectedIntersection] Found', intersections.length, 'intersection(s)');
    }
    
    return intersections;
  }, [layout?.walls]);

  // Coohom-style orthogonal constraint - snaps to pure horizontal or vertical
  const applyOrthogonalConstraint = (startX, startY, endX, endY) => {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 10) return { x: endX, y: endY, isOrtho: false };
    
    // Determine dominant axis and snap to it
    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal - snap to pure horizontal
      return { x: startX + (dx >= 0 ? length : -length), y: startY, isOrtho: true, angle: dx >= 0 ? 0 : 180 };
    } else {
      // Vertical - snap to pure vertical  
      return { x: startX, y: startY + (dy >= 0 ? length : -length), isOrtho: true, angle: dy >= 0 ? 90 : -90 };
    }
  };

  // Auto-merge vertices when endpoint dragged close to another
  const findMergeTarget = useCallback((x, y, excludeWallId, excludeEndpoint) => {
    if (!layout?.walls?.length) return null;
    
    // First priority: Check for endpoint-to-endpoint merge
    for (const wall of layout.walls) {
      if (wall.wall_id === excludeWallId) continue;
      
      const distStart = Math.sqrt(Math.pow(x - wall.start_x, 2) + Math.pow(y - wall.start_y, 2));
      if (distStart < VERTEX_MERGE_THRESHOLD) {
        return { x: wall.start_x, y: wall.start_y, wallId: wall.wall_id, endpoint: 'start', type: 'endpoint' };
      }
      
      const distEnd = Math.sqrt(Math.pow(x - wall.end_x, 2) + Math.pow(y - wall.end_y, 2));
      if (distEnd < VERTEX_MERGE_THRESHOLD) {
        return { x: wall.end_x, y: wall.end_y, wallId: wall.wall_id, endpoint: 'end', type: 'endpoint' };
      }
    }
    
    // Second priority: Check for T-junction (endpoint near middle of another wall)
    const T_JUNCTION_THRESHOLD = 80; // mm - threshold for T-junction detection
    for (const wall of layout.walls) {
      if (wall.wall_id === excludeWallId) continue;
      
      const dx = wall.end_x - wall.start_x;
      const dy = wall.end_y - wall.start_y;
      const wallLength = Math.sqrt(dx * dx + dy * dy);
      
      if (wallLength < 200) continue; // Wall too short for T-junction
      
      // Project point onto wall line
      const t = ((x - wall.start_x) * dx + (y - wall.start_y) * dy) / (wallLength * wallLength);
      
      // Only consider points along the wall middle (not near endpoints)
      if (t < 0.15 || t > 0.85) continue;
      
      const projX = wall.start_x + t * dx;
      const projY = wall.start_y + t * dy;
      
      // Distance from cursor to projected point
      const dist = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
      
      if (dist < T_JUNCTION_THRESHOLD) {
        return { 
          x: Math.round(projX), 
          y: Math.round(projY), 
          wallId: wall.wall_id, 
          type: 'tjunction',
          t: t // Parameter along wall for splitting
        };
      }
    }
    
    return null;
  }, [layout?.walls]);

  // Auto-straight line assistance (Item #2) - Snap to 0°/90°/180° with enhanced Shift support
  const snapToStraightLine = (startX, startY, endX, endY, forceOrthogonal = false) => {
    // If Shift is held or forceOrthogonal, use strict orthogonal constraint
    if (shiftKeyHeld || forceOrthogonal) {
      const constrained = applyOrthogonalConstraint(startX, startY, endX, endY);
      const dx = constrained.x - startX;
      const dy = constrained.y - startY;
      const angle = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 180) : (dy > 0 ? 90 : -90);
      return { x: constrained.x, y: constrained.y, snapped: true, angle };
    }

    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Target angles: 0, 90, 180, -90, -180
    const targetAngles = [0, 90, 180, -90, -180, 270, -270];
    
    for (const target of targetAngles) {
      const diff = Math.abs(angle - target);
      if (diff < ANGLE_SNAP_TOLERANCE || Math.abs(diff - 360) < ANGLE_SNAP_TOLERANCE) {
        // Snap to this angle
        const radians = target * (Math.PI / 180);
        return {
          x: startX + Math.cos(radians) * length,
          y: startY + Math.sin(radians) * length,
          snapped: true,
          angle: target
        };
      }
    }
    
    return { x: endX, y: endY, snapped: false, angle: Math.round(angle) };
  };

  // Magnetic snap module to wall INNER EDGE (Item #7 - Fixed to snap to inner face)
  const snapModuleToWall = (x, y, width, depth) => {
    if (!layout?.walls?.length) return { x, y, wall_id: null, distance: null };

    let bestSnap = { x, y, wall_id: null, distance: Infinity, distanceToWall: null };

    for (const wall of layout.walls) {
      const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
      const wallThickness = wall.thickness || DEFAULT_WALL_THICKNESS;
      const halfThickness = wallThickness / 2;
      
      if (isHorizontal) {
        // Horizontal wall - snap module Y to wall INNER edge
        const wallY = wall.start_y;
        
        // Top side of wall (inner edge is below centerline)
        const innerTopY = wallY + halfThickness;
        const distTop = Math.abs(y - innerTopY);
        if (distTop < SNAP_THRESHOLD && distTop < bestSnap.distance) {
          bestSnap = { x, y: innerTopY, wall_id: wall.wall_id, distance: distTop, distanceToWall: 0 };
        }
        
        // Bottom side of wall (inner edge is above centerline)  
        const innerBottomY = wallY - halfThickness;
        const distBottom = Math.abs((y + depth) - innerBottomY);
        if (distBottom < SNAP_THRESHOLD && distBottom < bestSnap.distance) {
          bestSnap = { x, y: innerBottomY - depth, wall_id: wall.wall_id, distance: distBottom, distanceToWall: 0 };
        }
      } else {
        // Vertical wall - snap module X to wall INNER edge
        const wallX = wall.start_x;
        
        // Right side of wall (inner edge is to the right of centerline)
        const innerRightX = wallX + halfThickness;
        const distLeft = Math.abs(x - innerRightX);
        if (distLeft < SNAP_THRESHOLD && distLeft < bestSnap.distance) {
          bestSnap = { x: innerRightX, y, wall_id: wall.wall_id, distance: distLeft, distanceToWall: 0 };
        }
        
        // Left side of wall (inner edge is to the left of centerline)
        const innerLeftX = wallX - halfThickness;
        const distRight = Math.abs((x + width) - innerLeftX);
        if (distRight < SNAP_THRESHOLD && distRight < bestSnap.distance) {
          bestSnap = { x: innerLeftX - width, y, wall_id: wall.wall_id, distance: distRight, distanceToWall: 0 };
        }
      }
    }

    return { x: bestSnap.x, y: bestSnap.y, wall_id: bestSnap.wall_id, distanceToWall: bestSnap.distanceToWall };
  };

  // Calculate distance from module to nearest wall (Item #8)
  const calculateModuleToWallDistance = (module) => {
    if (!layout?.walls?.length || !module) return null;

    let nearestDistance = Infinity;
    let direction = null;
    let nearestWall = null;

    for (const wall of layout.walls) {
      const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
      const wallThickness = wall.thickness || DEFAULT_WALL_THICKNESS;
      const halfThickness = wallThickness / 2;
      
      if (isHorizontal) {
        const wallY = wall.start_y;
        const innerTop = wallY + halfThickness;
        const innerBottom = wallY - halfThickness;
        
        // Distance from module top to wall bottom
        const distToBottom = Math.abs(module.y - innerBottom);
        if (distToBottom < nearestDistance) {
          nearestDistance = distToBottom;
          direction = 'top';
          nearestWall = wall;
        }
        
        // Distance from module bottom to wall top
        const distToTop = Math.abs((module.y + module.depth) - innerTop);
        if (distToTop < nearestDistance) {
          nearestDistance = distToTop;
          direction = 'bottom';
          nearestWall = wall;
        }
      } else {
        const wallX = wall.start_x;
        const innerRight = wallX + halfThickness;
        const innerLeft = wallX - halfThickness;
        
        // Distance from module left to wall right
        const distToRight = Math.abs(module.x - innerRight);
        if (distToRight < nearestDistance) {
          nearestDistance = distToRight;
          direction = 'left';
          nearestWall = wall;
        }
        
        // Distance from module right to wall left
        const distToLeft = Math.abs((module.x + module.width) - innerLeft);
        if (distToLeft < nearestDistance) {
          nearestDistance = distToLeft;
          direction = 'right';
          nearestWall = wall;
        }
      }
    }

    return nearestDistance < 5000 ? { distance: Math.round(nearestDistance), direction, wall: nearestWall } : null;
  };

  // Apply exact distance to wall (Item #8)
  const applyModuleDistanceToWall = (moduleId, distance, direction) => {
    saveToHistory();
    const module = layout?.modules?.find(m => m.module_id === moduleId);
    if (!module) return;

    const distInfo = calculateModuleToWallDistance(module);
    if (!distInfo?.wall) return;

    const wall = distInfo.wall;
    const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
    const wallThickness = wall.thickness || DEFAULT_WALL_THICKNESS;
    const halfThickness = wallThickness / 2;

    let newX = module.x;
    let newY = module.y;

    if (isHorizontal) {
      const wallY = wall.start_y;
      if (direction === 'top' || distInfo.direction === 'top') {
        newY = wallY - halfThickness - distance;
      } else {
        newY = wallY + halfThickness + distance - module.depth;
      }
    } else {
      const wallX = wall.start_x;
      if (direction === 'left' || distInfo.direction === 'left') {
        newX = wallX + halfThickness + distance;
      } else {
        newX = wallX - halfThickness - distance - module.width;
      }
    }

    updateModule(moduleId, { x: newX, y: newY, wall_id: wall.wall_id });
    setEditingModuleDistance(null);
  };

  // Handle mouse down
  const handleMouseDown = (e) => {
    // Middle mouse button for pan (Item #1)
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    // Spacebar + Left click for pan (Item #1)
    if (e.button === 0 && spacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (e.button !== 0) return;
    const canvas = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'wall') {
      // USE PRE-CLICK SNAP: Start wall from exact snapped coordinate (vertex or grid)
      // This ensures the line origin is the exact snapped coordinate
      const startPoint = preClickSnap ? { x: preClickSnap.x, y: preClickSnap.y } : canvas;
      
      // Click-Release wall drawing mode (Item #4)
      if (wallClickMode === 'waiting_end') {
        // Second click - complete the wall using snapped end point
        saveToHistory();
        
        // AUTO-SNAP TO CLOSE POINT: If canCloseShape is active, snap to it
        let finalEndPoint = tempWall ? tempWall.end : canvas;
        
        // Priority 1: Snap to close point for room closure
        if (canCloseShape) {
          finalEndPoint = { x: canCloseShape.x, y: canCloseShape.y };
          console.log('[LoopClosure] Auto-snapping to close point:', canCloseShape.x, canCloseShape.y);
        }
        // Priority 2: Snap to projected intersection if cursor is near it
        else if (projectedIntersections.length > 0) {
          const nearestIntersection = projectedIntersections[0];
          // Snap if cursor is within 100mm of the projected intersection
          if (nearestIntersection.distanceFromCursor < 100) {
            finalEndPoint = { x: nearestIntersection.x, y: nearestIntersection.y };
            console.log('[ProjectedIntersection] Snapping to intersection at:', nearestIntersection.x.toFixed(0), nearestIntersection.y.toFixed(0));
          }
        }
        
        if (tempWall && tempWall.start) {
          const wallLength = Math.sqrt(
            Math.pow(finalEndPoint.x - tempWall.start.x, 2) + 
            Math.pow(finalEndPoint.y - tempWall.start.y, 2)
          );
          
          if (wallLength > 100) {
            // Create the wall with auto-snapped end point
            const newWall = createWall(tempWall.start.x, tempWall.start.y, finalEndPoint.x, finalEndPoint.y);
            setLayout(prev => ({ ...prev, walls: [...prev.walls, newWall] }));
            setHasChanges(true);
            
            // If we closed a room, trigger floor fill
            if (canCloseShape) {
              console.log('[LoopClosure] Room closed! Triggering floor detection...');
              // The unified boundary will automatically detect the closed loop on next render
            }
          }
        }
        setWallClickMode(null);
        setTempWall(null);
        setDrawStart(null);
        setPreClickSnap(null);
        setCanCloseShape(null);
        setChainStartIndicator(null);
        setProjectedIntersections([]);
        return;
      }

      // First click - start wall drawing from PRE-SNAPPED point
      setDrawStart(startPoint);
      setPreClickSnap(null); // Clear pre-click indicator once clicked
      
      if (wallDrawMode === 'rectangle' || wallDrawMode === 'square') {
        setIsDrawing(true);
        setTempRectWalls({ start: startPoint, end: startPoint });
      } else {
        // Free line - use click-release mode
        setWallClickMode('waiting_end');
        setTempWall({ start: startPoint, end: startPoint, length: 0 });
      }
    } else if (tool === 'door' && selectedDoorType) {
      addOpening(canvas.x, canvas.y, 'door', selectedDoorType);
    } else if (tool === 'window' && selectedWindowType) {
      addOpening(canvas.x, canvas.y, 'window', selectedWindowType);
    } else if (tool === 'module' && selectedModuleType) {
      addModule(canvas.x, canvas.y);
    } else if (tool === 'fill') {
      // Manual floor fill tool - click inside room
      handleFillFloor(canvas.x, canvas.y);
    } else if (tool === 'split') {
      // Wall split tool - click on wall to split it at the preview point
      if (splitPreview && splitPreview.wallId) {
        const success = splitWallAt(splitPreview.wallId, splitPreview.x, splitPreview.y);
        if (success) {
          setSplitPreview(null);
          setTool('select'); // Switch back to select tool after successful split
        }
      }
    } else if (tool === 'select') {
      // SELECTION PRIORITY ORDER: Vertex > Module > Door/Window > Wall > Floor
      
      // Priority 1: Check for vertex (junction point) click first
      const vertex = findVertexAt(canvas.x, canvas.y);
      if (vertex && vertex.walls.length >= 2) {
        // Junction point selected - will drag all connected walls together
        saveToHistory();
        setSelectedVertex(vertex);
        setSelectedItem(null); // Clear single wall selection
        setIsDragging(true);
        setDragType('vertex');
        setDragStart({ x: canvas.x, y: canvas.y, vertexX: vertex.x, vertexY: vertex.y });
        return;
      }
      
      // Priority 2: Check for module click
      const clickedModule = findModuleAt(canvas.x, canvas.y);
      if (clickedModule) {
        setSelectedVertex(null);
        setSelectedItem({ type: 'module', item: clickedModule });
        setIsDragging(true);
        setDragType('module');
        setDragStart({ x: canvas.x - clickedModule.x, y: canvas.y - clickedModule.y });
        return;
      }
      
      // Priority 3: Check for door/window click
      const clickedDoor = findDoorAt(canvas.x, canvas.y);
      if (clickedDoor) {
        setSelectedVertex(null);
        setSelectedItem({ type: 'door', item: clickedDoor });
        setIsDragging(true);
        setDragType('door');
        setDragStart({ x: canvas.x - clickedDoor.x, y: canvas.y - clickedDoor.y });
        return;
      }
      
      const clickedWindow = findWindowAt(canvas.x, canvas.y);
      if (clickedWindow) {
        setSelectedItem({ type: 'window', item: clickedWindow });
        setIsDragging(true);
        setDragType('window');
        setDragStart({ x: canvas.x - clickedWindow.x, y: canvas.y - clickedWindow.y });
        return;
      }
      
      // Priority 4: Check for wall click (body of wall, not endpoint)
      const clickedWall = findWallAt(canvas.x, canvas.y);
      if (clickedWall) {
        // Check if clicking near an endpoint of this specific wall
        const wallEndpoint = findSpecificWallEndpoint(canvas.x, canvas.y, clickedWall);
        if (wallEndpoint) {
          saveToHistory();
          setSelectedItem({ type: 'wall', item: clickedWall });
          setIsDragging(true);
          setDragType('wall_endpoint');
          setDragEndpoint(wallEndpoint);
        } else {
          // Select wall for dragging (whole wall movement)
          saveToHistory();
          setSelectedItem({ type: 'wall', item: clickedWall });
          setIsDragging(true);
          setDragType('wall');
          setDragStart({ x: canvas.x, y: canvas.y, wall_start_x: clickedWall.start_x, wall_start_y: clickedWall.start_y, wall_end_x: clickedWall.end_x, wall_end_y: clickedWall.end_y });
          
          // Detect rectangular loop at drag start - store for parametric editing
          const detectedLoop = detectRectangularLoop(clickedWall.wall_id);
          setActiveRectLoop(detectedLoop);
          console.log('[DragStart] Detected rect loop:', detectedLoop ? 'YES' : 'NO');
        }
      } else {
        setSelectedItem(null);
        setShowElevationModal(false);
      }
    }
  };

  // Handle mouse move
  const handleMouseMove = (e) => {
    // Handle panning (Item #1)
    if (isPanning && panStart) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const canvas = screenToCanvas(e.clientX, e.clientY);

    // Coohom-style wall drawing with real-time dimension display
    if ((wallClickMode === 'waiting_end' || isDrawing) && tool === 'wall') {
      // First snap to endpoints, then grid
      const snapResult = findSnapPoint(canvas.x, canvas.y);
      let endPoint = { x: snapResult.x, y: snapResult.y };
      
      // ALWAYS show alignment guides to help draw straight lines
      const guides = findAlignmentGuides(drawStart.x, drawStart.y, endPoint.x, endPoint.y);
      setAlignmentGuides(guides);
      
      // Apply ortho constraint if enabled (Coohom default behavior)
      if (orthoMode || shiftKeyHeld) {
        const orthoResult = applyOrthogonalConstraint(drawStart.x, drawStart.y, endPoint.x, endPoint.y);
        endPoint = { x: orthoResult.x, y: orthoResult.y };
      }
      
      // Find connection suggestions - show guidelines to potential endpoints
      const { suggestions, closePoint, chainStart } = findConnectionSuggestions(
        drawStart.x, drawStart.y, endPoint.x, endPoint.y
      );
      setConnectionSuggestions(suggestions);
      setCanCloseShape(closePoint);
      setChainStartIndicator(chainStart); // Show blue circle at chain start
      
      // LOOP CLOSURE PROJECTION: Detect if trajectory aligns with room start
      // This shows guidance WHILE drawing 3rd wall (before final wall)
      const closureProjection = findLoopClosureProjection(
        drawStart.x, drawStart.y, endPoint.x, endPoint.y, chainStart
      );
      setLoopClosureProjection(closureProjection);
      
      // Log for debugging
      if (closureProjection) {
        console.log('[LoopClosureProjection] Intersection found! Wall 4 length:', 
          closureProjection.wall4Length.toFixed(0), 'mm, Cursor distance:', closureProjection.cursorDistance.toFixed(0), 'mm');
      }
      
      // LOOP CLOSURE SNAP: If close point is detected, snap cursor to it
      if (closePoint && closePoint.distance < 150) {
        // Strong snap to close point when within 150mm
        endPoint = { x: closePoint.x, y: closePoint.y };
        console.log('[Intersection] Snapping to close point!');
      }
      
      // Calculate and display real-time dimension (Coohom-style)
      const length = Math.round(Math.sqrt(
        Math.pow(endPoint.x - drawStart.x, 2) + Math.pow(endPoint.y - drawStart.y, 2)
      ));
      const midX = (drawStart.x + endPoint.x) / 2;
      const midY = (drawStart.y + endPoint.y) / 2;
      setDrawingDimension({ length, x: midX, y: midY });

      if (wallDrawMode === 'rectangle') {
        setTempRectWalls({ start: drawStart, end: endPoint });
      } else if (wallDrawMode === 'square') {
        const size = Math.max(Math.abs(endPoint.x - drawStart.x), Math.abs(endPoint.y - drawStart.y));
        const signX = endPoint.x > drawStart.x ? 1 : -1;
        const signY = endPoint.y > drawStart.y ? 1 : -1;
        endPoint = { x: drawStart.x + size * signX, y: drawStart.y + size * signY };
        setTempRectWalls({ start: drawStart, end: endPoint });
      } else if (wallDrawMode === 'arc') {
        // Arc wall mode - calculate arc based on input method
        const bulgeDir = calculateBulgeDirection(drawStart.x, drawStart.y, endPoint.x, endPoint.y, canvas.x, canvas.y);
        setArcBulgeDirection(bulgeDir);
        
        let arcParams;
        if (arcInputMethod === 'radius') {
          const radiusValue = parseFloat(arcRadiusInput) || 1000;
          arcParams = calculateArcFromRadius(drawStart.x, drawStart.y, endPoint.x, endPoint.y, radiusValue, bulgeDir);
        } else {
          const chordHeightValue = parseFloat(arcChordHeightInput) || 500;
          arcParams = calculateArcFromChordHeight(drawStart.x, drawStart.y, endPoint.x, endPoint.y, chordHeightValue, bulgeDir);
        }
        
        setTempArcWall(arcParams);
        setDrawingDimension({ 
          length: Math.round(arcParams.arcLength), 
          x: midX, 
          y: midY,
          isArc: true,
          radius: Math.round(arcParams.radius),
          chordHeight: Math.round(arcParams.chordHeight)
        });
      } else {
        // Free line mode (straight wall)
        // Calculate projected intersections with existing walls
        const intersections = findProjectedIntersections(drawStart.x, drawStart.y, endPoint.x, endPoint.y);
        setProjectedIntersections(intersections);
        
        // Log first intersection for debugging
        if (intersections.length > 0) {
          console.log('[ProjectedIntersection] Found', intersections.length, 'intersection(s), nearest at:', 
            intersections[0].x.toFixed(0), intersections[0].y.toFixed(0));
        }
        
        setTempWall({ 
          start: drawStart, 
          end: endPoint, 
          length: length,
          snappedAngle: null
        });
      }
    } else {
      // Clear visual indicators when not drawing
      if (alignmentGuides.length > 0) setAlignmentGuides([]);
      if (drawingDimension) setDrawingDimension(null);
      
      // Clear connection suggestions when not drawing
      if (connectionSuggestions.length > 0) setConnectionSuggestions([]);
      if (canCloseShape) setCanCloseShape(null);
      if (projectedIntersections.length > 0) setProjectedIntersections([]);
      if (loopClosureProjection) setLoopClosureProjection(null);
      if (tempArcWall) setTempArcWall(null);
      
      // PRE-CLICK SNAP: Show vertex snap indicator BEFORE clicking (when wall tool is active)
      if (tool === 'wall' && !wallClickMode) {
        const vertex = findVertexAt(canvas.x, canvas.y);
        if (vertex) {
          setPreClickSnap({ x: vertex.x, y: vertex.y, type: 'vertex' });
          setHoveredVertex(vertex);
        } else {
          // Show grid snap point
          const gridX = Math.round(canvas.x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
          const gridY = Math.round(canvas.y / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
          setPreClickSnap({ x: gridX, y: gridY, type: 'grid' });
          setHoveredVertex(null);
        }
      } else if (!wallClickMode && !isDragging) {
        setPreClickSnap(null);
        setHoveredVertex(null);
      }
    }

    // Dragging wall endpoint (Item #1) - with auto-merge on snap and T-junction support
    if (isDragging && dragType === 'wall_endpoint' && selectedItem?.type === 'wall') {
      const wall = selectedItem.item;
      
      // CAD Enhanced: Check for vertex merge target (endpoint or T-junction)
      const mergeTarget = findMergeTarget(canvas.x, canvas.y, wall.wall_id, dragEndpoint);
      if (mergeTarget) {
        // Show indicator based on merge type
        const indicatorType = mergeTarget.type === 'tjunction' ? 'tjunction' : 'endpoint';
        setSnapIndicator({ x: mergeTarget.x, y: mergeTarget.y, type: indicatorType, target: mergeTarget });
        
        // Snap wall endpoint to the target
        if (dragEndpoint === 'start') {
          updateWallPosition(wall.wall_id, { start_x: mergeTarget.x, start_y: mergeTarget.y });
        } else {
          updateWallPosition(wall.wall_id, { end_x: mergeTarget.x, end_y: mergeTarget.y });
        }
      } else {
        // Use enhanced snapping
        const snapResult = findSnapPoint(canvas.x, canvas.y, wall.wall_id);
        const newPos = snapResult.snapped ? { x: snapResult.x, y: snapResult.y } : canvas;
        
        // Apply Shift constraint for orthogonal movement
        let finalPos = newPos;
        if (shiftKeyHeld) {
          const refX = dragEndpoint === 'start' ? wall.end_x : wall.start_x;
          const refY = dragEndpoint === 'start' ? wall.end_y : wall.start_y;
          finalPos = applyOrthogonalConstraint(refX, refY, newPos.x, newPos.y);
        }
        
        // Update alignment guides
        setAlignmentGuides(findAlignmentGuides(finalPos.x, finalPos.y, wall.wall_id));
        
        if (dragEndpoint === 'start') {
          updateWallPosition(wall.wall_id, { start_x: finalPos.x, start_y: finalPos.y });
        } else {
          updateWallPosition(wall.wall_id, { end_x: finalPos.x, end_y: finalPos.y });
        }
      }
    }

    // Dragging vertex (junction point) - moves connected wall endpoints OR creates auto walls
    if (isDragging && dragType === 'vertex' && selectedVertex) {
      const dx = canvas.x - dragStart.vertexX;
      const dy = canvas.y - dragStart.vertexY;
      
      // Apply snap/constraints
      let newX = dragStart.vertexX + dx;
      let newY = dragStart.vertexY + dy;
      
      // Apply orthogonal constraint if shift is held
      if (shiftKeyHeld) {
        const constrained = applyOrthogonalConstraint(dragStart.vertexX, dragStart.vertexY, newX, newY);
        newX = constrained.x;
        newY = constrained.y;
      }
      
      // Check for snap to other vertices or grid
      const snapResult = findSnapPoint(newX, newY, null);
      if (snapResult.snapped) {
        newX = snapResult.x;
        newY = snapResult.y;
        setSnapIndicator({ x: newX, y: newY, type: snapResult.type });
      } else {
        setSnapIndicator(null);
      }
      
      // Update all connected walls - they stretch to follow the junction
      for (const { wall, endpoint } of selectedVertex.walls) {
        if (endpoint === 'start') {
          updateWallPosition(wall.wall_id, { start_x: newX, start_y: newY });
        } else {
          updateWallPosition(wall.wall_id, { end_x: newX, end_y: newY });
        }
      }
      
      // Update the selectedVertex position for rendering
      setSelectedVertex(prev => prev ? { ...prev, x: newX, y: newY } : null);
      
      // Update alignment guides
      setAlignmentGuides(findAlignmentGuides(newX, newY, null));
    }

    // Dragging entire wall (Item #1) - with parametric editing for rectangular loops
    if (isDragging && dragType === 'wall' && selectedItem?.type === 'wall') {
      const wall = selectedItem.item;
      
      // Calculate incremental delta from last position (not from drag start)
      // This is crucial for parametric editing where state updates async
      const lastX = dragStart.lastX ?? dragStart.x;
      const lastY = dragStart.lastY ?? dragStart.y;
      const incrementalDx = canvas.x - lastX;
      const incrementalDy = canvas.y - lastY;
      
      // Calculate total delta from drag start (for both parametric and fallback modes)
      const totalDx = canvas.x - dragStart.x;
      const totalDy = canvas.y - dragStart.y;
      
      // Try parametric editing for rectangular loops first (uses total delta with stored loop)
      const usedParametric = updateRectangularLoopWall(wall.wall_id, { dx: totalDx, dy: totalDy }, activeRectLoop);
      
      if (!usedParametric) {
        // Fallback to normal wall movement for non-rectangular walls (uses total delta)
        updateWallPosition(wall.wall_id, {
          start_x: dragStart.wall_start_x + totalDx,
          start_y: dragStart.wall_start_y + totalDy,
          end_x: dragStart.wall_end_x + totalDx,
          end_y: dragStart.wall_end_y + totalDy
        });
      }
    }

    // Dragging module with magnetic snap (Item #2)
    if (isDragging && dragType === 'module' && selectedItem?.type === 'module') {
      const module = selectedItem.item;
      const newX = canvas.x - dragStart.x;
      const newY = canvas.y - dragStart.y;
      const snapped = snapModuleToWall(newX, newY, module.width, module.depth);
      updateModule(module.module_id, snapped);
    }

    // Dragging door (Item #6)
    if (isDragging && dragType === 'door' && selectedItem?.type === 'door') {
      const door = selectedItem.item;
      const newX = canvas.x - dragStart.x;
      const newY = canvas.y - dragStart.y;
      // Find nearest wall and snap to it
      const nearestWall = findNearestWall(newX + door.width / 2, newY + door.depth / 2);
      if (nearestWall) {
        const snappedPos = snapOpeningToWall(newX, newY, door.width, door.depth, nearestWall);
        updateOpening('door', door.door_id, { x: snappedPos.x, y: snappedPos.y, wall_id: nearestWall.wall_id });
      } else {
        updateOpening('door', door.door_id, { x: Math.round(newX), y: Math.round(newY) });
      }
    }

    // Dragging window (Item #6)
    if (isDragging && dragType === 'window' && selectedItem?.type === 'window') {
      const win = selectedItem.item;
      const newX = canvas.x - dragStart.x;
      const newY = canvas.y - dragStart.y;
      const nearestWall = findNearestWall(newX + win.width / 2, newY + win.depth / 2);
      if (nearestWall) {
        const snappedPos = snapOpeningToWall(newX, newY, win.width, win.depth, nearestWall);
        updateOpening('window', win.window_id, { x: snappedPos.x, y: snappedPos.y, wall_id: nearestWall.wall_id });
      } else {
        updateOpening('window', win.window_id, { x: Math.round(newX), y: Math.round(newY) });
      }
    }

    // Split tool - show preview of split point on wall
    if (tool === 'split') {
      const splitPoint = findSplitPointOnWall(canvas.x, canvas.y);
      setSplitPreview(splitPoint);
    } else if (splitPreview) {
      setSplitPreview(null);
    }
  };

  // Snap opening to wall (supports arc walls)
  const snapOpeningToWall = (x, y, width, depth, wall) => {
    if (wall.is_arc) {
      // Arc wall: snap to arc centerline with tangent rotation
      const dx = x - wall.arc_center_x;
      const dy = y - wall.arc_center_y;
      
      // Project point onto arc centerline
      const angle = Math.atan2(dy, dx);
      const snapX = wall.arc_center_x + wall.arc_radius * Math.cos(angle);
      const snapY = wall.arc_center_y + wall.arc_radius * Math.sin(angle);
      
      // Calculate tangent angle at this point (perpendicular to radius)
      const tangentAngle = angle + Math.PI / 2;
      const rotationDegrees = tangentAngle * (180 / Math.PI);
      
      // Calculate position ratio along arc (0-1)
      let angleDiff = wall.arc_end_angle - wall.arc_start_angle;
      if (wall.arc_bulge_direction > 0 && angleDiff > 0) angleDiff -= 2 * Math.PI;
      if (wall.arc_bulge_direction < 0 && angleDiff < 0) angleDiff += 2 * Math.PI;
      
      let positionAngleDiff = angle - wall.arc_start_angle;
      if (wall.arc_bulge_direction > 0 && positionAngleDiff > 0) positionAngleDiff -= 2 * Math.PI;
      if (wall.arc_bulge_direction < 0 && positionAngleDiff < 0) positionAngleDiff += 2 * Math.PI;
      
      const positionRatio = Math.abs(angleDiff) > 0 ? Math.abs(positionAngleDiff / angleDiff) : 0;
      const clampedRatio = Math.max(0, Math.min(1, positionRatio));
      
      return {
        x: snapX - width / 2,
        y: snapY - depth / 2,
        rotation: rotationDegrees,
        arc_position_ratio: clampedRatio,
        is_on_arc: true
      };
    }
    
    // Straight wall: original logic
    const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
    if (isHorizontal) {
      // Constrain X to wall bounds
      const minX = Math.min(wall.start_x, wall.end_x);
      const maxX = Math.max(wall.start_x, wall.end_x) - width;
      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: wall.start_y - depth / 2,
        rotation: 0,
        is_on_arc: false
      };
    } else {
      const minY = Math.min(wall.start_y, wall.end_y);
      const maxY = Math.max(wall.start_y, wall.end_y) - depth;
      return {
        x: wall.start_x - width / 2,
        y: Math.max(minY, Math.min(maxY, y)),
        rotation: 90,
        is_on_arc: false
      };
    }
  };

  // Move opening along wall (Item #6)
  const moveOpeningAlongWall = (item, dx, dy) => {
    const opening = item.item;
    const key = item.type === 'door' ? 'door_id' : 'window_id';
    const id = opening[key];
    
    // Find attached wall
    const wall = layout?.walls?.find(w => w.wall_id === opening.wall_id);
    if (wall) {
      const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
      let newX = opening.x + (isHorizontal ? dx : 0);
      let newY = opening.y + (isHorizontal ? 0 : dy);
      
      // Constrain to wall
      if (isHorizontal) {
        const minX = Math.min(wall.start_x, wall.end_x);
        const maxX = Math.max(wall.start_x, wall.end_x) - opening.width;
        newX = Math.max(minX, Math.min(maxX, newX));
      } else {
        const minY = Math.min(wall.start_y, wall.end_y);
        const maxY = Math.max(wall.start_y, wall.end_y) - opening.height;
        newY = Math.max(minY, Math.min(maxY, newY));
      }
      
      updateOpening(item.type, id, { x: newX, y: newY });
    } else {
      updateOpening(item.type, id, { x: opening.x + dx, y: opening.y + dy });
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    // End panning (Item #1)
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Handle T-junction creation when dragging wall endpoint
    if (isDragging && dragType === 'wall_endpoint' && selectedItem?.type === 'wall' && snapIndicator?.type === 'tjunction') {
      const targetWall = layout.walls.find(w => w.wall_id === snapIndicator.target.wallId);
      if (targetWall) {
        // Split the target wall at the T-junction point
        const dx = targetWall.end_x - targetWall.start_x;
        const dy = targetWall.end_y - targetWall.start_y;
        const wallAngle = Math.atan2(dy, dx);
        
        // Calculate wall segment lengths
        const length1 = Math.round(Math.sqrt(
          Math.pow(snapIndicator.x - targetWall.start_x, 2) + 
          Math.pow(snapIndicator.y - targetWall.start_y, 2)
        ));
        const length2 = Math.round(Math.sqrt(
          Math.pow(targetWall.end_x - snapIndicator.x, 2) + 
          Math.pow(targetWall.end_y - snapIndicator.y, 2)
        ));
        
        if (length1 >= 100 && length2 >= 100) {
          saveToHistory();
          
          // Create two new walls from the split
          const wall1 = {
            wall_id: `wall_${Date.now()}_t1`,
            start_x: targetWall.start_x,
            start_y: targetWall.start_y,
            end_x: snapIndicator.x,
            end_y: snapIndicator.y,
            length: length1,
            thickness: targetWall.thickness || DEFAULT_WALL_THICKNESS,
            height: targetWall.height || DEFAULT_WALL_HEIGHT
          };
          
          const wall2 = {
            wall_id: `wall_${Date.now()}_t2`,
            start_x: snapIndicator.x,
            start_y: snapIndicator.y,
            end_x: targetWall.end_x,
            end_y: targetWall.end_y,
            length: length2,
            thickness: targetWall.thickness || DEFAULT_WALL_THICKNESS,
            height: targetWall.height || DEFAULT_WALL_HEIGHT
          };
          
          // Add T-junction marker
          setSplitMarkers(prev => [...prev, {
            x: snapIndicator.x,
            y: snapIndicator.y,
            angle: wallAngle + Math.PI / 2,
            thickness: targetWall.thickness || DEFAULT_WALL_THICKNESS
          }]);
          
          // Update layout: remove old wall, add two new walls
          setLayout(prev => ({
            ...prev,
            walls: [...prev.walls.filter(w => w.wall_id !== targetWall.wall_id), wall1, wall2]
          }));
          
          setHasChanges(true);
          toast.success('T-junction created');
        }
      }
    }

    if (isDrawing && tool === 'wall') {
      saveToHistory();
      if (wallDrawMode === 'rectangle' || wallDrawMode === 'square') {
        // Create 4 walls for rectangle/square
        if (tempRectWalls) {
          const { start, end } = tempRectWalls;
          const minLen = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
          if (minLen > 100) {
            const walls = [
              createWall(start.x, start.y, end.x, start.y), // Top
              createWall(end.x, start.y, end.x, end.y),     // Right
              createWall(end.x, end.y, start.x, end.y),     // Bottom
              createWall(start.x, end.y, start.x, start.y)  // Left
            ];
            setLayout(prev => ({ ...prev, walls: [...prev.walls, ...walls] }));
            setHasChanges(true);
          }
        }
      } else if (wallDrawMode === 'arc' && tempArcWall) {
        // Create arc wall
        if (tempArcWall.chordLength > 100) {
          const newArcWall = createArcWall(tempArcWall);
          setLayout(prev => ({ ...prev, walls: [...prev.walls, newArcWall] }));
          setHasChanges(true);
          toast.success(`Arc wall created: ${Math.round(tempArcWall.arcLength)}mm arc length`);
        }
      } else if (tempWall && tempWall.length > 100) {
        const newWall = createWall(tempWall.start.x, tempWall.start.y, tempWall.end.x, tempWall.end.y);
        setLayout(prev => ({ ...prev, walls: [...prev.walls, newWall] }));
        setHasChanges(true);
      }
    }

    setIsDrawing(false);
    setTempWall(null);
    setTempRectWalls(null);
    setTempArcWall(null);
    setIsDragging(false);
    setDragStart(null);
    setDragType(null);
    setDragEndpoint(null);
    setActiveRectLoop(null); // Clear parametric loop reference
    setSelectedVertex(null); // Clear vertex selection
    
    // Clear all visual indicators
    setSnapIndicator(null);
    setAlignmentGuides([]);
    setDrawingDimension(null);
    setPreClickSnap(null);
    setHoveredVertex(null);
    setConnectionSuggestions([]);
    setCanCloseShape(null);
  };

  // Create wall helper - now includes height (Item #1)
  const createWall = (startX, startY, endX, endY) => {
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    return {
      wall_id: `wall_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY,
      length: Math.round(length),
      thickness: DEFAULT_WALL_THICKNESS,
      height: DEFAULT_WALL_HEIGHT,  // Item #1 - Wall height
      is_arc: false
    };
  };

  // Create arc wall helper
  const createArcWall = (arcParams) => {
    return {
      wall_id: `arc_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
      start_x: arcParams.startX,
      start_y: arcParams.startY,
      end_x: arcParams.endX,
      end_y: arcParams.endY,
      length: Math.round(arcParams.arcLength), // Arc length for BOQ
      thickness: DEFAULT_WALL_THICKNESS,
      height: DEFAULT_WALL_HEIGHT,
      is_arc: true,
      // Arc-specific properties
      arc_radius: arcParams.radius,
      arc_chord_length: arcParams.chordLength,
      arc_chord_height: arcParams.chordHeight,
      arc_center_x: arcParams.centerX,
      arc_center_y: arcParams.centerY,
      arc_start_angle: arcParams.startAngle,
      arc_end_angle: arcParams.endAngle,
      arc_sweep_flag: arcParams.sweepFlag,
      arc_large_arc_flag: arcParams.largeArcFlag,
      arc_bulge_direction: arcParams.bulgeDirection
    };
  };

  // Find nearest vertex (wall endpoint) with larger hitbox for priority selection
  // Returns { x, y, walls: [{wall, endpoint}], distance } or null
  const findVertexAt = useCallback((x, y) => {
    if (!layout?.walls?.length) return null;
    
    // Use larger hitbox for vertex detection (invisible but larger than visual handle)
    const hitboxThreshold = (VERTEX_HITBOX_RADIUS * 2) / scale;
    
    // Build a map of unique vertices (endpoints that may be shared by multiple walls)
    const vertexMap = new Map();
    
    for (const wall of layout.walls) {
      // Check start endpoint
      const startKey = `${Math.round(wall.start_x)},${Math.round(wall.start_y)}`;
      if (!vertexMap.has(startKey)) {
        vertexMap.set(startKey, { x: wall.start_x, y: wall.start_y, walls: [] });
      }
      vertexMap.get(startKey).walls.push({ wall, endpoint: 'start' });
      
      // Check end endpoint
      const endKey = `${Math.round(wall.end_x)},${Math.round(wall.end_y)}`;
      if (!vertexMap.has(endKey)) {
        vertexMap.set(endKey, { x: wall.end_x, y: wall.end_y, walls: [] });
      }
      vertexMap.get(endKey).walls.push({ wall, endpoint: 'end' });
    }
    
    // Find the nearest vertex within hitbox
    let nearest = null;
    let minDist = hitboxThreshold;
    
    for (const vertex of vertexMap.values()) {
      const dist = Math.sqrt(Math.pow(x - vertex.x, 2) + Math.pow(y - vertex.y, 2));
      if (dist < minDist) {
        minDist = dist;
        nearest = { ...vertex, distance: dist };
      }
    }
    
    return nearest;
  }, [layout?.walls, scale]);

  // Find wall endpoint at position (for resizing) - uses vertex detection
  const findWallEndpointAt = (x, y) => {
    const vertex = findVertexAt(x, y);
    if (vertex && vertex.walls.length > 0) {
      // Return the first wall at this vertex
      return vertex.walls[0];
    }
    return null;
  };

  // Find endpoint on a specific wall (for length extension in select mode)
  const findSpecificWallEndpoint = (x, y, wall) => {
    const threshold = (ENDPOINT_HANDLE_SIZE * 2.5) / scale; // Slightly larger for wall edges
    
    const distStart = Math.sqrt(Math.pow(x - wall.start_x, 2) + Math.pow(y - wall.start_y, 2));
    if (distStart < threshold) {
      return 'start';
    }
    const distEnd = Math.sqrt(Math.pow(x - wall.end_x, 2) + Math.pow(y - wall.end_y, 2));
    if (distEnd < threshold) {
      return 'end';
    }
    return null;
  };

  // Find module at position
  const findModuleAt = (x, y) => {
    if (!layout?.modules) return null;
    return layout.modules.find(m => {
      return x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.depth;
    });
  };

  // Find wall at position
  const findWallAt = (x, y) => {
    if (!layout?.walls) return null;
    return layout.walls.find(w => {
      const thickness = w.thickness || DEFAULT_WALL_THICKNESS;
      const minX = Math.min(w.start_x, w.end_x) - thickness / 2;
      const maxX = Math.max(w.start_x, w.end_x) + thickness / 2;
      const minY = Math.min(w.start_y, w.end_y) - thickness / 2;
      const maxY = Math.max(w.start_y, w.end_y) + thickness / 2;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    });
  };

  // Find door at position
  const findDoorAt = (x, y) => {
    if (!layout?.doors) return null;
    return layout.doors.find(d => {
      return x >= d.x && x <= d.x + d.width && y >= d.y && y <= d.y + d.depth;
    });
  };

  // Find window at position
  const findWindowAt = (x, y) => {
    if (!layout?.windows) return null;
    return layout.windows.find(w => {
      return x >= w.x && x <= w.x + w.width && y >= w.y && y <= w.y + w.depth;
    });
  };

  // Find nearest wall
  const findNearestWall = (x, y) => {
    if (!layout?.walls?.length) return null;
    let nearest = null;
    let minDist = Infinity;

    for (const wall of layout.walls) {
      const dist = distanceToWall(x, y, wall);
      if (dist < minDist && dist < 300) {
        minDist = dist;
        nearest = wall;
      }
    }
    return nearest;
  };

  // Distance to wall (supports both straight and arc walls)
  const distanceToWall = (x, y, wall) => {
    if (wall.is_arc) {
      // Arc wall: calculate distance to arc centerline
      const dx = x - wall.arc_center_x;
      const dy = y - wall.arc_center_y;
      const distToCenter = Math.sqrt(dx * dx + dy * dy);
      
      // Distance to arc curve is |distToCenter - radius|
      const distToArc = Math.abs(distToCenter - wall.arc_radius);
      
      // Also check if point is within the arc's angle range
      const angle = Math.atan2(dy, dx);
      let startAngle = wall.arc_start_angle;
      let endAngle = wall.arc_end_angle;
      
      // Normalize angles for comparison
      const normalizeAngle = (a) => {
        while (a < -Math.PI) a += 2 * Math.PI;
        while (a > Math.PI) a -= 2 * Math.PI;
        return a;
      };
      
      const normAngle = normalizeAngle(angle);
      const normStart = normalizeAngle(startAngle);
      const normEnd = normalizeAngle(endAngle);
      
      // Check if angle is within arc span (accounting for direction)
      let inRange = false;
      if (wall.arc_bulge_direction > 0) {
        // Counter-clockwise arc
        if (normStart > normEnd) {
          inRange = normAngle >= normEnd && normAngle <= normStart;
        } else {
          inRange = normAngle >= normStart || normAngle <= normEnd;
        }
      } else {
        // Clockwise arc
        if (normStart < normEnd) {
          inRange = normAngle >= normStart && normAngle <= normEnd;
        } else {
          inRange = normAngle >= normStart || normAngle <= normEnd;
        }
      }
      
      return inRange ? distToArc : Infinity;
    }
    
    // Straight wall: original logic
    const dx = wall.end_x - wall.start_x;
    const dy = wall.end_y - wall.start_y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return Infinity;

    const t = Math.max(0, Math.min(1, ((x - wall.start_x) * dx + (y - wall.start_y) * dy) / (length * length)));
    const nearestX = wall.start_x + t * dx;
    const nearestY = wall.start_y + t * dy;

    return Math.sqrt((x - nearestX) ** 2 + (y - nearestY) ** 2);
  };

  // Snap opening to wall (supports arc walls)
  const snapOpeningToWall = (x, y, width, depth, wall) => {
    if (wall.is_arc) {
      // Arc wall: snap to arc centerline with tangent rotation
      const dx = x - wall.arc_center_x;
      const dy = y - wall.arc_center_y;
      const distToCenter = Math.sqrt(dx * dx + dy * dy);
      
      // Project point onto arc centerline
      const angle = Math.atan2(dy, dx);
      const snapX = wall.arc_center_x + wall.arc_radius * Math.cos(angle);
      const snapY = wall.arc_center_y + wall.arc_radius * Math.sin(angle);
      
      // Calculate tangent angle at this point (perpendicular to radius)
      const tangentAngle = angle + Math.PI / 2;
      const rotationDegrees = tangentAngle * (180 / Math.PI);
      
      // Calculate position ratio along arc (0-1)
      let angleDiff = wall.arc_end_angle - wall.arc_start_angle;
      if (wall.arc_bulge_direction > 0 && angleDiff > 0) angleDiff -= 2 * Math.PI;
      if (wall.arc_bulge_direction < 0 && angleDiff < 0) angleDiff += 2 * Math.PI;
      
      let positionAngleDiff = angle - wall.arc_start_angle;
      if (wall.arc_bulge_direction > 0 && positionAngleDiff > 0) positionAngleDiff -= 2 * Math.PI;
      if (wall.arc_bulge_direction < 0 && positionAngleDiff < 0) positionAngleDiff += 2 * Math.PI;
      
      const positionRatio = Math.abs(angleDiff) > 0 ? Math.abs(positionAngleDiff / angleDiff) : 0;
      const clampedRatio = Math.max(0, Math.min(1, positionRatio));
      
      return {
        x: snapX - width / 2,
        y: snapY - depth / 2,
        rotation: rotationDegrees,
        arc_position_ratio: clampedRatio,
        is_on_arc: true
      };
    }
    
    // Straight wall: original logic
    const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
    if (isHorizontal) {
      // Constrain X to wall bounds
      const minX = Math.min(wall.start_x, wall.end_x);
      const maxX = Math.max(wall.start_x, wall.end_x) - width;
      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: wall.start_y - depth / 2,
        rotation: 0,
        is_on_arc: false
      };
    } else {
      const minY = Math.min(wall.start_y, wall.end_y);
      const maxY = Math.max(wall.start_y, wall.end_y) - depth;
      return {
        x: wall.start_x - width / 2,
        y: Math.max(minY, Math.min(maxY, y)),
        rotation: 90,
        is_on_arc: false
      };
    }
  };

  // Add module with wall snap (Item #7)
  const addModule = (x, y) => {
    if (!selectedModuleType || !moduleLibrary.module_types) return;
    saveToHistory();

    const moduleType = moduleLibrary.module_types[selectedModuleType];
    if (!moduleType) return;

    // Snap to nearest wall
    const snapped = snapModuleToWall(x, y, moduleType.default_width, moduleType.default_depth);

    const newModule = {
      module_id: `mod_${Date.now().toString(36)}`,
      module_type: selectedModuleType,
      wall_id: snapped.wall_id,
      position_on_wall: 0,
      x: Math.round(snapped.x),
      y: Math.round(snapped.y),
      width: moduleType.default_width,
      height: moduleType.default_height,
      depth: moduleType.default_depth,
      rotation: 0,
      finish_type: 'laminate',
      shutter_type: 'flat',
      carcass_material: 'plywood_710',
      carcass_finish: 'laminate',
      custom_name: null,
      notes: null
    };

    setLayout(prev => ({ ...prev, modules: [...prev.modules, newModule] }));
    setHasChanges(true);
    setSelectedItem({ type: 'module', item: newModule });
  };

  // Add door or window with type selection (Item #5)
  const addOpening = (x, y, type, typeInfo) => {
    saveToHistory();
    const nearestWall = findNearestWall(x, y);
    if (!nearestWall) {
      toast.error('Place openings near a wall');
      return;
    }

    const wallThickness = nearestWall.thickness || DEFAULT_WALL_THICKNESS;
    const snappedPos = snapOpeningToWall(x, y, typeInfo.width, wallThickness, nearestWall);

    const opening = {
      [`${type}_id`]: `${type}_${Date.now().toString(36)}`,
      type_id: typeInfo.id,
      type_name: typeInfo.name,
      wall_id: nearestWall.wall_id,
      x: Math.round(snappedPos.x),
      y: Math.round(snappedPos.y),
      width: typeInfo.width,
      height: typeInfo.height,
      depth: wallThickness,
      rotation: snappedPos.rotation || 0,
      flipped: false,
      // Arc wall specific properties
      is_on_arc: snappedPos.is_on_arc || false,
      arc_position_ratio: snappedPos.arc_position_ratio || null
    };

    const key = type === 'door' ? 'doors' : 'windows';
    setLayout(prev => ({ ...prev, [key]: [...(prev[key] || []), opening] }));
    setHasChanges(true);
    setSelectedItem({ type, item: opening });
    
    if (nearestWall.is_arc) {
      toast.success(`${type === 'door' ? 'Door' : 'Window'} placed on arc wall (rotation: ${Math.round(snappedPos.rotation)}°)`);
    }
  };

  // Update module
  const updateModule = (moduleId, updates) => {
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.map(m => m.module_id === moduleId ? { ...m, ...updates } : m)
    }));
    setHasChanges(true);

    if (selectedItem?.item?.module_id === moduleId) {
      setSelectedItem(prev => ({ ...prev, item: { ...prev.item, ...updates } }));
    }
  };

  // Update wall position (Item #1)
  const updateWallPosition = (wallId, updates) => {
    setLayout(prev => ({
      ...prev,
      walls: prev.walls.map(w => {
        if (w.wall_id !== wallId) return w;
        const updated = { ...w, ...updates };
        // Recalculate length
        updated.length = Math.round(Math.sqrt(
          Math.pow(updated.end_x - updated.start_x, 2) +
          Math.pow(updated.end_y - updated.start_y, 2)
        ));
        return updated;
      })
    }));
    setHasChanges(true);

    if (selectedItem?.item?.wall_id === wallId) {
      setSelectedItem(prev => {
        const updated = { ...prev.item, ...updates };
        updated.length = Math.round(Math.sqrt(
          Math.pow(updated.end_x - updated.start_x, 2) +
          Math.pow(updated.end_y - updated.start_y, 2)
        ));
        return { ...prev, item: updated };
      });
    }
  };

  // Update wall (legacy - for length edits)
  const updateWall = (wallId, updates) => {
    setLayout(prev => ({
      ...prev,
      walls: prev.walls.map(w => {
        if (w.wall_id !== wallId) return w;
        const updated = { ...w, ...updates };
        if (updates.length !== undefined) {
          const dx = w.end_x - w.start_x;
          const dy = w.end_y - w.start_y;
          const oldLength = Math.sqrt(dx * dx + dy * dy);
          if (oldLength > 0) {
            const ratio = updates.length / oldLength;
            updated.end_x = w.start_x + dx * ratio;
            updated.end_y = w.start_y + dy * ratio;
          }
        }
        return updated;
      })
    }));
    setHasChanges(true);

    if (selectedItem?.item?.wall_id === wallId) {
      setSelectedItem(prev => ({ ...prev, item: { ...prev.item, ...updates } }));
    }
  };

  // Update opening (door/window)
  const updateOpening = (type, id, updates) => {
    const key = type === 'door' ? 'doors' : 'windows';
    const idKey = type === 'door' ? 'door_id' : 'window_id';
    
    setLayout(prev => ({
      ...prev,
      [key]: prev[key].map(item => item[idKey] === id ? { ...item, ...updates } : item)
    }));
    setHasChanges(true);

    if (selectedItem?.item?.[idKey] === id) {
      setSelectedItem(prev => ({ ...prev, item: { ...prev.item, ...updates } }));
    }
  };

  // Rotate door/window (Item #4)
  const rotateOpening = (type, id, degrees = 90) => {
    saveToHistory();
    const key = type === 'door' ? 'doors' : 'windows';
    const idKey = type === 'door' ? 'door_id' : 'window_id';
    
    setLayout(prev => ({
      ...prev,
      [key]: prev[key].map(item => {
        if (item[idKey] !== id) return item;
        const newRotation = ((item.rotation || 0) + degrees) % 360;
        return { ...item, rotation: newRotation };
      })
    }));
    setHasChanges(true);
  };

  // Flip door/window orientation (Item #4)
  const flipOpening = (type, id) => {
    saveToHistory();
    const key = type === 'door' ? 'doors' : 'windows';
    const idKey = type === 'door' ? 'door_id' : 'window_id';
    
    setLayout(prev => ({
      ...prev,
      [key]: prev[key].map(item => {
        if (item[idKey] !== id) return item;
        return { ...item, flipped: !item.flipped };
      })
    }));
    setHasChanges(true);
  };

  // Update wall thickness (Item #5)
  const updateWallThickness = (wallId, thickness) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      walls: prev.walls.map(w => w.wall_id === wallId ? { ...w, thickness } : w)
    }));
    setHasChanges(true);
    if (selectedItem?.item?.wall_id === wallId) {
      setSelectedItem(prev => ({ ...prev, item: { ...prev.item, thickness } }));
    }
  };

  // Inline dimension edit - start editing (Item #6)
  const startDimensionEdit = (wallId, currentLength) => {
    setEditingDimension(wallId);
    setDimensionInputValue(String(currentLength));
    setTimeout(() => dimensionInputRef.current?.focus(), 50);
  };

  // Inline dimension edit - apply change (Item #6)
  const applyDimensionEdit = () => {
    if (!editingDimension) return;
    const newLength = parseInt(dimensionInputValue, 10);
    if (isNaN(newLength) || newLength < 100) {
      setEditingDimension(null);
      return;
    }
    saveToHistory();
    updateWall(editingDimension, { length: newLength });
    setEditingDimension(null);
  };

  // Delete selected
  const deleteSelected = () => {
    if (!selectedItem) return;
    saveToHistory();

    if (selectedItem.type === 'module') {
      setLayout(prev => ({
        ...prev,
        modules: prev.modules.filter(m => m.module_id !== selectedItem.item.module_id)
      }));
    } else if (selectedItem.type === 'wall') {
      setLayout(prev => ({
        ...prev,
        walls: prev.walls.filter(w => w.wall_id !== selectedItem.item.wall_id)
      }));
    } else if (selectedItem.type === 'door') {
      setLayout(prev => ({
        ...prev,
        doors: prev.doors.filter(d => d.door_id !== selectedItem.item.door_id)
      }));
    } else if (selectedItem.type === 'window') {
      setLayout(prev => ({
        ...prev,
        windows: prev.windows.filter(w => w.window_id !== selectedItem.item.window_id)
      }));
    }

    setSelectedItem(null);
    setShowElevationModal(false);
    setHasChanges(true);
  };

  // Split wall at a specific point - creates two walls from one
  const splitWallAt = (wallId, splitX, splitY) => {
    const wall = layout?.walls?.find(w => w.wall_id === wallId);
    if (!wall) return false;
    
    saveToHistory();
    
    // Calculate the split point projected onto the wall line
    const dx = wall.end_x - wall.start_x;
    const dy = wall.end_y - wall.start_y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);
    
    if (wallLength < 100) return false; // Wall too short to split
    
    // Project the click point onto the wall line
    const t = Math.max(0.1, Math.min(0.9, 
      ((splitX - wall.start_x) * dx + (splitY - wall.start_y) * dy) / (wallLength * wallLength)
    ));
    
    const splitPointX = wall.start_x + t * dx;
    const splitPointY = wall.start_y + t * dy;
    
    // Calculate lengths of the two new walls
    const length1 = Math.round(Math.sqrt(
      Math.pow(splitPointX - wall.start_x, 2) + Math.pow(splitPointY - wall.start_y, 2)
    ));
    const length2 = Math.round(Math.sqrt(
      Math.pow(wall.end_x - splitPointX, 2) + Math.pow(wall.end_y - splitPointY, 2)
    ));
    
    // Don't split if either segment would be too short
    if (length1 < 100 || length2 < 100) {
      toast.error('Split point too close to wall endpoint');
      return false;
    }
    
    // Calculate wall angle for the split marker
    const wallAngle = Math.atan2(dy, dx);
    
    // Create two new walls
    const wall1 = {
      wall_id: `wall_${Date.now()}_1`,
      start_x: wall.start_x,
      start_y: wall.start_y,
      end_x: Math.round(splitPointX),
      end_y: Math.round(splitPointY),
      length: length1,
      thickness: wall.thickness || DEFAULT_WALL_THICKNESS,
      height: wall.height || DEFAULT_WALL_HEIGHT
    };
    
    const wall2 = {
      wall_id: `wall_${Date.now()}_2`,
      start_x: Math.round(splitPointX),
      start_y: Math.round(splitPointY),
      end_x: wall.end_x,
      end_y: wall.end_y,
      length: length2,
      thickness: wall.thickness || DEFAULT_WALL_THICKNESS,
      height: wall.height || DEFAULT_WALL_HEIGHT
    };
    
    // Add split marker to show dotted line at split point
    setSplitMarkers(prev => [...prev, {
      x: Math.round(splitPointX),
      y: Math.round(splitPointY),
      angle: wallAngle + Math.PI / 2, // Perpendicular to wall
      thickness: wall.thickness || DEFAULT_WALL_THICKNESS
    }]);
    
    // Replace the original wall with two new walls
    setLayout(prev => ({
      ...prev,
      walls: [...prev.walls.filter(w => w.wall_id !== wallId), wall1, wall2]
    }));
    
    setHasChanges(true);
    toast.success(`Wall split into ${length1}mm and ${length2}mm segments`);
    
    return true;
  };

  // Find the nearest point on a wall from cursor position (for split preview)
  const findSplitPointOnWall = (x, y) => {
    if (!layout?.walls?.length) return null;
    
    let bestWall = null;
    let bestPoint = null;
    let minDist = 50 / scale; // 50px threshold
    
    for (const wall of layout.walls) {
      const dx = wall.end_x - wall.start_x;
      const dy = wall.end_y - wall.start_y;
      const wallLength = Math.sqrt(dx * dx + dy * dy);
      
      if (wallLength < 100) continue;
      
      // Project point onto wall line
      const t = ((x - wall.start_x) * dx + (y - wall.start_y) * dy) / (wallLength * wallLength);
      
      // Only consider points along the wall (not at endpoints)
      if (t < 0.1 || t > 0.9) continue;
      
      const projX = wall.start_x + t * dx;
      const projY = wall.start_y + t * dy;
      
      // Distance from cursor to projected point
      const dist = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
      
      if (dist < minDist) {
        minDist = dist;
        bestWall = wall;
        bestPoint = { x: projX, y: projY, t };
      }
    }
    
    if (bestWall && bestPoint) {
      return {
        wallId: bestWall.wall_id,
        x: bestPoint.x,
        y: bestPoint.y,
        wall: bestWall
      };
    }
    
    return null;
  };

  // Save layout
  const handleSave = async () => {
    if (!layout) return;

    try {
      setSaving(true);
      const payload = {
        room_name: roomName,
        walls: layout.walls,
        modules: layout.modules,
        doors: layout.doors,
        windows: layout.windows,
        canvas_width: layout.canvas_width || 5000,
        canvas_height: layout.canvas_height || 4000,
        scale: scale
      };

      if (layout.layout_id) {
        await axios.put(
          `${API}/api/projects/${projectId}/spatial-layout/${layout.layout_id}`,
          payload,
          { withCredentials: true }
        );
      } else {
        const res = await axios.post(
          `${API}/api/projects/${projectId}/spatial-layout`,
          payload,
          { withCredentials: true }
        );
        setLayout(res.data);
      }

      toast.success('Layout saved');
      setHasChanges(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Generate BOQ
  const generateBOQ = async () => {
    if (!layout?.layout_id) {
      toast.error('Please save the layout first');
      return;
    }

    try {
      const res = await axios.post(
        `${API}/api/projects/${projectId}/spatial-layout/${layout.layout_id}/generate-boq`,
        {},
        { withCredentials: true }
      );
      toast.success(`Generated ${res.data.item_count} BOQ items`);
      setShowSummaryModal(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate BOQ');
    }
  };

  // Export as PNG
  const exportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    canvas.width = svg.clientWidth * 2;
    canvas.height = svg.clientHeight * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `${roomName}_layout.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Calculate layout summary
  const calculateSummary = () => {
    if (!layout) return null;

    const modules = layout.modules || [];
    const walls = layout.walls || [];

    const totalWallLength = walls.reduce((sum, w) => sum + w.length, 0);
    const cabinetModules = modules.filter(m =>
      moduleLibrary.module_types?.[m.module_type]?.category === 'cabinet'
    );
    const totalCabinetLength = cabinetModules.reduce((sum, m) => sum + m.width, 0);

    let totalArea = 0;
    let totalCost = 0;

    modules.forEach(m => {
      const w = m.width / 304.8;
      const h = m.height / 304.8;
      const d = m.depth / 304.8;
      const area = (w * h) + (d * h * 2) + (w * d * 2);
      totalArea += area;

      const finishRate = moduleLibrary.finish_types?.[m.finish_type]?.rate_per_sqft || 450;
      const shutterMult = moduleLibrary.shutter_types?.[m.shutter_type]?.multiplier || 1;
      totalCost += area * finishRate * shutterMult;
    });

    return {
      wallCount: walls.length,
      totalWallLength: Math.round(totalWallLength),
      moduleCount: modules.length,
      cabinetCount: cabinetModules.length,
      totalCabinetLength: Math.round(totalCabinetLength),
      totalAreaSqft: Math.round(totalArea * 100) / 100,
      totalCost: Math.round(totalCost)
    };
  };

  const summary = calculateSummary();

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Get modules on selected wall for elevation view (Item #7 fix)
  const getModulesOnWall = (wallId) => {
    if (!layout?.modules || !wallId) return [];
    return layout.modules.filter(m => m.wall_id === wallId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Grid className="h-5 w-5" />
                Composer
              </h1>
              <p className="text-sm text-slate-500">{project?.project_name} • {roomName}</p>
            </div>
          </div>

          {/* Live Pricing Summary */}
          {summary && (
            <div className="flex items-center gap-4 bg-slate-50 rounded-lg px-4 py-2">
              <div className="text-center">
                <p className="text-xs text-slate-500">Modules</p>
                <p className="font-semibold">{summary.moduleCount}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="text-center">
                <p className="text-xs text-slate-500">Area</p>
                <p className="font-semibold">{summary.totalAreaSqft} sqft</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="text-center">
                <p className="text-xs text-slate-500">Est. Cost</p>
                <p className="font-bold text-green-600">{formatCurrency(summary.totalCost)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Select value={roomName} onValueChange={setRoomName}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Kitchen">Kitchen</SelectItem>
                <SelectItem value="Living Room">Living Room</SelectItem>
                <SelectItem value="Bedroom">Bedroom</SelectItem>
                <SelectItem value="Wardrobe">Wardrobe</SelectItem>
                <SelectItem value="TV Unit">TV Unit</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => setShowSummaryModal(true)}>
              <Eye className="h-4 w-4 mr-1" />
              Summary
            </Button>
            <Button variant="outline" size="sm" onClick={exportPNG}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={generateBOQ}>
              <FileText className="h-4 w-4 mr-1" />
              Generate BOQ
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Toolbar */}
          <div className="w-12 bg-white border-r flex flex-col items-center py-2 gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'select' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => setTool('select')}
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Select (V)</TooltipContent>
            </Tooltip>

            {/* Wall tool with mode selector (Item #4) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'wall' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => {
                    setTool('wall');
                    setShowWallModePanel(true);
                  }}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Draw Wall (W)</TooltipContent>
            </Tooltip>

            {/* Door tool with library (Item #5) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'door' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => {
                    setTool('door');
                    setShowDoorLibrary(true);
                  }}
                >
                  <DoorOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Door (D)</TooltipContent>
            </Tooltip>

            {/* Window tool with library (Item #5) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'window' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => {
                    setTool('window');
                    setShowWindowLibrary(true);
                  }}
                >
                  <PanelTop className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Window (N)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'module' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => setTool('module')}
                >
                  <Package className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Module (M)</TooltipContent>
            </Tooltip>

            {/* Fill Floor Tool */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'fill' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-9 h-9 p-0 ${tool === 'fill' ? 'bg-blue-100' : ''}`}
                  onClick={() => {
                    if (tool === 'fill') {
                      // Toggle panel if already on fill tool
                      setShowFloorMaterialPanel(!showFloorMaterialPanel);
                    } else {
                      setTool('fill');
                      setShowFloorMaterialPanel(true);
                    }
                  }}
                  disabled={!layout?.walls || layout.walls.length < 3}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Fill Floor (F) - Click to toggle panel</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'split' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`w-9 h-9 p-0 ${tool === 'split' ? 'bg-slate-200' : ''}`}
                  onClick={() => setTool('split')}
                  disabled={!layout?.walls || layout.walls.length === 0}
                >
                  <Slice className="h-3.5 w-3.5 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Split Wall (S) - Click on wall to cut</TooltipContent>
            </Tooltip>

            <Separator className="my-2 w-6" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0" onClick={() => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                  const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                  zoomAtCursor(Math.min(scale * 1.2, 0.5), centerX, centerY);
                }}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom In (Ctrl +)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0" onClick={() => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                  const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                  zoomAtCursor(Math.max(scale / 1.2, 0.05), centerX, centerY);
                }}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom Out (Ctrl -)</TooltipContent>
            </Tooltip>

            {/* Reset Zoom (Item #2) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-xs font-medium" onClick={resetZoomToFit}>
                  <span className="text-[10px]">FIT</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Reset Zoom (Ctrl 0)</TooltipContent>
            </Tooltip>

            <Separator className="my-2 w-6" />

            {/* Undo/Redo (Item #6-add) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-9 h-9 p-0" 
                  onClick={handleUndo}
                  disabled={undoHistory.length === 0}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Undo (Ctrl Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-9 h-9 p-0" 
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Redo (Ctrl Y)</TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            {selectedItem && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 h-9 p-0 text-red-500" onClick={deleteSelected}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Delete (Del)</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Wall Drawing Options Panel (Item #4) */}
          {showWallModePanel && tool === 'wall' && (
            <div className="w-44 bg-white border-r p-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium">Draw Mode</h4>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowWallModePanel(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Coohom-style Ortho Toggle */}
              <button
                onClick={() => setOrthoMode(!orthoMode)}
                className={`w-full text-left p-2 rounded text-xs mb-2 transition-colors border ${
                  orthoMode 
                    ? 'bg-green-100 border-green-400 text-green-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{orthoMode ? '✓' : '○'}</span>
                    <span className="font-medium">Ortho Drawing</span>
                  </div>
                </div>
                <p className="text-[10px] mt-0.5 ml-6 opacity-70">
                  {orthoMode ? 'Snaps to 90° angles' : 'Click to enable'}
                </p>
              </button>
              
              <h5 className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Shape Mode</h5>
              <div className="space-y-1">
                {Object.entries(WALL_DRAW_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    onClick={() => setWallDrawMode(key)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      wallDrawMode === key ? 'bg-blue-100 border-blue-300 border' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <mode.icon className="h-4 w-4" />
                      <span className="font-medium">{mode.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 ml-6">{mode.desc}</p>
                  </button>
                ))}
              </div>
              
              {/* Arc Wall Options - shown when arc mode is selected */}
              {wallDrawMode === 'arc' && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <h5 className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Arc Input Method</h5>
                  
                  {/* Method Selection */}
                  <div className="space-y-1 mb-3">
                    <button
                      onClick={() => setArcInputMethod('radius')}
                      className={`w-full text-left p-2 rounded text-xs transition-colors ${
                        arcInputMethod === 'radius' ? 'bg-purple-100 border-purple-300 border' : 'hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-medium">Radius</span>
                    </button>
                    <button
                      onClick={() => setArcInputMethod('chordHeight')}
                      className={`w-full text-left p-2 rounded text-xs transition-colors ${
                        arcInputMethod === 'chordHeight' ? 'bg-purple-100 border-purple-300 border' : 'hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-medium">Chord Height (String Height)</span>
                    </button>
                  </div>
                  
                  {/* Input Field based on method */}
                  {arcInputMethod === 'radius' ? (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Radius (mm)</Label>
                      <Input
                        type="number"
                        value={arcRadiusInput}
                        onChange={(e) => setArcRadiusInput(e.target.value)}
                        className="h-8 text-xs"
                        min="100"
                        step="50"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Chord Height (mm)</Label>
                      <Input
                        type="number"
                        value={arcChordHeightInput}
                        onChange={(e) => setArcChordHeightInput(e.target.value)}
                        className="h-8 text-xs"
                        min="10"
                        step="10"
                      />
                    </div>
                  )}
                  
                  {/* Flip Arc Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs h-8"
                    onClick={() => setArcBulgeDirection(prev => prev * -1)}
                  >
                    <FlipHorizontal className="h-3 w-3 mr-1" />
                    Flip Arc Direction
                  </Button>
                  
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Mouse position determines arc bulge
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Door Library Panel (Item #5) */}
          {showDoorLibrary && tool === 'door' && (
            <div className="w-44 bg-white border-r p-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium">Door Types</h4>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowDoorLibrary(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {DOOR_TYPES.map((door) => (
                  <button
                    key={door.id}
                    onClick={() => setSelectedDoorType(door)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      selectedDoorType?.id === door.id ? 'bg-amber-100 border-amber-300 border' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{door.icon}</span>
                      <span className="font-medium">{door.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 ml-7">{door.width}×{door.height}mm</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Window Library Panel (Item #5) */}
          {showWindowLibrary && tool === 'window' && (
            <div className="w-44 bg-white border-r p-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium">Window Types</h4>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowWindowLibrary(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {WINDOW_TYPES.map((win) => (
                  <button
                    key={win.id}
                    onClick={() => setSelectedWindowType(win)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      selectedWindowType?.id === win.id ? 'bg-cyan-100 border-cyan-300 border' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{win.icon}</span>
                      <span className="font-medium">{win.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 ml-7">{win.width}×{win.height}mm</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Floor Material Panel - Toggle with icon */}
          {showFloorMaterialPanel && (tool === 'fill' || detectedFloor || manualFloorFill) && (
            <div className="w-48 bg-white border-r p-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium">Floor Material</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 w-5 p-0" 
                  onClick={() => setShowFloorMaterialPanel(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {Object.entries(FLOOR_MATERIALS).map(([key, mat]) => (
                  <button
                    key={key}
                    onClick={() => setFloorMaterial(key)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center gap-2 ${
                      floorMaterial === key ? 'bg-blue-100 border-blue-300 border' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div 
                      className="w-6 h-6 rounded border border-slate-300 shrink-0"
                      style={{ backgroundColor: mat.color }}
                    />
                    <span className="font-medium truncate">{mat.name}</span>
                  </button>
                ))}
              </div>
              {!detectedFloor && !manualFloorFill && (
                <p className="text-[10px] text-slate-500 mt-2 px-1">
                  Click inside a closed room to apply floor fill
                </p>
              )}
            </div>
          )}

          {/* Collapsible Module Library Panel */}
          <div className={`bg-white border-r shrink-0 flex flex-col transition-all duration-200 ${leftPanelCollapsed ? 'w-0 overflow-hidden' : 'w-52'}`}>
            <div className="p-2 border-b flex items-center justify-between">
              <h3 className="font-medium text-sm">Modules</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {moduleLibrary.module_types && Object.entries(moduleLibrary.module_types).map(([key, mod]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedModuleType(key);
                      setTool('module');
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors ${
                      selectedModuleType === key && tool === 'module'
                        ? 'bg-violet-100 border-violet-300 border'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: MODULE_COLORS[key] || '#888' }}
                      />
                      <span className="font-medium">{mod.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 ml-5">
                      {mod.default_width}×{mod.default_height}×{mod.default_depth}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Panel Toggle - Left */}
          <button
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            className="w-4 bg-slate-200 hover:bg-slate-300 flex items-center justify-center shrink-0"
          >
            {leftPanelCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>

          {/* Canvas Area - Coohom-style CAD background */}
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative"
            style={{ backgroundColor: '#EFF1F2' }}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={(e) => {
                // Mouse wheel zoom centered on cursor (Item #2)
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.max(0.05, Math.min(0.5, scale * delta));
                zoomAtCursor(newScale, e.clientX, e.clientY);
              }}
              style={{ 
                cursor: isPanning ? 'grabbing' : 
                        spacePressed ? 'grab' : 
                        tool === 'wall' ? 'crosshair' : 
                        tool === 'module' ? 'copy' : 
                        tool === 'door' || tool === 'window' ? 'crosshair' : 
                        tool === 'fill' ? 'cell' :
                        tool === 'split' ? 'crosshair' :
                        isDragging ? 'grabbing' : 'default' 
              }}
            >
              {/* Grid - Subtle grid lines lighter than walls */}
              <defs>
                <pattern 
                  id="smallGrid" 
                  width={100 * scale} 
                  height={100 * scale} 
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${panOffset.x}, ${panOffset.y})`}
                >
                  {/* Subtle grid - lighter than walls */}
                  <path d={`M ${100 * scale} 0 L 0 0 0 ${100 * scale}`} fill="none" stroke="#D8DBDE" strokeWidth="0.5" strokeOpacity="0.6" />
                </pattern>
                <pattern 
                  id="grid" 
                  width={500 * scale} 
                  height={500 * scale} 
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${panOffset.x}, ${panOffset.y})`}
                >
                  <rect width={500 * scale} height={500 * scale} fill="url(#smallGrid)" />
                  {/* Major grid lines */}
                  <path d={`M ${500 * scale} 0 L 0 0 0 ${500 * scale}`} fill="none" stroke="#C8CBCE" strokeWidth="0.75" strokeOpacity="0.6" />
                </pattern>
                
                {/* Floor material patterns */}
                <pattern id="floorTiles" width={60 * scale} height={60 * scale} patternUnits="userSpaceOnUse">
                  <rect width={60 * scale} height={60 * scale} fill={FLOOR_MATERIALS[floorMaterial]?.color || '#E8EAEB'} />
                  <line x1="0" y1="0" x2={60 * scale} y2="0" stroke="#00000015" strokeWidth="1" />
                  <line x1="0" y1="0" x2="0" y2={60 * scale} stroke="#00000015" strokeWidth="1" />
                </pattern>
                
                <pattern id="floorWood" width={120 * scale} height={20 * scale} patternUnits="userSpaceOnUse">
                  <rect width={120 * scale} height={20 * scale} fill={FLOOR_MATERIALS[floorMaterial]?.color || '#DEB887'} />
                  <line x1="0" y1={20 * scale} x2={120 * scale} y2={20 * scale} stroke="#00000020" strokeWidth="0.5" />
                  <line x1={60 * scale} y1="0" x2={60 * scale} y2={20 * scale} stroke="#00000015" strokeWidth="0.5" />
                </pattern>
                
                <pattern id="floorMarble" width={80 * scale} height={80 * scale} patternUnits="userSpaceOnUse">
                  <rect width={80 * scale} height={80 * scale} fill={FLOOR_MATERIALS[floorMaterial]?.color || '#FAFAFA'} />
                  <path d={`M 0 ${40 * scale} Q ${40 * scale} ${20 * scale} ${80 * scale} ${40 * scale}`} stroke="#00000008" strokeWidth="2" fill="none" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
                {/* Floor polygon - Auto-detected from closed room with material */}
                {detectedFloor && detectedFloor.length >= 3 && (() => {
                  const material = FLOOR_MATERIALS[floorMaterial];
                  const patternId = material?.pattern === 'tiles' ? 'url(#floorTiles)' :
                                   material?.pattern === 'wood' ? 'url(#floorWood)' :
                                   material?.pattern === 'marble' ? 'url(#floorMarble)' :
                                   material?.color || '#E8EAEB';
                  const fillValue = material?.pattern === 'solid' ? material.color : patternId;
                  
                  return (
                    <polygon
                      points={detectedFloor.map(p => `${p.x * scale},${p.y * scale}`).join(' ')}
                      fill={fillValue}
                      fillOpacity="0.95"
                      stroke="#A0A4A8"
                      strokeWidth="0.5"
                    />
                  );
                })()}
                
                {/* Manual floor fill (backup when auto-detection fails) */}
                {!detectedFloor && manualFloorFill && manualFloorFill.length >= 3 && (() => {
                  const material = FLOOR_MATERIALS[floorMaterial];
                  const patternId = material?.pattern === 'tiles' ? 'url(#floorTiles)' :
                                   material?.pattern === 'wood' ? 'url(#floorWood)' :
                                   material?.pattern === 'marble' ? 'url(#floorMarble)' :
                                   material?.color || '#E8EAEB';
                  const fillValue = material?.pattern === 'solid' ? material.color : patternId;
                  
                  return (
                    <polygon
                      points={manualFloorFill.map(p => `${p.x * scale},${p.y * scale}`).join(' ')}
                      fill={fillValue}
                      fillOpacity="0.95"
                      stroke="#A0A4A8"
                      strokeWidth="0.5"
                    />
                  );
                })()}

                {/* ============================================
                   T-JUNCTION UNIFIED GEOMETRY RENDERING
                   Computes boolean union of through-wall and stem-wall polygons
                   to create seamless merged geometry (like Coohom)
                   Handles both vertex T-junctions (3 walls at point) and
                   mid-span T-junctions (wall endpoint on another wall's middle)
                   ============================================ */}
                {unifiedBoundary?.tJunctions?.map((tj, tjIndex) => {
                  const { x: jx, y: jy, stemWall, throughThickness, isMidSpan } = tj;
                  if (!stemWall) return null;
                  
                  // For mid-span T-junctions, throughWall is single; for vertex T-junctions, throughWalls is array
                  const throughWall = tj.throughWall || (tj.throughWalls && tj.throughWalls[0]);
                  if (!throughWall && !tj.throughWalls) return null;
                  
                  const stemThickness = stemWall.thickness || DEFAULT_WALL_THICKNESS;
                  const effectiveThroughThickness = throughThickness || DEFAULT_WALL_THICKNESS;
                  const halfThroughThickness = effectiveThroughThickness / 2;
                  const halfStemThickness = stemThickness / 2;
                  
                  // Use pre-calculated directions if available, otherwise calculate
                  let stemDirX = tj.stemDirX;
                  let stemDirY = tj.stemDirY;
                  let throughDirX = tj.throughDirX;
                  let throughDirY = tj.throughDirY;
                  
                  if (stemDirX === undefined || stemDirY === undefined) {
                    // Calculate stem direction
                    const stemAtJunctionIsStart = 
                      Math.abs(stemWall.start_x - jx) < 50 && Math.abs(stemWall.start_y - jy) < 50;
                    const stemOtherX = stemAtJunctionIsStart ? stemWall.end_x : stemWall.start_x;
                    const stemOtherY = stemAtJunctionIsStart ? stemWall.end_y : stemWall.start_y;
                    const stemDx = stemOtherX - jx;
                    const stemDy = stemOtherY - jy;
                    const stemLen = Math.sqrt(stemDx * stemDx + stemDy * stemDy);
                    if (stemLen < 10) return null;
                    stemDirX = stemDx / stemLen;
                    stemDirY = stemDy / stemLen;
                  }
                  
                  if (throughDirX === undefined || throughDirY === undefined) {
                    // Calculate through wall direction
                    const tw = throughWall || tj.throughWalls[0];
                    const twDx = tw.end_x - tw.start_x;
                    const twDy = tw.end_y - tw.start_y;
                    const twLen = Math.sqrt(twDx * twDx + twDy * twDy);
                    throughDirX = twLen > 0 ? twDx / twLen : 1;
                    throughDirY = twLen > 0 ? twDy / twLen : 0;
                  }
                  
                  // Find the other end of the stem wall
                  const stemAtJunctionIsStart = 
                    Math.abs(stemWall.start_x - jx) < 50 && Math.abs(stemWall.start_y - jy) < 50;
                  const stemOtherX = stemAtJunctionIsStart ? stemWall.end_x : stemWall.start_x;
                  const stemOtherY = stemAtJunctionIsStart ? stemWall.end_y : stemWall.start_y;
                  
                  // Perpendicular to stem (for stem wall thickness)
                  const stemPerpX = -stemDirY;
                  const stemPerpY = stemDirX;
                  
                  // Through wall perpendicular (points toward one side)
                  const throughPerpX = -throughDirY;
                  const throughPerpY = throughDirX;
                  
                  // Determine which side of through-wall the stem is on
                  const stemSide = stemDirX * throughPerpX + stemDirY * throughPerpY;
                  const sideSign = stemSide > 0 ? 1 : -1;
                  
                  // Build the stem wall polygon that connects to through wall outer edge
                  const stemPolygon = [
                    // Point 1: Where stem left edge meets through-wall outer edge
                    { 
                      x: jx + throughPerpX * halfThroughThickness * sideSign + stemPerpX * halfStemThickness,
                      y: jy + throughPerpY * halfThroughThickness * sideSign + stemPerpY * halfStemThickness
                    },
                    // Point 2: Stem left edge at stem's far end
                    { 
                      x: stemOtherX + stemPerpX * halfStemThickness,
                      y: stemOtherY + stemPerpY * halfStemThickness
                    },
                    // Point 3: Stem right edge at stem's far end  
                    {
                      x: stemOtherX - stemPerpX * halfStemThickness,
                      y: stemOtherY - stemPerpY * halfStemThickness
                    },
                    // Point 4: Where stem right edge meets through-wall outer edge
                    {
                      x: jx + throughPerpX * halfThroughThickness * sideSign - stemPerpX * halfStemThickness,
                      y: jy + throughPerpY * halfThroughThickness * sideSign - stemPerpY * halfStemThickness
                    }
                  ];
                  
                  const stemPointsStr = stemPolygon.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
                  
                  const isSelected = selectedItem?.type === 'wall' && selectedItem.item.wall_id === stemWall.wall_id;
                  const fillColor = isSelected ? '#93c5fd' : '#B0B0B0';
                  
                  return (
                    <g key={`tjunction-stem-${tjIndex}`}>
                      {/* Stem wall fill - no stroke so it blends with through-wall */}
                      <polygon
                        points={stemPointsStr}
                        fill={fillColor}
                        stroke="none"
                      />
                      {/* Draw outer edge strokes (left edge, far end, right edge) */}
                      {/* Skip the junction edge (between points 0 and 3) */}
                      <line
                        x1={stemPolygon[0].x * scale} y1={stemPolygon[0].y * scale}
                        x2={stemPolygon[1].x * scale} y2={stemPolygon[1].y * scale}
                        stroke="#000000" strokeWidth="0.5"
                      />
                      <line
                        x1={stemPolygon[1].x * scale} y1={stemPolygon[1].y * scale}
                        x2={stemPolygon[2].x * scale} y2={stemPolygon[2].y * scale}
                        stroke="#000000" strokeWidth="0.5"
                      />
                      <line
                        x1={stemPolygon[2].x * scale} y1={stemPolygon[2].y * scale}
                        x2={stemPolygon[3].x * scale} y2={stemPolygon[3].y * scale}
                        stroke="#000000" strokeWidth="0.5"
                      />
                      {/* Junction edge (points 3 to 0) - no stroke, blends with through-wall */}
                    </g>
                  );
                })}

                {/* ============================================
                    UNIFIED WALL BOUNDARY RENDERING ENGINE
                    Renders closed wall loops as unified polygons
                    with proper miter joins at all corners
                   ============================================ */}
                {unifiedBoundary && unifiedBoundary.loops && unifiedBoundary.loops.map((boundary, loopIndex) => {
                  const { outer, inner, wallIds } = boundary;
                  
                  const isAnyWallSelected = wallIds.some(wid => 
                    selectedItem?.type === 'wall' && selectedItem.item.wall_id === wid
                  );
                  
                  // Create SVG path: outer boundary clockwise, inner counter-clockwise
                  const outerPath = outer.map((p, i) => 
                    `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`
                  ).join(' ') + ' Z';
                  
                  // Reverse inner path for proper hole (counter-clockwise)
                  const innerReversed = [...inner].reverse();
                  const innerPathReversed = innerReversed.map((p, i) => 
                    `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`
                  ).join(' ') + ' Z';
                  
                  // Get walls in this loop for dimension labels
                  const loopWalls = layout?.walls?.filter(w => wallIds.includes(w.wall_id)) || [];
                  
                  return (
                    <g key={`unified-loop-${loopIndex}`}>
                      {/* Unified wall fill */}
                      <path
                        d={outerPath + ' ' + innerPathReversed}
                        fill={isAnyWallSelected ? '#93c5fd' : '#B0B0B0'}
                        fillRule="evenodd"
                        style={{ cursor: 'move' }}
                      />
                      {/* Outer edge stroke - clean polygon */}
                      <polygon
                        points={outer.map(p => `${p.x * scale},${p.y * scale}`).join(' ')}
                        fill="none"
                        stroke="#000000"
                        strokeWidth="0.5"
                        strokeLinejoin="miter"
                      />
                      {/* Inner edge stroke - clean polygon */}
                      <polygon
                        points={inner.map(p => `${p.x * scale},${p.y * scale}`).join(' ')}
                        fill="none"
                        stroke="#000000"
                        strokeWidth="0.5"
                        strokeLinejoin="miter"
                      />
                      {/* Dimension labels for walls in this loop */}
                      {loopWalls.map(wall => {
                        const midX = (wall.start_x + wall.end_x) / 2;
                        const midY = (wall.start_y + wall.end_y) / 2;
                        const dx = wall.end_x - wall.start_x;
                        const dy = wall.end_y - wall.start_y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        
                        // Perpendicular offset for label placement (outside wall)
                        const perpX = len > 0 ? -dy / len : 0;
                        const perpY = len > 0 ? dx / len : 0;
                        const labelOffset = (wall.thickness || DEFAULT_WALL_THICKNESS) / 2 + 15;
                        
                        return (
                          <text
                            key={`dim-${wall.wall_id}`}
                            x={(midX + perpX * labelOffset) * scale}
                            y={(midY + perpY * labelOffset) * scale}
                            fontSize="10"
                            fill="#4A5568"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontWeight="500"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              startDimensionEdit(wall.wall_id, wall.length);
                            }}
                          >
                            {wall.length}mm
                          </text>
                        );
                      })}
                    </g>
                  );
                })}

                {/* ============================================
                    OPEN WALL CHAIN RENDERING
                    Renders connected walls with proper miter joins
                    WITH NOTCHES at T-junction points for proper merging
                   ============================================ */}
                {unifiedBoundary && unifiedBoundary.chains && unifiedBoundary.chains.map((chain, chainIndex) => {
                  const { outline, wallIds, centerline } = chain;
                  
                  if (!outline || outline.length < 3) return null;
                  
                  // Check if this chain consists only of stem walls from T-junctions
                  // If so, skip rendering here as T-junction render handles it
                  const tJunctionStemWallIds = (unifiedBoundary.tJunctions || []).map(tj => tj.stemWall?.wall_id).filter(Boolean);
                  const isOnlyStemWalls = wallIds.every(wid => tJunctionStemWallIds.includes(wid));
                  if (isOnlyStemWalls) {
                    console.log(`[Chain ${chainIndex}] Skipping - only contains stem walls:`, wallIds);
                    return null;
                  }
                  
                  // Find T-junctions that affect this chain (where this chain is the "through" wall)
                  // For mid-span T-junctions, throughWall is singular; for vertex T-junctions, throughWallIds is array
                  const affectingTJunctions = (unifiedBoundary.tJunctions || []).filter(tj => {
                    // Check both throughWallIds (array) and throughWall (singular)
                    const throughIds = tj.throughWallIds || (tj.throughWall ? [tj.throughWall.wall_id] : []);
                    return throughIds.some(twid => wallIds.includes(twid));
                  });
                  
                  if (affectingTJunctions.length > 0) {
                    console.log(`[Chain ${chainIndex}] Has ${affectingTJunctions.length} affecting T-junctions`);
                  }
                  
                  // If this chain has T-junctions, we need to modify the outline to add notches
                  let modifiedOutline = outline;
                  
                  if (affectingTJunctions.length > 0) {
                    // Build a new outline with notches at T-junction points
                    const halfN = Math.floor(outline.length / 2);
                    const leftSide = outline.slice(0, halfN);
                    const rightSide = outline.slice(halfN).reverse(); // Right side is reversed in original
                    
                    // For each T-junction, find where it intersects each side and insert notch points
                    const insertNotchPoints = (side, isLeftSide) => {
                      const newSide = [];
                      
                      for (let i = 0; i < side.length; i++) {
                        const pt = side[i];
                        newSide.push(pt);
                        
                        // Check if any T-junction point is between this point and the next
                        if (i < side.length - 1) {
                          const nextPt = side[i + 1];
                          
                          for (const tj of affectingTJunctions) {
                            const halfStemThickness = (tj.stemThickness || DEFAULT_WALL_THICKNESS) / 2;
                            const halfThroughThickness = (tj.throughThickness || DEFAULT_WALL_THICKNESS) / 2;
                            
                            // Calculate the stem perpendicular direction
                            const stemPerpX = -(tj.stemDirY || 0);
                            const stemPerpY = tj.stemDirX || 0;
                            
                            // Through wall perpendicular
                            const throughPerpX = -(tj.throughDirY || 0);
                            const throughPerpY = tj.throughDirX || 0;
                            
                            // Determine which side the stem is on
                            const stemSide = (tj.stemDirX || 0) * throughPerpX + (tj.stemDirY || 0) * throughPerpY;
                            const sideSign = stemSide > 0 ? 1 : -1;
                            
                            // Check if this edge segment contains the T-junction
                            // Project junction point onto edge segment
                            const edgeX = nextPt.x - pt.x;
                            const edgeY = nextPt.y - pt.y;
                            const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
                            
                            if (edgeLen < 1) continue;
                            
                            // The junction outer edge point on this side
                            const junctionEdgeX = tj.x + throughPerpX * halfThroughThickness * (isLeftSide ? 1 : -1);
                            const junctionEdgeY = tj.y + throughPerpY * halfThroughThickness * (isLeftSide ? 1 : -1);
                            
                            // Check if junction point is near this edge
                            const toJuncX = junctionEdgeX - pt.x;
                            const toJuncY = junctionEdgeY - pt.y;
                            const t = (toJuncX * edgeX + toJuncY * edgeY) / (edgeLen * edgeLen);
                            
                            if (t > 0.05 && t < 0.95) {
                              // Check if this is the correct side for the notch
                              // Notch should be on the side where stem connects
                              const isCorrectSide = (isLeftSide && sideSign > 0) || (!isLeftSide && sideSign < 0);
                              
                              if (isCorrectSide) {
                                console.log(`[Notch] Creating notch at T-junction (${tj.x?.toFixed(0)}, ${tj.y?.toFixed(0)}) on ${isLeftSide ? 'left' : 'right'} side`);
                                
                                // The notch is a rectangular indent into the through-wall polygon
                                // We need 4 points to create the notch:
                                // 1. Entry point on edge (left of stem)
                                // 2. Inner corner (left of stem, at stem start)
                                // 3. Inner corner (right of stem, at stem start)  
                                // 4. Exit point on edge (right of stem)
                                
                                // Along-edge direction (normalized)
                                const edgeDirX = edgeX / edgeLen;
                                const edgeDirY = edgeY / edgeLen;
                                
                                // Entry point on through-wall edge (left side of stem opening)
                                const notchEntry = {
                                  x: junctionEdgeX - stemPerpX * halfStemThickness,
                                  y: junctionEdgeY - stemPerpY * halfStemThickness
                                };
                                
                                // Exit point on through-wall edge (right side of stem opening)
                                const notchExit = {
                                  x: junctionEdgeX + stemPerpX * halfStemThickness,
                                  y: junctionEdgeY + stemPerpY * halfStemThickness
                                };
                                
                                // Order based on edge direction
                                const dotEntry = (notchEntry.x - pt.x) * edgeX + (notchEntry.y - pt.y) * edgeY;
                                const dotExit = (notchExit.x - pt.x) * edgeX + (notchExit.y - pt.y) * edgeY;
                                
                                if (dotEntry < dotExit) {
                                  newSide.push(notchEntry);
                                  newSide.push(notchExit);
                                } else {
                                  newSide.push(notchExit);
                                  newSide.push(notchEntry);
                                }
                              }
                            }
                          }
                        }
                      }
                      
                      return newSide;
                    };
                    
                    const modifiedLeft = insertNotchPoints(leftSide, true);
                    const modifiedRight = insertNotchPoints(rightSide, false);
                    
                    // Reconstruct the outline
                    modifiedOutline = [...modifiedLeft, ...modifiedRight.reverse()];
                  }
                  
                  const isAnyWallSelected = wallIds.some(wid => 
                    selectedItem?.type === 'wall' && selectedItem.item.wall_id === wid
                  );
                  
                  // Get walls in this chain for dimension labels
                  const chainWalls = layout?.walls?.filter(w => wallIds.includes(w.wall_id)) || [];
                  
                  const pointsStr = modifiedOutline.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
                  
                  // Build edge stroke paths, skipping edges at T-junction points
                  const edgeStrokes = [];
                  for (let i = 0; i < modifiedOutline.length; i++) {
                    const p1 = modifiedOutline[i];
                    const p2 = modifiedOutline[(i + 1) % modifiedOutline.length];
                    
                    // Check if this edge is at a T-junction (should not be stroked)
                    let skipEdge = false;
                    for (const tj of affectingTJunctions) {
                      const halfStemThickness = (tj.stemThickness || DEFAULT_WALL_THICKNESS) / 2;
                      const halfThroughThickness = (tj.throughThickness || DEFAULT_WALL_THICKNESS) / 2;
                      
                      // Calculate junction edge points on through-wall
                      const throughPerpX = -(tj.throughDirY || 0);
                      const throughPerpY = tj.throughDirX || 0;
                      const stemPerpX = -(tj.stemDirY || 0);
                      const stemPerpY = tj.stemDirX || 0;
                      
                      // Determine which side stem is on
                      const stemSide = (tj.stemDirX || 0) * throughPerpX + (tj.stemDirY || 0) * throughPerpY;
                      const sideSign = stemSide > 0 ? 1 : -1;
                      
                      // Junction edge on through-wall outer boundary
                      const jEdgeX = tj.x + throughPerpX * halfThroughThickness * sideSign;
                      const jEdgeY = tj.y + throughPerpY * halfThroughThickness * sideSign;
                      
                      // Check if either endpoint of this edge is near the junction edge
                      const edgeMidX = (p1.x + p2.x) / 2;
                      const edgeMidY = (p1.y + p2.y) / 2;
                      
                      // Calculate distance from edge midpoint to junction point
                      const distToJunction = Math.sqrt(
                        (edgeMidX - jEdgeX) * (edgeMidX - jEdgeX) + 
                        (edgeMidY - jEdgeY) * (edgeMidY - jEdgeY)
                      );
                      
                      // Calculate edge length
                      const edgeLen = Math.sqrt(
                        (p2.x - p1.x) * (p2.x - p1.x) + 
                        (p2.y - p1.y) * (p2.y - p1.y)
                      );
                      
                      // If edge is short and near junction, it's the junction edge - skip it
                      if (distToJunction < halfStemThickness * 2 && edgeLen < halfStemThickness * 3) {
                        skipEdge = true;
                        break;
                      }
                    }
                    
                    if (!skipEdge) {
                      edgeStrokes.push({
                        x1: p1.x * scale, y1: p1.y * scale,
                        x2: p2.x * scale, y2: p2.y * scale
                      });
                    }
                  }
                  
                  return (
                    <g key={`chain-${chainIndex}`}>
                      {/* Chain fill - no stroke to avoid seam lines at junctions */}
                      <polygon
                        points={pointsStr}
                        fill={isAnyWallSelected ? '#93c5fd' : '#B0B0B0'}
                        stroke="none"
                        style={{ cursor: 'move' }}
                      />
                      {/* Draw outer edge strokes, skipping T-junction edges */}
                      {edgeStrokes.map((edge, idx) => (
                        <line
                          key={`chain-edge-${chainIndex}-${idx}`}
                          x1={edge.x1} y1={edge.y1}
                          x2={edge.x2} y2={edge.y2}
                          stroke="#000000"
                          strokeWidth="0.5"
                        />
                      ))}
                      {/* Dimension labels for walls in this chain */}
                      {chainWalls.map(wall => {
                        const midX = (wall.start_x + wall.end_x) / 2;
                        const midY = (wall.start_y + wall.end_y) / 2;
                        const dx = wall.end_x - wall.start_x;
                        const dy = wall.end_y - wall.start_y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        
                        const perpX = len > 0 ? -dy / len : 0;
                        const perpY = len > 0 ? dx / len : 0;
                        const labelOffset = (wall.thickness || DEFAULT_WALL_THICKNESS) / 2 + 15;
                        
                        return (
                          <text
                            key={`dim-chain-${wall.wall_id}`}
                            x={(midX + perpX * labelOffset) * scale}
                            y={(midY + perpY * labelOffset) * scale}
                            fontSize="10"
                            fill="#4A5568"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontWeight="500"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              startDimensionEdit(wall.wall_id, wall.length);
                            }}
                          >
                            {wall.length}mm
                          </text>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Individual Walls - Only render walls NOT part of any unified boundary */}
                {layout?.walls?.map(wall => {
                  // Skip if this wall is part of a unified boundary
                  if (unifiedBoundary?.allWallIds?.includes(wall.wall_id)) {
                    return null;
                  }
                  
                  // Skip if this wall is a stem wall in a T-junction (handled separately)
                  const tJunctionStemWallIds = (unifiedBoundary?.tJunctions || []).map(tj => tj.stemWall?.wall_id).filter(Boolean);
                  if (tJunctionStemWallIds.includes(wall.wall_id)) {
                    return null;
                  }
                  
                  const isSelected = selectedItem?.type === 'wall' && selectedItem.item.wall_id === wall.wall_id;
                  const thickness = wall.thickness || DEFAULT_WALL_THICKNESS;
                  
                  // ARC WALL RENDERING
                  if (wall.is_arc) {
                    const arcParams = {
                      startX: wall.start_x,
                      startY: wall.start_y,
                      endX: wall.end_x,
                      endY: wall.end_y,
                      radius: wall.arc_radius,
                      centerX: wall.arc_center_x,
                      centerY: wall.arc_center_y,
                      startAngle: wall.arc_start_angle,
                      endAngle: wall.arc_end_angle,
                      sweepFlag: wall.arc_sweep_flag,
                      largeArcFlag: wall.arc_large_arc_flag,
                      bulgeDirection: wall.arc_bulge_direction
                    };
                    
                    const boundaries = calculateArcWallBoundaries(arcParams, thickness);
                    const { inner, outer, sweepFlag, largeArcFlag } = boundaries;
                    
                    // Create scaled path for arc wall
                    const arcPath = [
                      `M ${outer.startX * scale} ${outer.startY * scale}`,
                      `A ${outer.radius * scale} ${outer.radius * scale} 0 ${largeArcFlag} ${sweepFlag} ${outer.endX * scale} ${outer.endY * scale}`,
                      `L ${inner.endX * scale} ${inner.endY * scale}`,
                      `A ${inner.radius * scale} ${inner.radius * scale} 0 ${largeArcFlag} ${1 - sweepFlag} ${inner.startX * scale} ${inner.startY * scale}`,
                      `Z`
                    ].join(' ');
                    
                    // Outer and inner arc edges for stroke
                    const outerArcEdge = `M ${outer.startX * scale} ${outer.startY * scale} A ${outer.radius * scale} ${outer.radius * scale} 0 ${largeArcFlag} ${sweepFlag} ${outer.endX * scale} ${outer.endY * scale}`;
                    const innerArcEdge = `M ${inner.startX * scale} ${inner.startY * scale} A ${inner.radius * scale} ${inner.radius * scale} 0 ${largeArcFlag} ${sweepFlag} ${inner.endX * scale} ${inner.endY * scale}`;
                    
                    return (
                      <g key={wall.wall_id} style={{ cursor: 'move' }}>
                        {/* Arc wall fill */}
                        <path
                          d={arcPath}
                          fill={isSelected ? '#93c5fd' : '#B0B0B0'}
                        />
                        {/* Outer arc edge */}
                        <path d={outerArcEdge} stroke="#000000" strokeWidth="0.5" fill="none" />
                        {/* Inner arc edge */}
                        <path d={innerArcEdge} stroke="#000000" strokeWidth="0.5" fill="none" />
                        {/* End caps */}
                        <line 
                          x1={outer.startX * scale} y1={outer.startY * scale}
                          x2={inner.startX * scale} y2={inner.startY * scale}
                          stroke="#000000" strokeWidth="0.5"
                        />
                        <line 
                          x1={outer.endX * scale} y1={outer.endY * scale}
                          x2={inner.endX * scale} y2={inner.endY * scale}
                          stroke="#000000" strokeWidth="0.5"
                        />
                        {/* Arc dimensions label */}
                        <text
                          x={wall.arc_center_x * scale}
                          y={wall.arc_center_y * scale - 15}
                          fontSize="10"
                          fill={isSelected ? '#2563eb' : '#4A5568'}
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          R{Math.round(wall.arc_radius)}mm | {wall.length}mm
                        </text>
                        {/* Endpoint handles for arc wall */}
                        {isSelected && (
                          <>
                            <circle
                              cx={wall.start_x * scale}
                              cy={wall.start_y * scale}
                              r={ENDPOINT_HANDLE_SIZE}
                              fill="#3b82f6"
                              stroke="#1d4ed8"
                              strokeWidth="2"
                              style={{ cursor: 'crosshair' }}
                            />
                            <circle
                              cx={wall.end_x * scale}
                              cy={wall.end_y * scale}
                              r={ENDPOINT_HANDLE_SIZE}
                              fill="#3b82f6"
                              stroke="#1d4ed8"
                              strokeWidth="2"
                              style={{ cursor: 'crosshair' }}
                            />
                            {/* Center point indicator */}
                            <circle
                              cx={wall.arc_center_x * scale}
                              cy={wall.arc_center_y * scale}
                              r={6}
                              fill="none"
                              stroke="#9333ea"
                              strokeWidth="1.5"
                              strokeDasharray="3,3"
                            />
                          </>
                        )}
                      </g>
                    );
                  }
                  
                  // STRAIGHT WALL RENDERING
                  // Calculate wall rectangle corners for proper rendering
                  const dx = wall.end_x - wall.start_x;
                  const dy = wall.end_y - wall.start_y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const halfThickness = thickness / 2;
                  
                  // Perpendicular unit vector for wall thickness
                  const perpX = length > 0 ? (-dy / length) * halfThickness : 0;
                  const perpY = length > 0 ? (dx / length) * halfThickness : 0;
                  
                  // Four corners of the wall rectangle
                  const corners = [
                    { x: (wall.start_x + perpX) * scale, y: (wall.start_y + perpY) * scale },
                    { x: (wall.end_x + perpX) * scale, y: (wall.end_y + perpY) * scale },
                    { x: (wall.end_x - perpX) * scale, y: (wall.end_y - perpY) * scale },
                    { x: (wall.start_x - perpX) * scale, y: (wall.start_y - perpY) * scale }
                  ];
                  const pointsStr = corners.map(c => `${c.x},${c.y}`).join(' ');
                  
                  // Edge lines as separate paths for clean rendering
                  const edge1 = `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y}`;
                  const edge2 = `M ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y}`;
                  
                  return (
                    <g key={wall.wall_id} style={{ cursor: 'move' }}>
                      {/* Wall fill - no stroke */}
                      <polygon
                        points={pointsStr}
                        fill={isSelected ? '#93c5fd' : '#B0B0B0'}
                      />
                      {/* Edge lines - drawn separately for clean corners */}
                      <path d={edge1} stroke="#000000" strokeWidth="0.5" fill="none" />
                      <path d={edge2} stroke="#000000" strokeWidth="0.5" fill="none" />
                      {/* End caps */}
                      <line 
                        x1={corners[0].x} y1={corners[0].y} 
                        x2={corners[3].x} y2={corners[3].y}
                        stroke="#000000" strokeWidth="0.5"
                      />
                      <line 
                        x1={corners[1].x} y1={corners[1].y} 
                        x2={corners[2].x} y2={corners[2].y}
                        stroke="#000000" strokeWidth="0.5"
                      />
                      {/* Inline dimension label - clickable (Item #6) */}
                      {editingDimension === wall.wall_id ? (
                        <foreignObject
                          x={(wall.start_x + wall.end_x) / 2 * scale - 35}
                          y={(wall.start_y + wall.end_y) / 2 * scale - 25}
                          width="70"
                          height="24"
                        >
                          <input
                            ref={dimensionInputRef}
                            type="number"
                            value={dimensionInputValue}
                            onChange={(e) => setDimensionInputValue(e.target.value)}
                            onBlur={applyDimensionEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') applyDimensionEdit();
                              if (e.key === 'Escape') setEditingDimension(null);
                            }}
                            className="w-full h-full text-center text-xs border rounded bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            style={{ fontSize: '11px' }}
                          />
                        </foreignObject>
                      ) : (
                        <text
                          x={(wall.start_x + wall.end_x) / 2 * scale}
                          y={(wall.start_y + wall.end_y) / 2 * scale - 12}
                          fontSize="10"
                          fill={isSelected ? '#2563eb' : '#4A5568'}
                          textAnchor="middle"
                          fontWeight="500"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startDimensionEdit(wall.wall_id, wall.length);
                          }}
                        >
                          {wall.length}mm
                        </text>
                      )}
                      {/* Endpoint handles for length extension (Item #3 - Wall Edge Drag) */}
                      {isSelected && (
                        <>
                          {/* Start endpoint handle */}
                          <g style={{ cursor: 'nwse-resize' }}>
                            <circle
                              cx={wall.start_x * scale}
                              cy={wall.start_y * scale}
                              r={ENDPOINT_HANDLE_SIZE}
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="3"
                            />
                            <circle
                              cx={wall.start_x * scale}
                              cy={wall.start_y * scale}
                              r={ENDPOINT_HANDLE_SIZE / 3}
                              fill="white"
                            />
                          </g>
                          {/* End endpoint handle */}
                          <g style={{ cursor: 'nwse-resize' }}>
                            <circle
                              cx={wall.end_x * scale}
                              cy={wall.end_y * scale}
                              r={ENDPOINT_HANDLE_SIZE}
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="3"
                            />
                            <circle
                              cx={wall.end_x * scale}
                              cy={wall.end_y * scale}
                              r={ENDPOINT_HANDLE_SIZE / 3}
                              fill="white"
                            />
                          </g>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Temp wall while drawing - Coohom-style thin outline preview */}
                {tempWall && (() => {
                  const dx = tempWall.end.x - tempWall.start.x;
                  const dy = tempWall.end.y - tempWall.start.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const halfThickness = DEFAULT_WALL_THICKNESS / 2;
                  const perpX = length > 0 ? (-dy / length) * halfThickness : 0;
                  const perpY = length > 0 ? (dx / length) * halfThickness : 0;
                  
                  const corners = [
                    { x: (tempWall.start.x + perpX) * scale, y: (tempWall.start.y + perpY) * scale },
                    { x: (tempWall.end.x + perpX) * scale, y: (tempWall.end.y + perpY) * scale },
                    { x: (tempWall.end.x - perpX) * scale, y: (tempWall.end.y - perpY) * scale },
                    { x: (tempWall.start.x - perpX) * scale, y: (tempWall.start.y - perpY) * scale }
                  ];
                  const pointsStr = corners.map(c => `${c.x},${c.y}`).join(' ');
                  const isSnapped = tempWall.snappedAngle !== null;
                  
                  return (
                    <g>
                      {/* Temp wall with thin outline */}
                      <polygon
                        points={pointsStr}
                        fill={isSnapped ? '#86efac' : '#93c5fd'}
                        fillOpacity="0.7"
                        stroke={isSnapped ? '#166534' : '#1e40af'}
                        strokeWidth="0.5"
                        strokeLinejoin="miter"
                        strokeDasharray="4,2"
                      />
                      {/* Angle indicator when snapped (Item #2) */}
                      {isSnapped && (
                        <text
                          x={(tempWall.start.x + tempWall.end.x) / 2 * scale}
                          y={(tempWall.start.y + tempWall.end.y) / 2 * scale - 28}
                          fontSize="10"
                          fill="#166534"
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {tempWall.snappedAngle === 0 || tempWall.snappedAngle === 180 || tempWall.snappedAngle === -180 ? 'Horizontal' : 'Vertical'}
                        </text>
                      )}
                      <text
                        x={(tempWall.start.x + tempWall.end.x) / 2 * scale}
                        y={(tempWall.start.y + tempWall.end.y) / 2 * scale - 15}
                        fontSize="12"
                        fill={isSnapped ? '#166534' : '#1e40af'}
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {tempWall.length}mm
                      </text>
                      {/* Click hint for click-release mode (Item #4) */}
                      {wallClickMode === 'waiting_end' && (
                        <text
                          x={tempWall.end.x * scale + 15}
                          y={tempWall.end.y * scale}
                          fontSize="10"
                          fill="#1e40af"
                          fontWeight="500"
                        >
                          Click to place
                        </text>
                      )}
                    </g>
                  );
                })()}

                {/* Temp rectangle/square while drawing - thin outline preview */}
                {tempRectWalls && (
                  <rect
                    x={Math.min(tempRectWalls.start.x, tempRectWalls.end.x) * scale}
                    y={Math.min(tempRectWalls.start.y, tempRectWalls.end.y) * scale}
                    width={Math.abs(tempRectWalls.end.x - tempRectWalls.start.x) * scale}
                    height={Math.abs(tempRectWalls.end.y - tempRectWalls.start.y) * scale}
                    fill="#93c5fd"
                    fillOpacity="0.3"
                    stroke="#1e40af"
                    strokeWidth="0.5"
                    strokeDasharray="4,2"
                  />
                )}

                {/* Temp ARC WALL while drawing - curved wall preview */}
                {tempArcWall && (() => {
                  const boundaries = calculateArcWallBoundaries(tempArcWall, DEFAULT_WALL_THICKNESS);
                  const { inner, outer, sweepFlag, largeArcFlag } = boundaries;
                  
                  // Create scaled path for temp arc wall
                  const arcPath = [
                    `M ${outer.startX * scale} ${outer.startY * scale}`,
                    `A ${outer.radius * scale} ${outer.radius * scale} 0 ${largeArcFlag} ${sweepFlag} ${outer.endX * scale} ${outer.endY * scale}`,
                    `L ${inner.endX * scale} ${inner.endY * scale}`,
                    `A ${inner.radius * scale} ${inner.radius * scale} 0 ${largeArcFlag} ${1 - sweepFlag} ${inner.startX * scale} ${inner.startY * scale}`,
                    `Z`
                  ].join(' ');
                  
                  // Center line arc for dimension display
                  const centerArc = `M ${tempArcWall.startX * scale} ${tempArcWall.startY * scale} A ${tempArcWall.radius * scale} ${tempArcWall.radius * scale} 0 ${largeArcFlag} ${sweepFlag} ${tempArcWall.endX * scale} ${tempArcWall.endY * scale}`;
                  
                  return (
                    <g>
                      {/* Arc wall fill with dashed outline */}
                      <path
                        d={arcPath}
                        fill="#c4b5fd"
                        fillOpacity="0.6"
                        stroke="#7c3aed"
                        strokeWidth="1"
                        strokeDasharray="6,3"
                      />
                      
                      {/* Center line of arc (for reference) */}
                      <path
                        d={centerArc}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="1"
                        strokeDasharray="4,2"
                      />
                      
                      {/* Center point marker */}
                      <circle
                        cx={tempArcWall.centerX * scale}
                        cy={tempArcWall.centerY * scale}
                        r={6}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="1.5"
                      />
                      <line
                        x1={tempArcWall.centerX * scale - 8}
                        y1={tempArcWall.centerY * scale}
                        x2={tempArcWall.centerX * scale + 8}
                        y2={tempArcWall.centerY * scale}
                        stroke="#7c3aed"
                        strokeWidth="1"
                      />
                      <line
                        x1={tempArcWall.centerX * scale}
                        y1={tempArcWall.centerY * scale - 8}
                        x2={tempArcWall.centerX * scale}
                        y2={tempArcWall.centerY * scale + 8}
                        stroke="#7c3aed"
                        strokeWidth="1"
                      />
                      
                      {/* Radius line from center to arc midpoint */}
                      {(() => {
                        const midAngle = (tempArcWall.startAngle + tempArcWall.endAngle) / 2;
                        const midX = tempArcWall.centerX + tempArcWall.radius * Math.cos(midAngle);
                        const midY = tempArcWall.centerY + tempArcWall.radius * Math.sin(midAngle);
                        return (
                          <line
                            x1={tempArcWall.centerX * scale}
                            y1={tempArcWall.centerY * scale}
                            x2={midX * scale}
                            y2={midY * scale}
                            stroke="#7c3aed"
                            strokeWidth="0.5"
                            strokeDasharray="3,2"
                          />
                        );
                      })()}
                      
                      {/* Arc dimensions */}
                      <rect
                        x={tempArcWall.centerX * scale - 50}
                        y={tempArcWall.centerY * scale + 12}
                        width="100"
                        height="38"
                        rx="4"
                        fill="rgba(124, 58, 237, 0.95)"
                      />
                      <text
                        x={tempArcWall.centerX * scale}
                        y={tempArcWall.centerY * scale + 26}
                        fontSize="10"
                        fill="white"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        R: {Math.round(tempArcWall.radius)}mm
                      </text>
                      <text
                        x={tempArcWall.centerX * scale}
                        y={tempArcWall.centerY * scale + 40}
                        fontSize="10"
                        fill="white"
                        textAnchor="middle"
                        fontWeight="500"
                      >
                        Arc: {Math.round(tempArcWall.arcLength)}mm
                      </text>
                      
                      {/* Start and end point markers */}
                      <circle
                        cx={tempArcWall.startX * scale}
                        cy={tempArcWall.startY * scale}
                        r={6}
                        fill="#7c3aed"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <circle
                        cx={tempArcWall.endX * scale}
                        cy={tempArcWall.endY * scale}
                        r={6}
                        fill="#7c3aed"
                        stroke="white"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })()}

                {/* Doors - with rotation support (Item #4) */}
                {layout?.doors?.map(door => {
                  const isSelected = selectedItem?.type === 'door' && selectedItem.item.door_id === door.door_id;
                  const rotation = door.rotation || 0;
                  const flipped = door.flipped || false;
                  const centerX = (door.x + door.width / 2) * scale;
                  const centerY = (door.y + door.depth / 2) * scale;
                  
                  return (
                    <g 
                      key={door.door_id} 
                      style={{ cursor: 'move' }}
                      transform={`rotate(${rotation}, ${centerX}, ${centerY}) ${flipped ? `scale(-1, 1) translate(${-2 * centerX}, 0)` : ''}`}
                    >
                      <rect
                        x={door.x * scale}
                        y={door.y * scale}
                        width={door.width * scale}
                        height={door.depth * scale}
                        fill={MODULE_COLORS.door}
                        fillOpacity="0.9"
                        stroke={isSelected ? '#1e40af' : MODULE_COLORS.door}
                        strokeWidth={isSelected ? 3 : 1}
                      />
                      {/* Door swing arc */}
                      <path
                        d={`M ${door.x * scale} ${(door.y + door.depth) * scale} A ${door.width * scale * 0.8} ${door.width * scale * 0.8} 0 0 1 ${(door.x + door.width * 0.8) * scale} ${(door.y + door.depth + door.width * 0.3) * scale}`}
                        fill="none"
                        stroke={MODULE_COLORS.door}
                        strokeWidth="1"
                        strokeDasharray="3,2"
                      />
                      <text
                        x={(door.x + door.width / 2) * scale}
                        y={(door.y + door.depth / 2) * scale}
                        fontSize="9"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="500"
                        transform={flipped ? `scale(-1, 1) translate(${-2 * (door.x + door.width / 2) * scale}, 0)` : ''}
                      >
                        {door.type_name || 'Door'}
                      </text>
                    </g>
                  );
                })}

                {/* Windows - with rotation support (Item #4) */}
                {layout?.windows?.map(win => {
                  const isSelected = selectedItem?.type === 'window' && selectedItem.item.window_id === win.window_id;
                  const rotation = win.rotation || 0;
                  const flipped = win.flipped || false;
                  const centerX = (win.x + win.width / 2) * scale;
                  const centerY = (win.y + win.depth / 2) * scale;
                  
                  return (
                    <g 
                      key={win.window_id} 
                      style={{ cursor: 'move' }}
                      transform={`rotate(${rotation}, ${centerX}, ${centerY}) ${flipped ? `scale(-1, 1) translate(${-2 * centerX}, 0)` : ''}`}
                    >
                      <rect
                        x={win.x * scale}
                        y={win.y * scale}
                        width={win.width * scale}
                        height={win.depth * scale}
                        fill={MODULE_COLORS.window}
                        fillOpacity="0.7"
                        stroke={isSelected ? '#1e40af' : MODULE_COLORS.window}
                        strokeWidth={isSelected ? 3 : 1}
                      />
                      {/* Window pane lines */}
                      <line
                        x1={(win.x + win.width / 2) * scale}
                        y1={win.y * scale}
                        x2={(win.x + win.width / 2) * scale}
                        y2={(win.y + win.depth) * scale}
                        stroke="white"
                        strokeWidth="1"
                      />
                      <text
                        x={(win.x + win.width / 2) * scale}
                        y={(win.y + win.depth / 2) * scale}
                        fontSize="8"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="500"
                        transform={flipped ? `scale(-1, 1) translate(${-2 * (win.x + win.width / 2) * scale}, 0)` : ''}
                      >
                        {win.type_name || 'Window'}
                      </text>
                    </g>
                  );
                })}

                {/* Modules */}
                {layout?.modules?.map(module => {
                  const isSelected = selectedItem?.type === 'module' && selectedItem.item.module_id === module.module_id;
                  const color = MODULE_COLORS[module.module_type] || '#888';
                  const modInfo = moduleLibrary.module_types?.[module.module_type] || {};
                  const isSnappedToWall = !!module.wall_id;

                  return (
                    <g
                      key={module.module_id}
                      transform={`translate(${module.x * scale}, ${module.y * scale}) rotate(${module.rotation})`}
                      style={{ cursor: 'grab' }}
                    >
                      {/* Snap glow effect when attached to wall */}
                      {isSnappedToWall && (
                        <rect
                          x="-2"
                          y="-2"
                          width={module.width * scale + 4}
                          height={module.depth * scale + 4}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2"
                          strokeOpacity="0.5"
                          rx="2"
                          ry="2"
                        />
                      )}
                      <rect
                        x="0"
                        y="0"
                        width={module.width * scale}
                        height={module.depth * scale}
                        fill={color}
                        fillOpacity="0.85"
                        stroke={isSelected ? '#1e40af' : color}
                        strokeWidth={isSelected ? 3 : 1.5}
                      />
                      {/* Wall snap indicator - enhanced */}
                      {isSnappedToWall && (
                        <g>
                          <circle
                            cx={module.width * scale / 2}
                            cy="4"
                            r="4"
                            fill="#22c55e"
                            stroke="white"
                            strokeWidth="1.5"
                          />
                          <line
                            x1="0"
                            y1="0"
                            x2={module.width * scale}
                            y2="0"
                            stroke="#22c55e"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </g>
                      )}
                      <text
                        x={module.width * scale / 2}
                        y={module.depth * scale / 2}
                        fontSize="9"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="600"
                      >
                        {modInfo.name?.substring(0, 3) || 'MOD'}
                      </text>
                      <text
                        x={module.width * scale / 2}
                        y={module.depth * scale + 10}
                        fontSize="8"
                        fill="#4A5568"
                        textAnchor="middle"
                        fontWeight="500"
                      >
                        {module.width}×{module.depth}
                      </text>
                    </g>
                  );
                })}

                {/* Guided lines for straight drawing - shows when approaching horizontal/vertical */}
                {alignmentGuides.map((guide, index) => (
                  <line
                    key={`guide-${index}`}
                    x1={guide.type === 'vertical' ? guide.x * scale : guide.x1 * scale}
                    y1={guide.type === 'horizontal' ? guide.y * scale : guide.y1 * scale}
                    x2={guide.type === 'vertical' ? guide.x * scale : guide.x2 * scale}
                    y2={guide.type === 'horizontal' ? guide.y * scale : guide.y2 * scale}
                    stroke={guide.isLocked ? '#22C55E' : '#F59E0B'}
                    strokeWidth={guide.isLocked ? 2 : 1}
                    strokeDasharray={guide.isLocked ? '0' : '8,4'}
                    strokeOpacity={guide.isLocked ? 1 : 0.7}
                  />
                ))}

                {/* CONNECTION SUGGESTIONS - Shows guidelines to potential endpoints while drawing */}
                {(wallClickMode === 'waiting_end' || isDrawing) && connectionSuggestions.map((suggestion, index) => (
                  <g key={`suggestion-${index}`}>
                    {/* Dotted line from cursor to suggested endpoint */}
                    <line
                      x1={tempWall?.end?.x * scale || tempRectWalls?.end?.x * scale || 0}
                      y1={tempWall?.end?.y * scale || tempRectWalls?.end?.y * scale || 0}
                      x2={suggestion.x * scale}
                      y2={suggestion.y * scale}
                      stroke={suggestion.canClose ? '#22C55E' : '#60A5FA'}
                      strokeWidth="1"
                      strokeDasharray="6,4"
                      strokeOpacity="0.6"
                    />
                    {/* Target endpoint marker */}
                    <circle
                      cx={suggestion.x * scale}
                      cy={suggestion.y * scale}
                      r={suggestion.canClose ? 10 : 7}
                      fill="none"
                      stroke={suggestion.canClose ? '#22C55E' : '#60A5FA'}
                      strokeWidth={suggestion.canClose ? 2 : 1.5}
                      strokeDasharray={suggestion.canClose ? '0' : '4,2'}
                    />
                    <circle
                      cx={suggestion.x * scale}
                      cy={suggestion.y * scale}
                      r={3}
                      fill={suggestion.canClose ? '#22C55E' : '#60A5FA'}
                    />
                    {/* Distance label */}
                    <text
                      x={suggestion.x * scale + 15}
                      y={suggestion.y * scale - 10}
                      fontSize="9"
                      fill={suggestion.canClose ? '#16A34A' : '#3B82F6'}
                      fontWeight="500"
                    >
                      {Math.round(suggestion.distance)}mm
                    </text>
                  </g>
                ))}

                {/* ============================================
                   PROJECTED INTERSECTION INDICATOR (HIGH Z-INDEX)
                   Shows where the wall being drawn will intersect existing walls
                   BEFORE the cursor reaches the intersection point
                   Rendered LAST for maximum visibility
                   ============================================ */}
                {(wallClickMode === 'waiting_end' || isDrawing) && projectedIntersections.length > 0 && tempWall && (
                  <g style={{ zIndex: 9999 }}>
                    {projectedIntersections.slice(0, 2).map((intersection, idx) => (
                      <g key={`proj-intersection-${idx}`}>
                        {/* Dashed projection line from cursor to intersection point */}
                        {idx === 0 && (
                          <line
                            x1={tempWall.end.x * scale}
                            y1={tempWall.end.y * scale}
                            x2={intersection.x * scale}
                            y2={intersection.y * scale}
                            stroke="#22C55E"
                            strokeWidth="1.5"
                            strokeDasharray="8,4"
                            strokeOpacity="0.6"
                          />
                        )}
                        
                        {/* Extended alignment guides at intersection */}
                        {/* Horizontal guide */}
                        <line
                          x1={-10000}
                          y1={intersection.y * scale}
                          x2={10000}
                          y2={intersection.y * scale}
                          stroke="#22C55E"
                          strokeWidth="1"
                          strokeDasharray="6,4"
                          strokeOpacity={idx === 0 ? 0.5 : 0.3}
                        />
                        {/* Vertical guide */}
                        <line
                          x1={intersection.x * scale}
                          y1={-10000}
                          x2={intersection.x * scale}
                          y2={10000}
                          stroke="#22C55E"
                          strokeWidth="1"
                          strokeDasharray="6,4"
                          strokeOpacity={idx === 0 ? 0.5 : 0.3}
                        />
                        
                        {/* Large crosshair at intersection point */}
                        {/* Horizontal crosshair line */}
                        <line
                          x1={intersection.x * scale - 20}
                          y1={intersection.y * scale}
                          x2={intersection.x * scale + 20}
                          y2={intersection.y * scale}
                          stroke="#22C55E"
                          strokeWidth="3"
                          strokeOpacity={idx === 0 ? 1 : 0.6}
                        />
                        {/* Vertical crosshair line */}
                        <line
                          x1={intersection.x * scale}
                          y1={intersection.y * scale - 20}
                          x2={intersection.x * scale}
                          y2={intersection.y * scale + 20}
                          stroke="#22C55E"
                          strokeWidth="3"
                          strokeOpacity={idx === 0 ? 1 : 0.6}
                        />
                        {/* Outer ring */}
                        <circle
                          cx={intersection.x * scale}
                          cy={intersection.y * scale}
                          r={idx === 0 ? 12 : 8}
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth="2"
                          strokeOpacity={idx === 0 ? 0.8 : 0.5}
                        />
                        {/* Center target dot */}
                        <circle
                          cx={intersection.x * scale}
                          cy={intersection.y * scale}
                          r={idx === 0 ? 5 : 3}
                          fill="#22C55E"
                          fillOpacity={idx === 0 ? 1 : 0.7}
                        />
                        
                        {/* "Intersection" label with background for visibility */}
                        {idx === 0 && (
                          <>
                            <rect
                              x={intersection.x * scale - 42}
                              y={intersection.y * scale + 18}
                              width="84"
                              height="18"
                              rx="3"
                              fill="rgba(34, 197, 94, 0.9)"
                            />
                            <text
                              x={intersection.x * scale}
                              y={intersection.y * scale + 31}
                              fontSize="11"
                              fill="white"
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              Intersection
                            </text>
                          </>
                        )}
                      </g>
                    ))}
                  </g>
                )}

                {/* ============================================
                   COOHOM-STYLE INTERSECTION INDICATOR
                   Shows when cursor is near the start point to close room
                   ============================================ */}
                {canCloseShape && (wallClickMode === 'waiting_end' || isDrawing) && (
                  <g>
                    {/* Green dashed alignment guides extending from intersection point */}
                    {/* Horizontal guide - extends left and right */}
                    <line
                      x1={-10000}
                      y1={canCloseShape.y * scale}
                      x2={10000}
                      y2={canCloseShape.y * scale}
                      stroke="#22C55E"
                      strokeWidth="1"
                      strokeDasharray="6,4"
                      strokeOpacity="0.7"
                    />
                    {/* Vertical guide - extends up and down */}
                    <line
                      x1={canCloseShape.x * scale}
                      y1={-10000}
                      x2={canCloseShape.x * scale}
                      y2={10000}
                      stroke="#22C55E"
                      strokeWidth="1"
                      strokeDasharray="6,4"
                      strokeOpacity="0.7"
                    />
                    
                    {/* Crosshair/target indicator at intersection */}
                    {/* Horizontal crosshair line */}
                    <line
                      x1={canCloseShape.x * scale - 12}
                      y1={canCloseShape.y * scale}
                      x2={canCloseShape.x * scale + 12}
                      y2={canCloseShape.y * scale}
                      stroke="#22C55E"
                      strokeWidth="2"
                    />
                    {/* Vertical crosshair line */}
                    <line
                      x1={canCloseShape.x * scale}
                      y1={canCloseShape.y * scale - 12}
                      x2={canCloseShape.x * scale}
                      y2={canCloseShape.y * scale + 12}
                      stroke="#22C55E"
                      strokeWidth="2"
                    />
                    {/* Center dot */}
                    <circle
                      cx={canCloseShape.x * scale}
                      cy={canCloseShape.y * scale}
                      r={4}
                      fill="#22C55E"
                    />
                    
                    {/* "Intersection" label below the point (Coohom-style) */}
                    <text
                      x={canCloseShape.x * scale}
                      y={canCloseShape.y * scale + 28}
                      fontSize="11"
                      fill="#22C55E"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      Intersection
                    </text>
                  </g>
                )}

                {/* CHAIN START INDICATOR - Blue circle at the starting point of the wall chain (Coohom-style) */}
                {chainStartIndicator && (wallClickMode === 'waiting_end' || isDrawing) && !canCloseShape && (
                  <g>
                    {/* Blue circle at chain start point */}
                    <circle
                      cx={chainStartIndicator.x * scale}
                      cy={chainStartIndicator.y * scale}
                      r={8}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                    <circle
                      cx={chainStartIndicator.x * scale}
                      cy={chainStartIndicator.y * scale}
                      r={3}
                      fill="#3B82F6"
                    />
                  </g>
                )}

                {/* ============================================
                   LOOP CLOSURE PROJECTION INDICATOR
                   Shows "Intersection" point ON the line being drawn (wall 3)
                   where it should END so wall 4 can close the room cleanly
                   Also shows a preview line for where wall 4 will go
                   ============================================ */}
                {loopClosureProjection && (wallClickMode === 'waiting_end' || isDrawing) && !canCloseShape && tempWall && (
                  <g style={{ zIndex: 9998 }}>
                    {/* WALL 4 PREVIEW: Dashed line showing where the closing wall will go */}
                    <line
                      x1={loopClosureProjection.x * scale}
                      y1={loopClosureProjection.y * scale}
                      x2={loopClosureProjection.chainStartX * scale}
                      y2={loopClosureProjection.chainStartY * scale}
                      stroke="#22C55E"
                      strokeWidth="2"
                      strokeDasharray="8,4"
                      strokeOpacity="0.7"
                    />
                    
                    {/* Extended alignment guides at intersection point */}
                    {/* Horizontal guide */}
                    <line
                      x1={-10000}
                      y1={loopClosureProjection.y * scale}
                      x2={10000}
                      y2={loopClosureProjection.y * scale}
                      stroke="#22C55E"
                      strokeWidth="1"
                      strokeDasharray="6,4"
                      strokeOpacity="0.5"
                    />
                    {/* Vertical guide */}
                    <line
                      x1={loopClosureProjection.x * scale}
                      y1={-10000}
                      x2={loopClosureProjection.x * scale}
                      y2={10000}
                      stroke="#22C55E"
                      strokeWidth="1"
                      strokeDasharray="6,4"
                      strokeOpacity="0.5"
                    />
                    
                    {/* Large crosshair at intersection point (where wall 3 should end) */}
                    {/* Horizontal crosshair */}
                    <line
                      x1={loopClosureProjection.x * scale - 20}
                      y1={loopClosureProjection.y * scale}
                      x2={loopClosureProjection.x * scale + 20}
                      y2={loopClosureProjection.y * scale}
                      stroke="#22C55E"
                      strokeWidth="3"
                    />
                    {/* Vertical crosshair */}
                    <line
                      x1={loopClosureProjection.x * scale}
                      y1={loopClosureProjection.y * scale - 20}
                      x2={loopClosureProjection.x * scale}
                      y2={loopClosureProjection.y * scale + 20}
                      stroke="#22C55E"
                      strokeWidth="3"
                    />
                    
                    {/* Outer ring at intersection point */}
                    <circle
                      cx={loopClosureProjection.x * scale}
                      cy={loopClosureProjection.y * scale}
                      r={12}
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                    />
                    
                    {/* Inner target dot at intersection */}
                    <circle
                      cx={loopClosureProjection.x * scale}
                      cy={loopClosureProjection.y * scale}
                      r={5}
                      fill="#22C55E"
                    />
                    
                    {/* "Intersection" label with background */}
                    <rect
                      x={loopClosureProjection.x * scale - 42}
                      y={loopClosureProjection.y * scale + 18}
                      width="84"
                      height="18"
                      rx="3"
                      fill="rgba(34, 197, 94, 0.9)"
                    />
                    <text
                      x={loopClosureProjection.x * scale}
                      y={loopClosureProjection.y * scale + 31}
                      fontSize="11"
                      fill="white"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      Intersection
                    </text>
                    
                    {/* Wall 4 length preview - shows how long the closing wall will be */}
                    {loopClosureProjection.wall4Length > 0 && (
                      <>
                        <rect
                          x={(loopClosureProjection.x + loopClosureProjection.chainStartX) / 2 * scale - 30}
                          y={(loopClosureProjection.y + loopClosureProjection.chainStartY) / 2 * scale - 10}
                          width="60"
                          height="16"
                          rx="3"
                          fill="rgba(0,0,0,0.75)"
                        />
                        <text
                          x={(loopClosureProjection.x + loopClosureProjection.chainStartX) / 2 * scale}
                          y={(loopClosureProjection.y + loopClosureProjection.chainStartY) / 2 * scale + 2}
                          fontSize="10"
                          fill="#22C55E"
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {Math.round(loopClosureProjection.wall4Length)}mm
                        </text>
                      </>
                    )}
                  </g>
                )}

                {/* PRE-CLICK SNAP INDICATOR - Shows BEFORE clicking when wall tool active */}
                {preClickSnap && tool === 'wall' && !wallClickMode && (
                  <g>
                    {/* Outer ring - larger hitbox visualization */}
                    <circle
                      cx={preClickSnap.x * scale}
                      cy={preClickSnap.y * scale}
                      r={preClickSnap.type === 'vertex' ? 12 : 6}
                      fill="none"
                      stroke={preClickSnap.type === 'vertex' ? '#22C55E' : '#94A3B8'}
                      strokeWidth="2"
                      strokeDasharray={preClickSnap.type === 'vertex' ? '0' : '4,2'}
                      strokeOpacity="0.7"
                    />
                    {/* Inner filled circle */}
                    <circle
                      cx={preClickSnap.x * scale}
                      cy={preClickSnap.y * scale}
                      r={preClickSnap.type === 'vertex' ? 6 : 3}
                      fill={preClickSnap.type === 'vertex' ? '#22C55E' : '#94A3B8'}
                      fillOpacity="0.9"
                    />
                    {/* Crosshair for vertex snap */}
                    {preClickSnap.type === 'vertex' && (
                      <>
                        <line
                          x1={preClickSnap.x * scale - 16} y1={preClickSnap.y * scale}
                          x2={preClickSnap.x * scale - 8} y2={preClickSnap.y * scale}
                          stroke="#22C55E" strokeWidth="2"
                        />
                        <line
                          x1={preClickSnap.x * scale + 8} y1={preClickSnap.y * scale}
                          x2={preClickSnap.x * scale + 16} y2={preClickSnap.y * scale}
                          stroke="#22C55E" strokeWidth="2"
                        />
                        <line
                          x1={preClickSnap.x * scale} y1={preClickSnap.y * scale - 16}
                          x2={preClickSnap.x * scale} y2={preClickSnap.y * scale - 8}
                          stroke="#22C55E" strokeWidth="2"
                        />
                        <line
                          x1={preClickSnap.x * scale} y1={preClickSnap.y * scale + 8}
                          x2={preClickSnap.x * scale} y2={preClickSnap.y * scale + 16}
                          stroke="#22C55E" strokeWidth="2"
                        />
                      </>
                    )}
                  </g>
                )}

                {/* SPLIT PREVIEW INDICATOR - Shows where wall will be split with distance measurement */}
                {splitPreview && tool === 'split' && (() => {
                  // Calculate distances from split point to both endpoints
                  const wall = splitPreview.wall;
                  const distToStart = Math.round(Math.sqrt(
                    Math.pow(splitPreview.x - wall.start_x, 2) + Math.pow(splitPreview.y - wall.start_y, 2)
                  ));
                  const distToEnd = Math.round(Math.sqrt(
                    Math.pow(splitPreview.x - wall.end_x, 2) + Math.pow(splitPreview.y - wall.end_y, 2)
                  ));
                  
                  // Calculate wall angle for perpendicular cut line
                  const wallDx = wall.end_x - wall.start_x;
                  const wallDy = wall.end_y - wall.start_y;
                  const wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
                  const perpX = wallLen > 0 ? -wallDy / wallLen : 0;
                  const perpY = wallLen > 0 ? wallDx / wallLen : 1;
                  const cutLength = (wall.thickness || 150) / 2 + 30; // Extend beyond wall
                  
                  return (
                    <g>
                      {/* Highlight the wall being split */}
                      <line
                        x1={wall.start_x * scale}
                        y1={wall.start_y * scale}
                        x2={wall.end_x * scale}
                        y2={wall.end_y * scale}
                        stroke="#1F2937"
                        strokeWidth={(wall.thickness || 150) * scale + 4}
                        strokeLinecap="round"
                        opacity="0.15"
                      />
                      
                      {/* Cut line - perpendicular dotted line across wall */}
                      <line
                        x1={(splitPreview.x - perpX * cutLength) * scale}
                        y1={(splitPreview.y - perpY * cutLength) * scale}
                        x2={(splitPreview.x + perpX * cutLength) * scale}
                        y2={(splitPreview.y + perpY * cutLength) * scale}
                        stroke="#1F2937"
                        strokeWidth="2"
                        strokeDasharray="4,3"
                      />
                      
                      {/* Split point - small black knife marker */}
                      <circle
                        cx={splitPreview.x * scale}
                        cy={splitPreview.y * scale}
                        r={6}
                        fill="#1F2937"
                      />
                      
                      {/* Distance label to start endpoint */}
                      <g>
                        <rect
                          x={((splitPreview.x + wall.start_x) / 2) * scale - 28}
                          y={((splitPreview.y + wall.start_y) / 2) * scale - 12}
                          width="56"
                          height="18"
                          rx="3"
                          fill="#F8FAFC"
                          stroke="#CBD5E1"
                          strokeWidth="1"
                        />
                        <text
                          x={((splitPreview.x + wall.start_x) / 2) * scale}
                          y={((splitPreview.y + wall.start_y) / 2) * scale + 2}
                          fontSize="11"
                          fill="#1F2937"
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {distToStart}mm
                        </text>
                      </g>
                      
                      {/* Distance label to end endpoint */}
                      <g>
                        <rect
                          x={((splitPreview.x + wall.end_x) / 2) * scale - 28}
                          y={((splitPreview.y + wall.end_y) / 2) * scale - 12}
                          width="56"
                          height="18"
                          rx="3"
                          fill="#F8FAFC"
                          stroke="#CBD5E1"
                          strokeWidth="1"
                        />
                        <text
                          x={((splitPreview.x + wall.end_x) / 2) * scale}
                          y={((splitPreview.y + wall.end_y) / 2) * scale + 2}
                          fontSize="11"
                          fill="#1F2937"
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {distToEnd}mm
                        </text>
                      </g>
                      
                      {/* Click to split label - compact */}
                      <rect
                        x={splitPreview.x * scale - 25}
                        y={splitPreview.y * scale + 12}
                        width="50"
                        height="16"
                        rx="2"
                        fill="#1F2937"
                      />
                      <text
                        x={splitPreview.x * scale}
                        y={splitPreview.y * scale + 24}
                        fontSize="9"
                        fill="white"
                        textAnchor="middle"
                        fontWeight="500"
                      >
                        Click to Cut
                      </text>
                    </g>
                  );
                })()}

                {/* Split markers - dotted lines showing where walls were split */}
                {splitMarkers.map((marker, idx) => {
                  const halfLen = (marker.thickness / 2 + 25) * scale;
                  const x1 = marker.x * scale - Math.cos(marker.angle) * halfLen;
                  const y1 = marker.y * scale - Math.sin(marker.angle) * halfLen;
                  const x2 = marker.x * scale + Math.cos(marker.angle) * halfLen;
                  const y2 = marker.y * scale + Math.sin(marker.angle) * halfLen;
                  return (
                    <g key={`split-marker-${idx}`}>
                      {/* Main dotted line - black, subtle */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#1F2937"
                        strokeWidth="1.5"
                        strokeDasharray="4,3"
                        opacity="0.7"
                      />
                      {/* Small circles at ends */}
                      <circle cx={x1} cy={y1} r={2} fill="#1F2937" opacity="0.7" />
                      <circle cx={x2} cy={y2} r={2} fill="#1F2937" opacity="0.7" />
                    </g>
                  );
                })}

                {/* Selected vertex indicator - shows when a junction point is selected */}
                {selectedVertex && (
                  <g>
                    <circle
                      cx={selectedVertex.x * scale}
                      cy={selectedVertex.y * scale}
                      r={14}
                      fill="#3B82F6"
                      fillOpacity="0.3"
                      stroke="#3B82F6"
                      strokeWidth="3"
                    />
                    <circle
                      cx={selectedVertex.x * scale}
                      cy={selectedVertex.y * scale}
                      r={6}
                      fill="#3B82F6"
                    />
                    {/* Show count of connected walls */}
                    <rect
                      x={selectedVertex.x * scale + 16}
                      y={selectedVertex.y * scale - 10}
                      width="50"
                      height="20"
                      rx="3"
                      fill="#3B82F6"
                    />
                    <text
                      x={selectedVertex.x * scale + 41}
                      y={selectedVertex.y * scale + 4}
                      fontSize="10"
                      fill="white"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {selectedVertex.walls.length} walls
                    </text>
                  </g>
                )}

                {/* Snap indicator during drawing/dragging */}
                {snapIndicator && (
                  <g>
                    <circle
                      cx={snapIndicator.x * scale}
                      cy={snapIndicator.y * scale}
                      r={snapIndicator.type === 'endpoint' ? 8 : snapIndicator.type === 'tjunction' ? 10 : 5}
                      fill={snapIndicator.type === 'endpoint' ? '#22C55E' : snapIndicator.type === 'tjunction' ? '#F59E0B' : '#94A3B8'}
                      fillOpacity="0.8"
                      stroke={snapIndicator.type === 'endpoint' ? '#16A34A' : snapIndicator.type === 'tjunction' ? '#D97706' : '#64748B'}
                      strokeWidth="2"
                    />
                    {/* T-junction indicator - show "T" symbol */}
                    {snapIndicator.type === 'tjunction' && (
                      <>
                        <text
                          x={snapIndicator.x * scale}
                          y={snapIndicator.y * scale + 4}
                          fontSize="10"
                          fill="white"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          T
                        </text>
                        <rect
                          x={snapIndicator.x * scale - 25}
                          y={snapIndicator.y * scale + 14}
                          width="50"
                          height="14"
                          rx="2"
                          fill="#F59E0B"
                        />
                        <text
                          x={snapIndicator.x * scale}
                          y={snapIndicator.y * scale + 24}
                          fontSize="8"
                          fill="white"
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          T-Junction
                        </text>
                      </>
                    )}
                  </g>
                )}

                {/* Real-time dimension display while drawing */}
                {drawingDimension && (wallClickMode === 'waiting_end' || isDrawing) && (
                  <g>
                    {/* Background box */}
                    <rect
                      x={drawingDimension.x * scale - 40}
                      y={drawingDimension.y * scale - 25}
                      width="80"
                      height="20"
                      rx="3"
                      fill="#F1F5F9"
                      stroke="#CBD5E1"
                      strokeWidth="1"
                    />
                    {/* Dimension text */}
                    <text
                      x={drawingDimension.x * scale}
                      y={drawingDimension.y * scale - 11}
                      fontSize="12"
                      fill="#1E293B"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {drawingDimension.length} mm
                    </text>
                  </g>
                )}

                {/* Ortho mode indicator */}
                {(orthoMode || shiftKeyHeld) && (wallClickMode === 'waiting_end' || isDrawing) && (
                  <g>
                    <rect
                      x="10"
                      y="10"
                      width="140"
                      height="24"
                      rx="4"
                      fill="#DCFCE7"
                      stroke="#22C55E"
                      strokeWidth="1"
                    />
                    <text
                      x="80"
                      y="26"
                      fontSize="11"
                      fill="#166534"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      ✓ Ortho Drawing Active
                    </text>
                  </g>
                )}
              </g>
            </svg>

            {/* Movement hints */}
            {selectedItem?.type === 'module' && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <Move className="h-3 w-3" />
                Drag to move • Arrow keys • Delete • ESC to cancel
                {selectedItem.item.wall_id && <span className="text-green-400 ml-1">• Pinned</span>}
              </div>
            )}
            {(selectedItem?.type === 'door' || selectedItem?.type === 'window') && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <GripVertical className="h-3 w-3" />
                Drag along wall • Arrow keys • Delete • ESC to cancel
              </div>
            )}
            {selectedItem?.type === 'wall' && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <Move className="h-3 w-3" />
                Drag to move • Drag blue handles to extend/shorten • ESC to cancel
              </div>
            )}
            
            {/* Pan/Zoom hint */}
            {!selectedItem && !isDrawing && !wallClickMode && tool === 'select' && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <span>Scroll to zoom • Space+drag to pan • ESC to reset tool</span>
              </div>
            )}

            {/* Coohom-style Drawing hint */}
            {(wallClickMode === 'waiting_start' || tool === 'wall') && !wallClickMode && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <span>Left click to start • Right click or ESC to end</span>
              </div>
            )}
            
            {wallClickMode === 'waiting_end' && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <span>Click to place wall • {orthoMode ? 'Ortho ON' : 'Shift for ortho'} • ESC to cancel</span>
              </div>
            )}

            {/* Drawing hint */}
            {isDrawing && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <span>Drawing... Release to place • ESC to cancel</span>
              </div>
            )}
            
            {/* Zoom indicator */}
            <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-medium text-slate-600 shadow-sm">
              {Math.round(scale * 100 / DEFAULT_SCALE)}%
            </div>
          </div>

          {/* Panel Toggle - Right */}
          <button
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className="w-4 bg-slate-200 hover:bg-slate-300 flex items-center justify-center shrink-0"
          >
            {rightPanelCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {/* Collapsible Properties Panel */}
          <div className={`bg-white border-l shrink-0 flex flex-col transition-all duration-200 ${rightPanelCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
            <div className="p-2 border-b">
              <h3 className="font-medium text-sm">Properties</h3>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Module Properties */}
                {selectedItem?.type === 'module' && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-500">Module Type</Label>
                      <p className="font-medium text-sm">
                        {moduleLibrary.module_types?.[selectedItem.item.module_type]?.name}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">W (mm)</Label>
                        <Input
                          type="number"
                          value={selectedItem.item.width}
                          onChange={(e) => updateModule(selectedItem.item.module_id, { width: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">H (mm)</Label>
                        <Input
                          type="number"
                          value={selectedItem.item.height}
                          onChange={(e) => updateModule(selectedItem.item.module_id, { height: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">D (mm)</Label>
                        <Input
                          type="number"
                          value={selectedItem.item.depth}
                          onChange={(e) => updateModule(selectedItem.item.module_id, { depth: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px]">Shutter Finish</Label>
                      <Select
                        value={selectedItem.item.finish_type}
                        onValueChange={(v) => updateModule(selectedItem.item.module_id, { finish_type: v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {moduleLibrary.finish_types && Object.entries(moduleLibrary.finish_types).map(([key, f]) => (
                            <SelectItem key={key} value={key}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[10px]">Shutter Type</Label>
                      <Select
                        value={selectedItem.item.shutter_type}
                        onValueChange={(v) => updateModule(selectedItem.item.module_id, { shutter_type: v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {moduleLibrary.shutter_types && Object.entries(moduleLibrary.shutter_types).map(([key, s]) => (
                            <SelectItem key={key} value={key}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[10px]">Carcass Material</Label>
                      <Select
                        value={selectedItem.item.carcass_material || 'plywood_710'}
                        onValueChange={(v) => updateModule(selectedItem.item.module_id, { carcass_material: v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CARCASS_MATERIALS).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* NEW: Carcass Finish (Item #8) */}
                    <div>
                      <Label className="text-[10px]">Carcass Finish</Label>
                      <Select
                        value={selectedItem.item.carcass_finish || 'laminate'}
                        onValueChange={(v) => updateModule(selectedItem.item.module_id, { carcass_finish: v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CARCASS_FINISHES).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">X (mm)</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.x)}
                          onChange={(e) => updateModule(selectedItem.item.module_id, { x: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Y (mm)</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.y)}
                          onChange={(e) => updateModule(selectedItem.item.module_id, { y: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    {/* Wall Pin Status */}
                    <div className="bg-slate-50 rounded p-2">
                      <Label className="text-[10px] text-slate-500">Wall Pin</Label>
                      <p className="text-xs font-medium">
                        {selectedItem.item.wall_id ? (
                          <span className="text-green-600">Pinned to wall</span>
                        ) : (
                          <span className="text-slate-400">Not pinned</span>
                        )}
                      </p>
                    </div>

                    {/* Module-to-Wall Distance (Item #8) */}
                    {(() => {
                      const distInfo = calculateModuleToWallDistance(selectedItem.item);
                      if (!distInfo) return null;
                      return (
                        <div className="bg-blue-50 rounded p-2">
                          <Label className="text-[10px] text-blue-600">Distance to Wall</Label>
                          {editingModuleDistance === selectedItem.item.module_id ? (
                            <div className="flex items-center gap-1 mt-1">
                              <Input
                                ref={moduleDistanceInputRef}
                                type="number"
                                value={moduleDistanceValue}
                                onChange={(e) => setModuleDistanceValue(e.target.value)}
                                onBlur={() => {
                                  const val = parseInt(moduleDistanceValue, 10);
                                  if (!isNaN(val)) applyModuleDistanceToWall(selectedItem.item.module_id, val, distInfo.direction);
                                  else setEditingModuleDistance(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseInt(moduleDistanceValue, 10);
                                    if (!isNaN(val)) applyModuleDistanceToWall(selectedItem.item.module_id, val, distInfo.direction);
                                  }
                                  if (e.key === 'Escape') setEditingModuleDistance(null);
                                }}
                                className="h-6 text-xs w-20"
                                min="0"
                              />
                              <span className="text-xs text-blue-600">mm</span>
                            </div>
                          ) : (
                            <p 
                              className="text-xs font-medium text-blue-700 cursor-pointer hover:underline"
                              onClick={() => {
                                setEditingModuleDistance(selectedItem.item.module_id);
                                setModuleDistanceValue(String(distInfo.distance));
                                setTimeout(() => moduleDistanceInputRef.current?.focus(), 50);
                              }}
                            >
                              {distInfo.distance}mm ({distInfo.direction})
                              <span className="text-[9px] text-blue-500 ml-1">← click to edit</span>
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Wall Properties */}
                {selectedItem?.type === 'wall' && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-500">Wall</Label>
                      <p className="font-medium text-sm">{selectedItem.item.length}mm × {selectedItem.item.height || DEFAULT_WALL_HEIGHT}mm (H)</p>
                    </div>

                    <div>
                      <Label className="text-[10px]">Length (mm)</Label>
                      <Input
                        type="number"
                        value={selectedItem.item.length}
                        onChange={(e) => updateWall(selectedItem.item.wall_id, { length: parseInt(e.target.value) || 0 })}
                        className="h-7 text-xs"
                      />
                    </div>

                    {/* Wall Height Control (Item #1) */}
                    <div>
                      <Label className="text-[10px]">Height (mm)</Label>
                      <Input
                        type="number"
                        value={selectedItem.item.height || DEFAULT_WALL_HEIGHT}
                        onChange={(e) => {
                          saveToHistory();
                          const newHeight = parseInt(e.target.value) || DEFAULT_WALL_HEIGHT;
                          setLayout(prev => ({
                            ...prev,
                            walls: prev.walls.map(w => w.wall_id === selectedItem.item.wall_id ? { ...w, height: newHeight } : w)
                          }));
                          setSelectedItem(prev => ({ ...prev, item: { ...prev.item, height: newHeight } }));
                          setHasChanges(true);
                        }}
                        className="h-7 text-xs"
                        min="1800"
                        max="6000"
                        step="100"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">Default: 3000mm</p>
                    </div>

                    {/* Wall Thickness Control */}
                    <div>
                      <Label className="text-[10px]">Thickness (mm)</Label>
                      <Input
                        type="number"
                        value={selectedItem.item.thickness || DEFAULT_WALL_THICKNESS}
                        onChange={(e) => updateWallThickness(selectedItem.item.wall_id, parseInt(e.target.value) || DEFAULT_WALL_THICKNESS)}
                        className="h-7 text-xs"
                        min="50"
                        max="500"
                        step="10"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">Standard: 150mm</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <Label className="text-[10px]">Start X</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.start_x)}
                          onChange={(e) => updateWallPosition(selectedItem.item.wall_id, { start_x: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Start Y</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.start_y)}
                          onChange={(e) => updateWallPosition(selectedItem.item.wall_id, { start_y: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <Label className="text-[10px]">End X</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.end_x)}
                          onChange={(e) => updateWallPosition(selectedItem.item.wall_id, { end_x: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">End Y</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.end_y)}
                          onChange={(e) => updateWallPosition(selectedItem.item.wall_id, { end_y: parseInt(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    {/* Floor Detection Status (Item #3) */}
                    {detectedFloor && (
                      <div className="bg-blue-50 rounded p-2">
                        <Label className="text-[10px] text-blue-600">Floor Detected</Label>
                        <p className="text-xs text-blue-700">Room closed with {layout?.walls?.length || 0} walls</p>
                      </div>
                    )}

                    {/* Full-Screen Elevation Button (Item #9) */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowElevationModal(true)}
                    >
                      <Maximize2 className="h-4 w-4 mr-2" />
                      View 2D Elevation
                    </Button>
                  </>
                )}

                {/* Door/Window Properties */}
                {(selectedItem?.type === 'door' || selectedItem?.type === 'window') && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-500">{selectedItem.type === 'door' ? 'Door' : 'Window'}</Label>
                      <p className="font-medium text-sm">{selectedItem.item.type_name || (selectedItem.type === 'door' ? 'Door' : 'Window')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Width (mm)</Label>
                        <Input
                          type="number"
                          value={selectedItem.item.width}
                          className="h-7 text-xs"
                          onChange={(e) => {
                            const key = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                            updateOpening(selectedItem.type, selectedItem.item[key], { width: parseInt(e.target.value) || 0 });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Height (mm)</Label>
                        <Input
                          type="number"
                          value={selectedItem.item.height}
                          className="h-7 text-xs"
                          onChange={(e) => {
                            const key = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                            updateOpening(selectedItem.type, selectedItem.item[key], { height: parseInt(e.target.value) || 0 });
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">X (mm)</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.x)}
                          className="h-7 text-xs"
                          onChange={(e) => {
                            const key = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                            updateOpening(selectedItem.type, selectedItem.item[key], { x: parseInt(e.target.value) || 0 });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Y (mm)</Label>
                        <Input
                          type="number"
                          value={Math.round(selectedItem.item.y)}
                          className="h-7 text-xs"
                          onChange={(e) => {
                            const key = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                            updateOpening(selectedItem.type, selectedItem.item[key], { y: parseInt(e.target.value) || 0 });
                          }}
                        />
                      </div>
                    </div>

                    {/* Rotation & Flip Controls (Item #4) */}
                    <Separator />
                    <div>
                      <Label className="text-[10px] text-slate-500">Transform</Label>
                      <div className="flex gap-1 mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 flex-1"
                              onClick={() => {
                                const key = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                                rotateOpening(selectedItem.type, selectedItem.item[key], 90);
                              }}
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rotate 90°</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 flex-1"
                              onClick={() => {
                                const key = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                                flipOpening(selectedItem.type, selectedItem.item[key]);
                              }}
                            >
                              <FlipHorizontal className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Flip Orientation</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Rotation: {selectedItem.item.rotation || 0}° • {selectedItem.item.flipped ? 'Flipped' : 'Normal'}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded p-2">
                      <Label className="text-[10px] text-slate-500">Attached Wall</Label>
                      <p className="text-xs font-medium">
                        {selectedItem.item.wall_id ? (
                          <span className="text-green-600">On wall</span>
                        ) : (
                          <span className="text-amber-600">Floating</span>
                        )}
                      </p>
                    </div>
                  </>
                )}

                {!selectedItem && (
                  <div className="text-center py-8 text-slate-400">
                    <MousePointer className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-xs">Select an item to edit</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Full-Screen Editable Elevation Modal (Item #3 - Editable Elevation) */}
        <Dialog open={showElevationModal} onOpenChange={setShowElevationModal}>
          <DialogContent className="max-w-5xl h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                2D Wall Elevation View
                <span className="text-xs font-normal text-slate-500 ml-2">(Drag modules to adjust position)</span>
              </DialogTitle>
              <DialogDescription>
                Wall: {selectedItem?.item?.length || 0}mm × {selectedItem?.item?.height || DEFAULT_WALL_HEIGHT}mm (H) • {roomName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 bg-slate-100 rounded-lg overflow-hidden relative" style={{ minHeight: '450px' }}>
              {selectedItem?.type === 'wall' && (
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 1000 500"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ backgroundColor: '#f1f5f9' }}
                >
                  {/* Background grid */}
                  <defs>
                    <pattern id="elevationGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#elevationGrid)" />

                  {/* Ceiling line - uses wall height (Item #1) */}
                  <line x1="50" y1="30" x2="950" y2="30" stroke="#94a3b8" strokeWidth="2" strokeDasharray="8,4" />
                  <text x="55" y="22" fontSize="11" fill="#64748b">Ceiling ({selectedItem?.item?.height || DEFAULT_WALL_HEIGHT}mm)</text>

                  {/* Floor line */}
                  <line x1="50" y1="450" x2="950" y2="450" stroke="#374151" strokeWidth="4" />
                  <text x="55" y="472" fontSize="11" fill="#64748b">Floor (0mm)</text>

                  {/* Wall background */}
                  <rect x="50" y="30" width="900" height="420" fill="#fafafa" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Height markers - uses wall height (Item #1) */}
                  {(() => {
                    const wallH = selectedItem?.item?.height || DEFAULT_WALL_HEIGHT;
                    const markers = [0, wallH * 0.25, wallH * 0.5, wallH * 0.75, wallH];
                    return markers.map((h, i) => {
                      const yPos = 450 - (h / wallH) * 420;
                      return (
                        <g key={i}>
                          <line x1="45" y1={yPos} x2="50" y2={yPos} stroke="#94a3b8" strokeWidth="1" />
                          <text x="10" y={yPos + 4} fontSize="9" fill="#64748b">{Math.round(h)}mm</text>
                        </g>
                      );
                    });
                  })()}

                  {/* Width markers */}
                  {selectedItem?.item?.length && [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const xPos = 50 + pct * 900;
                    const mm = Math.round(pct * selectedItem.item.length);
                    return (
                      <g key={i}>
                        <line x1={xPos} y1="450" x2={xPos} y2="455" stroke="#94a3b8" strokeWidth="1" />
                        <text x={xPos} y="468" fontSize="9" fill="#64748b" textAnchor="middle">{mm}mm</text>
                      </g>
                    );
                  })}

                  {/* Modules - Draggable (Item #3) */}
                  {getModulesOnWall(selectedItem?.item?.wall_id).map(m => {
                    const modInfo = moduleLibrary.module_types?.[m.module_type] || {};
                    const color = MODULE_COLORS[m.module_type] || '#888';
                    const wallLength = selectedItem?.item?.length || 3000;
                    const wallHeight = selectedItem?.item?.height || DEFAULT_WALL_HEIGHT;
                    
                    // Calculate position relative to wall
                    const wall = selectedItem?.item;
                    const wallStartX = Math.min(wall?.start_x || 0, wall?.end_x || 0);
                    const moduleRelativeX = m.x - wallStartX;
                    
                    // Scale to SVG coordinates using wall height (Item #1)
                    const svgX = 50 + (moduleRelativeX / wallLength) * 900;
                    const svgWidth = (m.width / wallLength) * 900;
                    const svgHeight = (m.height / wallHeight) * 420;
                    const svgY = 450 - svgHeight - (m.elevation_offset || 0) / wallHeight * 420;
                    
                    const isBeingDragged = elevationDragModule === m.module_id;

                    return (
                      <g
                        key={m.module_id}
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setElevationDragModule(m.module_id);
                          const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                          const svgX = (e.clientX - svgRect.left) / svgRect.width * 1000;
                          const svgY = (e.clientY - svgRect.top) / svgRect.height * 500;
                          setElevationDragStart({ svgX, svgY, moduleX: m.x, moduleElevation: m.elevation_offset || 0 });
                        }}
                      >
                        <rect
                          x={Math.max(50, Math.min(950 - svgWidth, svgX))}
                          y={Math.max(30, Math.min(450 - svgHeight, svgY))}
                          width={svgWidth}
                          height={svgHeight}
                          fill={color}
                          fillOpacity={isBeingDragged ? 0.9 : 0.8}
                          stroke={isBeingDragged ? '#1e40af' : color}
                          strokeWidth={isBeingDragged ? 3 : 1}
                          rx="2"
                        />
                        <text
                          x={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y={Math.max(30, Math.min(450 - svgHeight, svgY)) + svgHeight / 2 - 8}
                          fontSize="11"
                          fill="white"
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          {modInfo.name || m.module_type}
                        </text>
                        <text
                          x={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y={Math.max(30, Math.min(450 - svgHeight, svgY)) + svgHeight / 2 + 8}
                          fontSize="9"
                          fill="white"
                          fillOpacity="0.8"
                          textAnchor="middle"
                        >
                          {m.width}×{m.height}mm
                        </text>
                      </g>
                    );
                  })}

                  {/* Doors in Elevation View (Item #3) */}
                  {layout?.doors?.filter(d => d.wall_id === selectedItem?.item?.wall_id).map(door => {
                    const wallLength = selectedItem?.item?.length || 3000;
                    const wallHeight = selectedItem?.item?.height || DEFAULT_WALL_HEIGHT;
                    const wall = selectedItem?.item;
                    const wallStartX = Math.min(wall?.start_x || 0, wall?.end_x || 0);
                    const doorRelativeX = door.x - wallStartX;
                    
                    const svgX = 50 + (doorRelativeX / wallLength) * 900;
                    const svgWidth = (door.width / wallLength) * 900;
                    const svgHeight = (door.height / wallHeight) * 420;
                    const svgY = 450 - svgHeight; // Door starts from floor
                    
                    return (
                      <g key={door.door_id}>
                        <rect
                          x={Math.max(50, Math.min(950 - svgWidth, svgX))}
                          y={svgY}
                          width={svgWidth}
                          height={svgHeight}
                          fill={MODULE_COLORS.door}
                          fillOpacity="0.7"
                          stroke={MODULE_COLORS.door}
                          strokeWidth="2"
                        />
                        <text
                          x={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y={svgY + svgHeight / 2}
                          fontSize="10"
                          fill="white"
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          {door.type_name || 'Door'}
                        </text>
                        <text
                          x={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y={svgY + svgHeight / 2 + 14}
                          fontSize="8"
                          fill="white"
                          fillOpacity="0.8"
                          textAnchor="middle"
                        >
                          {door.width}×{door.height}mm
                        </text>
                      </g>
                    );
                  })}

                  {/* Windows in Elevation View (Item #3) */}
                  {layout?.windows?.filter(w => w.wall_id === selectedItem?.item?.wall_id).map(win => {
                    const wallLength = selectedItem?.item?.length || 3000;
                    const wallHeight = selectedItem?.item?.height || DEFAULT_WALL_HEIGHT;
                    const wall = selectedItem?.item;
                    const wallStartX = Math.min(wall?.start_x || 0, wall?.end_x || 0);
                    const winRelativeX = win.x - wallStartX;
                    
                    const svgX = 50 + (winRelativeX / wallLength) * 900;
                    const svgWidth = (win.width / wallLength) * 900;
                    const svgHeight = (win.height / wallHeight) * 420;
                    // Window typically at 900mm sill height from floor
                    const windowSillHeight = 900;
                    const svgY = 450 - svgHeight - (windowSillHeight / wallHeight) * 420;
                    
                    return (
                      <g key={win.window_id}>
                        <rect
                          x={Math.max(50, Math.min(950 - svgWidth, svgX))}
                          y={svgY}
                          width={svgWidth}
                          height={svgHeight}
                          fill={MODULE_COLORS.window}
                          fillOpacity="0.6"
                          stroke={MODULE_COLORS.window}
                          strokeWidth="2"
                        />
                        {/* Window panes */}
                        <line
                          x1={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y1={svgY}
                          x2={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y2={svgY + svgHeight}
                          stroke="white"
                          strokeWidth="1"
                        />
                        <line
                          x1={Math.max(50, Math.min(950 - svgWidth, svgX))}
                          y1={svgY + svgHeight / 2}
                          x2={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth}
                          y2={svgY + svgHeight / 2}
                          stroke="white"
                          strokeWidth="1"
                        />
                        <text
                          x={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y={svgY + svgHeight / 2 - 6}
                          fontSize="9"
                          fill="white"
                          textAnchor="middle"
                          fontWeight="500"
                        >
                          {win.type_name || 'Window'}
                        </text>
                        <text
                          x={Math.max(50, Math.min(950 - svgWidth, svgX)) + svgWidth / 2}
                          y={svgY + svgHeight / 2 + 8}
                          fontSize="8"
                          fill="white"
                          fillOpacity="0.8"
                          textAnchor="middle"
                        >
                          {win.width}×{win.height}mm
                        </text>
                      </g>
                    );
                  })}

                  {/* Drag overlay to capture mouse events */}
                  {elevationDragModule && (
                    <rect
                      x="0"
                      y="0"
                      width="1000"
                      height="500"
                      fill="transparent"
                      style={{ cursor: 'grabbing' }}
                      onMouseMove={(e) => {
                        if (!elevationDragModule || !elevationDragStart) return;
                        const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                        const currentSvgX = (e.clientX - svgRect.left) / svgRect.width * 1000;
                        const currentSvgY = (e.clientY - svgRect.top) / svgRect.height * 500;
                        
                        const deltaSvgX = currentSvgX - elevationDragStart.svgX;
                        const deltaSvgY = currentSvgY - elevationDragStart.svgY;
                        
                        const wallLength = selectedItem?.item?.length || 3000;
                        const deltaX = (deltaSvgX / 900) * wallLength;
                        const deltaElevation = -(deltaSvgY / 420) * 2400;
                        
                        // Calculate new position
                        const wall = selectedItem?.item;
                        const wallStartX = Math.min(wall?.start_x || 0, wall?.end_x || 0);
                        const wallEndX = Math.max(wall?.start_x || 0, wall?.end_x || 0);
                        const module = layout.modules.find(m => m.module_id === elevationDragModule);
                        if (!module) return;
                        
                        // Constrain X within wall bounds
                        let newX = elevationDragStart.moduleX + deltaX;
                        newX = Math.max(wallStartX, Math.min(wallEndX - module.width, newX));
                        
                        // Constrain elevation (0 to ceiling - module height)
                        let newElevation = elevationDragStart.moduleElevation + deltaElevation;
                        newElevation = Math.max(0, Math.min(2400 - module.height, newElevation));
                        
                        // Update module position
                        updateModule(elevationDragModule, { 
                          x: Math.round(newX),
                          elevation_offset: Math.round(newElevation)
                        });
                      }}
                      onMouseUp={() => {
                        setElevationDragModule(null);
                        setElevationDragStart(null);
                      }}
                      onMouseLeave={() => {
                        setElevationDragModule(null);
                        setElevationDragStart(null);
                      }}
                    />
                  )}
                </svg>
              )}

              {/* Empty state */}
              {selectedItem?.type === 'wall' && getModulesOnWall(selectedItem.item.wall_id).length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">No modules pinned to this wall</p>
                    <p className="text-xs text-slate-400 mt-1">Place modules near walls to auto-pin them</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Info bar */}
            <div className="bg-slate-50 rounded px-3 py-2 text-xs text-slate-600 flex items-center gap-4">
              <Move className="h-4 w-4" />
              <span>Drag modules to adjust horizontal position and height • Changes sync to plan view</span>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowElevationModal(false)}>
                Exit Elevation View
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Summary Modal */}
        <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Layout Summary</DialogTitle>
              <DialogDescription>{roomName} - {project?.project_name}</DialogDescription>
            </DialogHeader>
            {summary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{summary.wallCount}</p>
                      <p className="text-sm text-slate-500">Walls ({summary.totalWallLength}mm)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{summary.moduleCount}</p>
                      <p className="text-sm text-slate-500">Modules</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{summary.totalCabinetLength}mm</p>
                      <p className="text-sm text-slate-500">Total Cabinet Length</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{summary.totalAreaSqft} sqft</p>
                      <p className="text-sm text-slate-500">Material Area</p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-green-700">{formatCurrency(summary.totalCost)}</p>
                    <p className="text-sm text-green-600">Estimated Cost</p>
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Close</Button>
              <Button onClick={generateBOQ}>Generate BOQ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
