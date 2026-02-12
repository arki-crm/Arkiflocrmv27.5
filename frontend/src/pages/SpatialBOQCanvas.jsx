import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Save, Download, Grid,
  Square, ZoomIn, ZoomOut, MousePointer,
  Eye, Package, FileText, ChevronLeft, ChevronRight,
  DoorOpen, PanelTop, Layers, Move, Maximize2, X,
  RectangleHorizontal, SquareIcon, Pencil, GripVertical,
  Undo2, Redo2, RotateCw, FlipHorizontal, FlipVertical
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
const MAX_HISTORY_SIZE = 50; // Undo/Redo history limit
const ANGLE_SNAP_TOLERANCE = 8; // degrees - Item #2 - Auto straight line assistance

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
  rectangle: { name: 'Rectangle Room', icon: RectangleHorizontal, desc: 'Drag to create 4 walls' },
  square: { name: 'Square Room', icon: SquareIcon, desc: 'Create equal-sided room' },
  free: { name: 'Free Line Draw', icon: Pencil, desc: 'Draw individual walls' }
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

  // Wall drawing state - Click-Release mode (Item #4)
  const [wallDrawMode, setWallDrawMode] = useState('free'); // rectangle, square, free
  const [showWallModePanel, setShowWallModePanel] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [tempWall, setTempWall] = useState(null);
  const [tempRectWalls, setTempRectWalls] = useState(null);
  const [wallClickMode, setWallClickMode] = useState(null); // 'waiting_end' for click-release mode

  // Module-to-Wall distance editing (Item #8)
  const [editingModuleDistance, setEditingModuleDistance] = useState(null);
  const [moduleDistanceValue, setModuleDistanceValue] = useState('');
  const moduleDistanceInputRef = useRef(null);

  // Drag state for modules/walls/openings
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragType, setDragType] = useState(null); // 'module', 'wall', 'wall_endpoint', 'door', 'window'
  const [dragEndpoint, setDragEndpoint] = useState(null); // 'start' or 'end' for wall endpoints

  // Elevation view - full screen mode (Item #9)
  const [showElevationModal, setShowElevationModal] = useState(false);

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

    // Use a tolerance for coordinate matching
    const COORD_TOLERANCE = 50; // mm

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

    // Check if each endpoint has exactly 2 connections (closed polygon requirement)
    let allConnected = true;
    for (const [key, connections] of endpoints) {
      if (connections.length !== 2) {
        allConnected = false;
        break;
      }
    }

    if (!allConnected || endpoints.size < 3) {
      setDetectedFloor(null);
      return;
    }

    // Traverse to build polygon
    const visited = new Set();
    const firstEntry = endpoints.entries().next().value;
    if (!firstEntry) {
      setDetectedFloor(null);
      return;
    }

    const [startKey, startConnections] = firstEntry;
    const polygon = [];
    let currentKey = startKey;
    let prevWallId = null;
    let iterations = 0;
    const maxIterations = layout.walls.length * 2;

    while (iterations < maxIterations) {
      iterations++;
      const connections = endpoints.get(currentKey);
      if (!connections || connections.length === 0) break;

      // Add current point to polygon
      const currentConn = connections[0];
      polygon.push({ x: currentConn.x, y: currentConn.y });

      // Find next unvisited connection (or different from previous)
      const next = connections.find(c => c.wall.wall_id !== prevWallId);
      if (!next) break;

      prevWallId = next.wall.wall_id;
      visited.add(next.wall.wall_id);
      currentKey = next.other;

      // Check if we're back at start
      if (currentKey === startKey && polygon.length >= 3) {
        setDetectedFloor(polygon);
        return;
      }
    }

    // Not a closed polygon
    setDetectedFloor(null);
  }, [layout?.walls]);

  // Detect floor when walls change
  useEffect(() => {
    detectFloorPolygon();
  }, [detectFloorPolygon]);

  // Auto-collapse right panel when nothing selected
  useEffect(() => {
    if (selectedItem) {
      setRightPanelCollapsed(false);
    }
  }, [selectedItem]);

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
        // Cancel wall drawing
        if (isDrawing) {
          setIsDrawing(false);
          setTempWall(null);
          setTempRectWalls(null);
          setDrawStart(null);
        }
        // Cancel inline dimension editing
        if (editingDimension) {
          setEditingDimension(null);
          setDimensionInputValue('');
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
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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

  // Find nearest corner from all walls for magnetic snap (Item #3)
  const findNearestCorner = (x, y) => {
    if (!layout?.walls?.length) return null;
    let nearest = null;
    let minDist = CORNER_SNAP_THRESHOLD;

    for (const wall of layout.walls) {
      // Check start point
      const distStart = Math.sqrt(Math.pow(x - wall.start_x, 2) + Math.pow(y - wall.start_y, 2));
      if (distStart < minDist) {
        minDist = distStart;
        nearest = { x: wall.start_x, y: wall.start_y };
      }
      // Check end point
      const distEnd = Math.sqrt(Math.pow(x - wall.end_x, 2) + Math.pow(y - wall.end_y, 2));
      if (distEnd < minDist) {
        minDist = distEnd;
        nearest = { x: wall.end_x, y: wall.end_y };
      }
    }
    return nearest;
  };

  // Auto-straight line assistance (Item #2) - Snap to 0°/90°/180°
  const snapToStraightLine = (startX, startY, endX, endY) => {
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
      // Check for wall endpoint click (for resizing)
      const endpoint = findWallEndpointAt(canvas.x, canvas.y);
      if (endpoint) {
        setSelectedItem({ type: 'wall', item: endpoint.wall });
        setIsDragging(true);
        setDragType('wall_endpoint');
        setDragEndpoint(endpoint.endpoint);
        return;
      }

      // Start drawing wall
      setIsDrawing(true);
      // Snap to nearest corner if close (Item #3)
      const snappedStart = findNearestCorner(canvas.x, canvas.y) || canvas;
      setDrawStart(snappedStart);
      
      if (wallDrawMode === 'rectangle' || wallDrawMode === 'square') {
        setTempRectWalls({ start: snappedStart, end: snappedStart });
      } else {
        setTempWall({ start: snappedStart, end: snappedStart });
      }
    } else if (tool === 'door' && selectedDoorType) {
      addOpening(canvas.x, canvas.y, 'door', selectedDoorType);
    } else if (tool === 'window' && selectedWindowType) {
      addOpening(canvas.x, canvas.y, 'window', selectedWindowType);
    } else if (tool === 'module' && selectedModuleType) {
      addModule(canvas.x, canvas.y);
    } else if (tool === 'select') {
      // First check for wall endpoint click (for length extension - Item #3)
      const endpoint = findWallEndpointAt(canvas.x, canvas.y);
      if (endpoint) {
        saveToHistory();
        setSelectedItem({ type: 'wall', item: endpoint.wall });
        setIsDragging(true);
        setDragType('wall_endpoint');
        setDragEndpoint(endpoint.endpoint);
        return;
      }

      // Check for wall click first (for dragging)
      const clickedWall = findWallAt(canvas.x, canvas.y);
      const clickedModule = findModuleAt(canvas.x, canvas.y);
      const clickedDoor = findDoorAt(canvas.x, canvas.y);
      const clickedWindow = findWindowAt(canvas.x, canvas.y);

      if (clickedModule) {
        setSelectedItem({ type: 'module', item: clickedModule });
        setIsDragging(true);
        setDragType('module');
        setDragStart({ x: canvas.x - clickedModule.x, y: canvas.y - clickedModule.y });
      } else if (clickedDoor) {
        setSelectedItem({ type: 'door', item: clickedDoor });
        setIsDragging(true);
        setDragType('door');
        setDragStart({ x: canvas.x - clickedDoor.x, y: canvas.y - clickedDoor.y });
      } else if (clickedWindow) {
        setSelectedItem({ type: 'window', item: clickedWindow });
        setIsDragging(true);
        setDragType('window');
        setDragStart({ x: canvas.x - clickedWindow.x, y: canvas.y - clickedWindow.y });
      } else if (clickedWall) {
        // Check if we're clicking near an endpoint of this wall for length editing
        const wallEndpoint = findSpecificWallEndpoint(canvas.x, canvas.y, clickedWall);
        if (wallEndpoint) {
          saveToHistory();
          setSelectedItem({ type: 'wall', item: clickedWall });
          setIsDragging(true);
          setDragType('wall_endpoint');
          setDragEndpoint(wallEndpoint);
        } else {
          saveToHistory();
          setSelectedItem({ type: 'wall', item: clickedWall });
          setIsDragging(true);
          setDragType('wall');
          setDragStart({ x: canvas.x, y: canvas.y, wall_start_x: clickedWall.start_x, wall_start_y: clickedWall.start_y, wall_end_x: clickedWall.end_x, wall_end_y: clickedWall.end_y });
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

    // Drawing wall
    if (isDrawing && tool === 'wall') {
      // Snap end point to nearest corner if close
      let endPoint = findNearestCorner(canvas.x, canvas.y) || canvas;

      if (wallDrawMode === 'rectangle') {
        setTempRectWalls({ start: drawStart, end: endPoint });
      } else if (wallDrawMode === 'square') {
        // Make it square
        const size = Math.max(Math.abs(endPoint.x - drawStart.x), Math.abs(endPoint.y - drawStart.y));
        const signX = endPoint.x > drawStart.x ? 1 : -1;
        const signY = endPoint.y > drawStart.y ? 1 : -1;
        endPoint = { x: drawStart.x + size * signX, y: drawStart.y + size * signY };
        setTempRectWalls({ start: drawStart, end: endPoint });
      } else {
        // Free line - constrain to horizontal/vertical
        const dx = Math.abs(endPoint.x - drawStart.x);
        const dy = Math.abs(endPoint.y - drawStart.y);
        if (dx > dy) {
          endPoint = { x: endPoint.x, y: drawStart.y };
        } else {
          endPoint = { x: drawStart.x, y: endPoint.y };
        }
        const length = Math.sqrt(Math.pow(endPoint.x - drawStart.x, 2) + Math.pow(endPoint.y - drawStart.y, 2));
        setTempWall({ start: drawStart, end: endPoint, length: Math.round(length) });
      }
    }

    // Dragging wall endpoint (Item #1)
    if (isDragging && dragType === 'wall_endpoint' && selectedItem?.type === 'wall') {
      const wall = selectedItem.item;
      const snapped = findNearestCorner(canvas.x, canvas.y);
      const newPos = snapped || canvas;
      
      if (dragEndpoint === 'start') {
        updateWallPosition(wall.wall_id, { start_x: newPos.x, start_y: newPos.y });
      } else {
        updateWallPosition(wall.wall_id, { end_x: newPos.x, end_y: newPos.y });
      }
    }

    // Dragging entire wall (Item #1)
    if (isDragging && dragType === 'wall' && selectedItem?.type === 'wall') {
      const wall = selectedItem.item;
      const dx = canvas.x - dragStart.x;
      const dy = canvas.y - dragStart.y;
      updateWallPosition(wall.wall_id, {
        start_x: dragStart.wall_start_x + dx,
        start_y: dragStart.wall_start_y + dy,
        end_x: dragStart.wall_end_x + dx,
        end_y: dragStart.wall_end_y + dy
      });
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
  };

  // Snap opening to wall
  const snapOpeningToWall = (x, y, width, depth, wall) => {
    const isHorizontal = Math.abs(wall.end_y - wall.start_y) < Math.abs(wall.end_x - wall.start_x);
    if (isHorizontal) {
      // Constrain X to wall bounds
      const minX = Math.min(wall.start_x, wall.end_x);
      const maxX = Math.max(wall.start_x, wall.end_x) - width;
      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: wall.start_y - depth / 2
      };
    } else {
      const minY = Math.min(wall.start_y, wall.end_y);
      const maxY = Math.max(wall.start_y, wall.end_y) - depth;
      return {
        x: wall.start_x - width / 2,
        y: Math.max(minY, Math.min(maxY, y))
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
      } else if (tempWall && tempWall.length > 100) {
        const newWall = createWall(tempWall.start.x, tempWall.start.y, tempWall.end.x, tempWall.end.y);
        setLayout(prev => ({ ...prev, walls: [...prev.walls, newWall] }));
        setHasChanges(true);
      }
    }

    setIsDrawing(false);
    setTempWall(null);
    setTempRectWalls(null);
    setIsDragging(false);
    setDragStart(null);
    setDragType(null);
    setDragEndpoint(null);
  };

  // Create wall helper
  const createWall = (startX, startY, endX, endY) => {
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    return {
      wall_id: `wall_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY,
      length: Math.round(length),
      thickness: DEFAULT_WALL_THICKNESS
    };
  };

  // Find wall endpoint at position (for resizing)
  const findWallEndpointAt = (x, y) => {
    if (!layout?.walls) return null;
    const threshold = (ENDPOINT_HANDLE_SIZE * 2) / scale; // Larger threshold for easier selection
    
    for (const wall of layout.walls) {
      const distStart = Math.sqrt(Math.pow(x - wall.start_x, 2) + Math.pow(y - wall.start_y, 2));
      if (distStart < threshold) {
        return { wall, endpoint: 'start' };
      }
      const distEnd = Math.sqrt(Math.pow(x - wall.end_x, 2) + Math.pow(y - wall.end_y, 2));
      if (distEnd < threshold) {
        return { wall, endpoint: 'end' };
      }
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

  // Distance to wall
  const distanceToWall = (x, y, wall) => {
    const dx = wall.end_x - wall.start_x;
    const dy = wall.end_y - wall.start_y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return Infinity;

    const t = Math.max(0, Math.min(1, ((x - wall.start_x) * dx + (y - wall.start_y) * dy) / (length * length)));
    const nearestX = wall.start_x + t * dx;
    const nearestY = wall.start_y + t * dy;

    return Math.sqrt((x - nearestX) ** 2 + (y - nearestY) ** 2);
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
      carcass_finish: 'laminate', // NEW (Item #8)
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
      rotation: 0,
      flipped: false
    };

    const key = type === 'door' ? 'doors' : 'windows';
    setLayout(prev => ({ ...prev, [key]: [...(prev[key] || []), opening] }));
    setHasChanges(true);
    setSelectedItem({ type, item: opening });
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

          {/* Canvas Area */}
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative"
            style={{ backgroundColor: '#e2e8f0' }}
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
                        isDragging ? 'grabbing' : 'default' 
              }}
            >
              {/* Grid - now moves with pan offset for true viewport pan (Item #1) */}
              <defs>
                <pattern 
                  id="smallGrid" 
                  width={100 * scale} 
                  height={100 * scale} 
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${panOffset.x}, ${panOffset.y})`}
                >
                  <path d={`M ${100 * scale} 0 L 0 0 0 ${100 * scale}`} fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
                </pattern>
                <pattern 
                  id="grid" 
                  width={500 * scale} 
                  height={500 * scale} 
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${panOffset.x}, ${panOffset.y})`}
                >
                  <rect width={500 * scale} height={500 * scale} fill="url(#smallGrid)" />
                  <path d={`M ${500 * scale} 0 L 0 0 0 ${500 * scale}`} fill="none" stroke="#94a3b8" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
                {/* Floor polygon detection (Item #2 - Auto Floor) */}
                {detectedFloor && detectedFloor.length >= 3 && (
                  <polygon
                    points={detectedFloor.map(p => `${p.x * scale},${p.y * scale}`).join(' ')}
                    fill="#bae6fd"
                    fillOpacity="0.5"
                    stroke="#0284c7"
                    strokeWidth="2"
                  />
                )}

                {/* Walls - Sharp corners (Item #10) */}
                {layout?.walls?.map(wall => {
                  const isSelected = selectedItem?.type === 'wall' && selectedItem.item.wall_id === wall.wall_id;
                  const thickness = wall.thickness || DEFAULT_WALL_THICKNESS;
                  return (
                    <g key={wall.wall_id}>
                      <line
                        x1={wall.start_x * scale}
                        y1={wall.start_y * scale}
                        x2={wall.end_x * scale}
                        y2={wall.end_y * scale}
                        stroke={isSelected ? '#3b82f6' : '#374151'}
                        strokeWidth={thickness * scale}
                        strokeLinecap="square"
                        style={{ cursor: 'move' }}
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
                          fill={isSelected ? '#2563eb' : '#374151'}
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

                {/* Temp wall while drawing (free mode) */}
                {tempWall && (
                  <g>
                    <line
                      x1={tempWall.start.x * scale}
                      y1={tempWall.start.y * scale}
                      x2={tempWall.end.x * scale}
                      y2={tempWall.end.y * scale}
                      stroke="#3b82f6"
                      strokeWidth={DEFAULT_WALL_THICKNESS * scale}
                      strokeLinecap="square"
                      strokeDasharray="5,5"
                    />
                    <text
                      x={(tempWall.start.x + tempWall.end.x) / 2 * scale}
                      y={(tempWall.start.y + tempWall.end.y) / 2 * scale - 15}
                      fontSize="12"
                      fill="#3b82f6"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {tempWall.length}mm
                    </text>
                  </g>
                )}

                {/* Temp rectangle/square while drawing (Item #4) */}
                {tempRectWalls && (
                  <rect
                    x={Math.min(tempRectWalls.start.x, tempRectWalls.end.x) * scale}
                    y={Math.min(tempRectWalls.start.y, tempRectWalls.end.y) * scale}
                    width={Math.abs(tempRectWalls.end.x - tempRectWalls.start.x) * scale}
                    height={Math.abs(tempRectWalls.end.y - tempRectWalls.start.y) * scale}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={DEFAULT_WALL_THICKNESS * scale}
                    strokeDasharray="5,5"
                  />
                )}

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

                  return (
                    <g
                      key={module.module_id}
                      transform={`translate(${module.x * scale}, ${module.y * scale}) rotate(${module.rotation})`}
                      style={{ cursor: 'grab' }}
                    >
                      <rect
                        x="0"
                        y="0"
                        width={module.width * scale}
                        height={module.depth * scale}
                        fill={color}
                        fillOpacity="0.8"
                        stroke={isSelected ? '#1e40af' : color}
                        strokeWidth={isSelected ? 3 : 1}
                      />
                      {/* Wall pin indicator */}
                      {module.wall_id && (
                        <circle
                          cx={module.width * scale / 2}
                          cy="4"
                          r="3"
                          fill="#22c55e"
                          stroke="white"
                          strokeWidth="1"
                        />
                      )}
                      <text
                        x={module.width * scale / 2}
                        y={module.depth * scale / 2}
                        fontSize="9"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="500"
                      >
                        {modInfo.name?.substring(0, 3) || 'MOD'}
                      </text>
                      <text
                        x={module.width * scale / 2}
                        y={module.depth * scale + 10}
                        fontSize="8"
                        fill="#374151"
                        textAnchor="middle"
                      >
                        {module.width}×{module.depth}
                      </text>
                    </g>
                  );
                })}
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
            
            {/* Pan/Zoom hint (Item #1 & #2) */}
            {!selectedItem && !isDrawing && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <span>Scroll to zoom • Space+drag to pan • ESC to reset tool</span>
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
                  </>
                )}

                {/* Wall Properties */}
                {selectedItem?.type === 'wall' && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-500">Wall</Label>
                      <p className="font-medium text-sm">{selectedItem.item.length}mm</p>
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

                    {/* Wall Thickness Control (Item #5) */}
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
                Wall: {selectedItem?.item?.length || 0}mm • {roomName} • Ceiling Height: 2400mm
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

                  {/* Ceiling line */}
                  <line x1="50" y1="30" x2="950" y2="30" stroke="#94a3b8" strokeWidth="2" strokeDasharray="8,4" />
                  <text x="55" y="22" fontSize="11" fill="#64748b">Ceiling (2400mm)</text>

                  {/* Floor line */}
                  <line x1="50" y1="450" x2="950" y2="450" stroke="#374151" strokeWidth="4" />
                  <text x="55" y="472" fontSize="11" fill="#64748b">Floor (0mm)</text>

                  {/* Wall background */}
                  <rect x="50" y="30" width="900" height="420" fill="#fafafa" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Height markers */}
                  {[0, 600, 1200, 1800, 2400].map((h, i) => {
                    const yPos = 450 - (h / 2400) * 420;
                    return (
                      <g key={i}>
                        <line x1="45" y1={yPos} x2="50" y2={yPos} stroke="#94a3b8" strokeWidth="1" />
                        <text x="10" y={yPos + 4} fontSize="9" fill="#64748b">{h}mm</text>
                      </g>
                    );
                  })}

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
                    
                    // Calculate position relative to wall
                    const wall = selectedItem?.item;
                    const wallStartX = Math.min(wall?.start_x || 0, wall?.end_x || 0);
                    const moduleRelativeX = m.x - wallStartX;
                    
                    // Scale to SVG coordinates
                    const svgX = 50 + (moduleRelativeX / wallLength) * 900;
                    const svgWidth = (m.width / wallLength) * 900;
                    const svgHeight = (m.height / 2400) * 420;
                    const svgY = 450 - svgHeight - (m.elevation_offset || 0) / 2400 * 420;
                    
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
