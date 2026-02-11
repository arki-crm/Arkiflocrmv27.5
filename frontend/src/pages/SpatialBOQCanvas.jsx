import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Save, Download, Grid,
  Square, ZoomIn, ZoomOut, MousePointer,
  Eye, Package, FileText, ChevronLeft, ChevronRight,
  DoorOpen, PanelTop, Layers, Move, ArrowUp, ArrowDown,
  ArrowLeftIcon, ArrowRightIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
const WALL_THICKNESS = 150;
const SNAP_THRESHOLD = 20;
const MOVE_STEP = 10; // mm per arrow key press

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

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [tempWall, setTempWall] = useState(null);

  // Drag state for modules
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // Elevation view
  const [showElevationView, setShowElevationView] = useState(false);

  // Modals
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Room name
  const [roomName, setRoomName] = useState('Kitchen');

  // Auto-collapse right panel when nothing selected
  useEffect(() => {
    if (selectedItem) {
      setRightPanelCollapsed(false);
    }
  }, [selectedItem]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedItem) return;

      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          deleteSelected();
        }
      }

      // Arrow keys for module movement
      if (selectedItem.type === 'module' && document.activeElement.tagName !== 'INPUT') {
        const module = selectedItem.item;
        let dx = 0, dy = 0;

        switch (e.key) {
          case 'ArrowUp': dy = -MOVE_STEP; break;
          case 'ArrowDown': dy = MOVE_STEP; break;
          case 'ArrowLeft': dx = -MOVE_STEP; break;
          case 'ArrowRight': dx = MOVE_STEP; break;
          default: return;
        }

        e.preventDefault();
        updateModule(module.module_id, {
          x: module.x + dx,
          y: module.y + dy
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

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

  // Handle mouse down
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;

    const canvas = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'wall') {
      setIsDrawing(true);
      setDrawStart(canvas);
      setTempWall({ start: canvas, end: canvas });
    } else if (tool === 'door' || tool === 'window') {
      addOpening(canvas.x, canvas.y, tool);
    } else if (tool === 'module' && selectedModuleType) {
      addModule(canvas.x, canvas.y);
    } else if (tool === 'select') {
      const clickedModule = findModuleAt(canvas.x, canvas.y);
      const clickedWall = findWallAt(canvas.x, canvas.y);
      const clickedDoor = findDoorAt(canvas.x, canvas.y);
      const clickedWindow = findWindowAt(canvas.x, canvas.y);

      if (clickedModule) {
        setSelectedItem({ type: 'module', item: clickedModule });
        setIsDragging(true);
        setDragStart({ x: canvas.x - clickedModule.x, y: canvas.y - clickedModule.y });
      } else if (clickedDoor) {
        setSelectedItem({ type: 'door', item: clickedDoor });
      } else if (clickedWindow) {
        setSelectedItem({ type: 'window', item: clickedWindow });
      } else if (clickedWall) {
        setSelectedItem({ type: 'wall', item: clickedWall });
        setShowElevationView(true);
      } else {
        setSelectedItem(null);
        setShowElevationView(false);
      }
    }
  };

  // Handle mouse move
  const handleMouseMove = (e) => {
    const canvas = screenToCanvas(e.clientX, e.clientY);

    // Drawing wall
    if (isDrawing && tool === 'wall') {
      const dx = Math.abs(canvas.x - drawStart.x);
      const dy = Math.abs(canvas.y - drawStart.y);

      let endPoint;
      if (dx > dy) {
        endPoint = { x: canvas.x, y: drawStart.y };
      } else {
        endPoint = { x: drawStart.x, y: canvas.y };
      }

      const length = Math.sqrt(
        Math.pow(endPoint.x - drawStart.x, 2) +
        Math.pow(endPoint.y - drawStart.y, 2)
      );

      setTempWall({
        start: drawStart,
        end: endPoint,
        length: Math.round(length)
      });
    }

    // Dragging module
    if (isDragging && selectedItem?.type === 'module') {
      const newX = canvas.x - dragStart.x;
      const newY = canvas.y - dragStart.y;
      updateModule(selectedItem.item.module_id, { x: Math.round(newX), y: Math.round(newY) });
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (isDrawing && tool === 'wall' && tempWall && tempWall.length > 100) {
      const newWall = {
        wall_id: `wall_${Date.now().toString(36)}`,
        start_x: tempWall.start.x,
        start_y: tempWall.start.y,
        end_x: tempWall.end.x,
        end_y: tempWall.end.y,
        length: tempWall.length,
        thickness: WALL_THICKNESS,
        doors: [],
        windows: []
      };

      setLayout(prev => ({
        ...prev,
        walls: [...prev.walls, newWall]
      }));
      setHasChanges(true);
    }

    setIsDrawing(false);
    setTempWall(null);
    setIsDragging(false);
    setDragStart(null);
  };

  // Find module at position
  const findModuleAt = (x, y) => {
    if (!layout?.modules) return null;
    return layout.modules.find(m => {
      return x >= m.x && x <= m.x + m.width &&
             y >= m.y && y <= m.y + m.depth;
    });
  };

  // Find wall at position
  const findWallAt = (x, y) => {
    if (!layout?.walls) return null;
    return layout.walls.find(w => {
      const minX = Math.min(w.start_x, w.end_x) - 50;
      const maxX = Math.max(w.start_x, w.end_x) + 50;
      const minY = Math.min(w.start_y, w.end_y) - 50;
      const maxY = Math.max(w.start_y, w.end_y) + 50;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    });
  };

  // Find door at position
  const findDoorAt = (x, y) => {
    if (!layout?.doors) return null;
    return layout.doors.find(d => {
      return x >= d.x && x <= d.x + d.width &&
             y >= d.y && y <= d.y + d.depth;
    });
  };

  // Find window at position
  const findWindowAt = (x, y) => {
    if (!layout?.windows) return null;
    return layout.windows.find(w => {
      return x >= w.x && x <= w.x + w.width &&
             y >= w.y && y <= w.y + w.depth;
    });
  };

  // Add module
  const addModule = (x, y) => {
    if (!selectedModuleType || !moduleLibrary.module_types) return;

    const moduleType = moduleLibrary.module_types[selectedModuleType];
    if (!moduleType) return;

    const newModule = {
      module_id: `mod_${Date.now().toString(36)}`,
      module_type: selectedModuleType,
      wall_id: null,
      position_on_wall: 0,
      x: Math.round(x),
      y: Math.round(y),
      width: moduleType.default_width,
      height: moduleType.default_height,
      depth: moduleType.default_depth,
      rotation: 0,
      finish_type: 'laminate',
      shutter_type: 'flat',
      carcass_material: 'plywood_710',
      custom_name: null,
      notes: null
    };

    setLayout(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
    setHasChanges(true);
    setSelectedItem({ type: 'module', item: newModule });
  };

  // Add door or window opening
  const addOpening = (x, y, type) => {
    const nearestWall = findNearestWall(x, y);
    if (!nearestWall) {
      toast.error('Place openings on a wall');
      return;
    }

    const opening = {
      [`${type}_id`]: `${type}_${Date.now().toString(36)}`,
      wall_id: nearestWall.wall_id,
      x: Math.round(x),
      y: Math.round(y),
      width: type === 'door' ? 900 : 1200,
      height: type === 'door' ? 2100 : 1200,
      depth: WALL_THICKNESS
    };

    const key = type === 'door' ? 'doors' : 'windows';
    setLayout(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), opening]
    }));
    setHasChanges(true);
  };

  // Find nearest wall
  const findNearestWall = (x, y) => {
    if (!layout?.walls?.length) return null;
    let nearest = null;
    let minDist = Infinity;

    for (const wall of layout.walls) {
      const dist = distanceToWall(x, y, wall);
      if (dist < minDist && dist < 200) {
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

    const t = Math.max(0, Math.min(1,
      ((x - wall.start_x) * dx + (y - wall.start_y) * dy) / (length * length)
    ));

    const nearestX = wall.start_x + t * dx;
    const nearestY = wall.start_y + t * dy;

    return Math.sqrt((x - nearestX) ** 2 + (y - nearestY) ** 2);
  };

  // Update module
  const updateModule = (moduleId, updates) => {
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.module_id === moduleId ? { ...m, ...updates } : m
      )
    }));
    setHasChanges(true);

    if (selectedItem?.item?.module_id === moduleId) {
      setSelectedItem(prev => ({
        ...prev,
        item: { ...prev.item, ...updates }
      }));
    }
  };

  // Update wall
  const updateWall = (wallId, updates) => {
    setLayout(prev => ({
      ...prev,
      walls: prev.walls.map(w => {
        if (w.wall_id !== wallId) return w;
        const updated = { ...w, ...updates };
        // Recalculate end point based on new length
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
      setSelectedItem(prev => ({
        ...prev,
        item: { ...prev.item, ...updates }
      }));
    }
  };

  // Delete selected
  const deleteSelected = () => {
    if (!selectedItem) return;

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
    setShowElevationView(false);
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
        {/* Header with Live Pricing */}
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
              <p className="text-sm text-slate-500">
                {project?.project_name} • {roomName}
              </p>
            </div>
          </div>

          {/* Live Pricing Summary - Always visible in header */}
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'wall' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => setTool('wall')}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Draw Wall (W)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'door' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => setTool('door')}
                >
                  <DoorOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Door (D)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === 'window' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => setTool('window')}
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
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0" onClick={() => setScale(s => Math.min(s * 1.2, 0.5))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom In</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0" onClick={() => setScale(s => Math.max(s / 1.2, 0.05))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom Out</TooltipContent>
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
              style={{ cursor: tool === 'wall' ? 'crosshair' : tool === 'module' ? 'copy' : isDragging ? 'grabbing' : 'default' }}
            >
              {/* Grid */}
              <defs>
                <pattern id="smallGrid" width={100 * scale} height={100 * scale} patternUnits="userSpaceOnUse">
                  <path d={`M ${100 * scale} 0 L 0 0 0 ${100 * scale}`} fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
                </pattern>
                <pattern id="grid" width={500 * scale} height={500 * scale} patternUnits="userSpaceOnUse">
                  <rect width={500 * scale} height={500 * scale} fill="url(#smallGrid)" />
                  <path d={`M ${500 * scale} 0 L 0 0 0 ${500 * scale}`} fill="none" stroke="#94a3b8" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
                {/* Walls */}
                {layout?.walls?.map(wall => {
                  const isSelected = selectedItem?.type === 'wall' && selectedItem.item.wall_id === wall.wall_id;
                  return (
                    <g key={wall.wall_id}>
                      <line
                        x1={wall.start_x * scale}
                        y1={wall.start_y * scale}
                        x2={wall.end_x * scale}
                        y2={wall.end_y * scale}
                        stroke={isSelected ? '#3b82f6' : '#374151'}
                        strokeWidth={wall.thickness * scale}
                        strokeLinecap="round"
                      />
                      <text
                        x={(wall.start_x + wall.end_x) / 2 * scale}
                        y={(wall.start_y + wall.end_y) / 2 * scale - 10}
                        fontSize="10"
                        fill="#374151"
                        textAnchor="middle"
                        fontWeight="500"
                      >
                        {wall.length}mm
                      </text>
                    </g>
                  );
                })}

                {/* Temp wall while drawing */}
                {tempWall && (
                  <g>
                    <line
                      x1={tempWall.start.x * scale}
                      y1={tempWall.start.y * scale}
                      x2={tempWall.end.x * scale}
                      y2={tempWall.end.y * scale}
                      stroke="#3b82f6"
                      strokeWidth={WALL_THICKNESS * scale}
                      strokeLinecap="round"
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

                {/* Doors */}
                {layout?.doors?.map(door => {
                  const isSelected = selectedItem?.type === 'door' && selectedItem.item.door_id === door.door_id;
                  return (
                    <g key={door.door_id}>
                      <rect
                        x={door.x * scale}
                        y={door.y * scale}
                        width={door.width * scale}
                        height={door.depth * scale}
                        fill={MODULE_COLORS.door}
                        fillOpacity="0.8"
                        stroke={isSelected ? '#1e40af' : MODULE_COLORS.door}
                        strokeWidth={isSelected ? 2 : 1}
                        rx="2"
                      />
                      <text
                        x={(door.x + door.width / 2) * scale}
                        y={(door.y + door.depth / 2) * scale}
                        fontSize="9"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        Door
                      </text>
                    </g>
                  );
                })}

                {/* Windows */}
                {layout?.windows?.map(win => {
                  const isSelected = selectedItem?.type === 'window' && selectedItem.item.window_id === win.window_id;
                  return (
                    <g key={win.window_id}>
                      <rect
                        x={win.x * scale}
                        y={win.y * scale}
                        width={win.width * scale}
                        height={win.depth * scale}
                        fill={MODULE_COLORS.window}
                        fillOpacity="0.6"
                        stroke={isSelected ? '#1e40af' : MODULE_COLORS.window}
                        strokeWidth={isSelected ? 2 : 1}
                        rx="2"
                      />
                      <text
                        x={(win.x + win.width / 2) * scale}
                        y={(win.y + win.depth / 2) * scale}
                        fontSize="9"
                        fill="white"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        Win
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
                        fillOpacity="0.7"
                        stroke={isSelected ? '#1e40af' : color}
                        strokeWidth={isSelected ? 3 : 1}
                        rx="2"
                      />
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

            {/* Movement hint when module selected */}
            {selectedItem?.type === 'module' && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                <Move className="h-3 w-3" />
                Drag to move • Arrow keys for fine adjustment • Delete to remove
              </div>
            )}
          </div>

          {/* Panel Toggle - Right */}
          <button
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className="w-4 bg-slate-200 hover:bg-slate-300 flex items-center justify-center shrink-0"
          >
            {rightPanelCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {/* Collapsible Properties Panel */}
          <div className={`bg-white border-l shrink-0 flex flex-col transition-all duration-200 ${rightPanelCollapsed ? 'w-0 overflow-hidden' : 'w-60'}`}>
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
                      <Label className="text-[10px]">Finish</Label>
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
                      <Label className="text-[10px]">Shutter</Label>
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

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <Label className="text-[10px]">Start X</Label>
                        <p className="text-slate-600">{Math.round(selectedItem.item.start_x)}</p>
                      </div>
                      <div>
                        <Label className="text-[10px]">Start Y</Label>
                        <p className="text-slate-600">{Math.round(selectedItem.item.start_y)}</p>
                      </div>
                    </div>

                    {/* Wall Elevation View */}
                    {showElevationView && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="h-4 w-4 text-slate-500" />
                          <Label className="text-xs font-medium">Elevation View</Label>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-3 h-32 flex items-end justify-center gap-1">
                          {/* Simplified elevation showing modules on this wall */}
                          {layout?.modules
                            ?.filter(m => m.wall_id === selectedItem.item.wall_id)
                            .map(m => {
                              const modInfo = moduleLibrary.module_types?.[m.module_type] || {};
                              const color = MODULE_COLORS[m.module_type] || '#888';
                              const heightPercent = (m.height / 2400) * 100;
                              const widthPercent = (m.width / selectedItem.item.length) * 100;

                              return (
                                <div
                                  key={m.module_id}
                                  className="flex flex-col items-center"
                                  style={{ width: `${Math.max(widthPercent, 15)}%` }}
                                >
                                  <div
                                    className="rounded-t text-[8px] text-white flex items-center justify-center"
                                    style={{
                                      backgroundColor: color,
                                      height: `${heightPercent}%`,
                                      minHeight: 20,
                                      width: '100%'
                                    }}
                                  >
                                    {modInfo.name?.substring(0, 3)}
                                  </div>
                                </div>
                              );
                            })}
                          {!layout?.modules?.some(m => m.wall_id === selectedItem.item.wall_id) && (
                            <p className="text-xs text-slate-400">No modules on this wall</p>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 text-center mt-1">
                          Wall: {selectedItem.item.length}mm
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Door/Window Properties */}
                {(selectedItem?.type === 'door' || selectedItem?.type === 'window') && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-500">{selectedItem.type === 'door' ? 'Door' : 'Window'}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Width (mm)</Label>
                        <Input
                          type="number"
                          value={selectedItem.item.width}
                          className="h-7 text-xs"
                          onChange={(e) => {
                            const key = selectedItem.type === 'door' ? 'doors' : 'windows';
                            const idKey = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                            setLayout(prev => ({
                              ...prev,
                              [key]: prev[key].map(item =>
                                item[idKey] === selectedItem.item[idKey]
                                  ? { ...item, width: parseInt(e.target.value) || 0 }
                                  : item
                              )
                            }));
                            setHasChanges(true);
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
                            const key = selectedItem.type === 'door' ? 'doors' : 'windows';
                            const idKey = selectedItem.type === 'door' ? 'door_id' : 'window_id';
                            setLayout(prev => ({
                              ...prev,
                              [key]: prev[key].map(item =>
                                item[idKey] === selectedItem.item[idKey]
                                  ? { ...item, height: parseInt(e.target.value) || 0 }
                                  : item
                              )
                            }));
                            setHasChanges(true);
                          }}
                        />
                      </div>
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
