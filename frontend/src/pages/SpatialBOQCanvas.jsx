import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Save, Download, Grid, Move,
  Square, RotateCw, Maximize2, ZoomIn, ZoomOut, MousePointer,
  Ruler, Settings, Eye, Package, Home, Lock, FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';

const API = process.env.REACT_APP_BACKEND_URL;

// Scale: pixels per mm
const DEFAULT_SCALE = 0.15;
const WALL_THICKNESS = 150; // mm
const SNAP_THRESHOLD = 20; // pixels

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
  appliance_sink: '#0EA5E9'
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
  const [tool, setTool] = useState('select'); // select, wall, module
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedModuleType, setSelectedModuleType] = useState(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [tempWall, setTempWall] = useState(null);

  // Modals
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showWallModal, setShowWallModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Room name
  const [roomName, setRoomName] = useState('Kitchen');

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

      // Try to get existing layout
      try {
        const layoutRes = await axios.get(
          `${API}/api/projects/${projectId}/spatial-layout?room_name=${roomName}`,
          { withCredentials: true }
        );
        if (layoutRes.data?.layouts?.length > 0) {
          setLayout(layoutRes.data.layouts[0]);
        } else {
          // Create empty layout
          setLayout({
            room_name: roomName,
            walls: [],
            modules: [],
            canvas_width: 5000,
            canvas_height: 4000
          });
        }
      } catch {
        setLayout({
          room_name: roomName,
          walls: [],
          modules: [],
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

  // Canvas to screen
  const canvasToScreen = (canvasX, canvasY) => {
    return {
      x: canvasX * scale + panOffset.x,
      y: canvasY * scale + panOffset.y
    };
  };

  // Handle mouse down
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only

    const canvas = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'wall') {
      setIsDrawing(true);
      setDrawStart(canvas);
      setTempWall({ start: canvas, end: canvas });
    } else if (tool === 'module' && selectedModuleType) {
      addModule(canvas.x, canvas.y);
    } else if (tool === 'select') {
      // Check if clicking on an item
      const clickedModule = findModuleAt(canvas.x, canvas.y);
      const clickedWall = findWallAt(canvas.x, canvas.y);
      
      if (clickedModule) {
        setSelectedItem({ type: 'module', item: clickedModule });
      } else if (clickedWall) {
        setSelectedItem({ type: 'wall', item: clickedWall });
      } else {
        setSelectedItem(null);
      }
    }
  };

  // Handle mouse move
  const handleMouseMove = (e) => {
    if (!isDrawing || tool !== 'wall') return;

    const canvas = screenToCanvas(e.clientX, e.clientY);
    
    // Calculate wall - snap to horizontal or vertical
    const dx = Math.abs(canvas.x - drawStart.x);
    const dy = Math.abs(canvas.y - drawStart.y);
    
    let endPoint;
    if (dx > dy) {
      // Horizontal wall
      endPoint = { x: canvas.x, y: drawStart.y };
    } else {
      // Vertical wall
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
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (isDrawing && tool === 'wall' && tempWall && tempWall.length > 100) {
      // Add wall if long enough (>100mm)
      const newWall = {
        wall_id: `wall_${Date.now().toString(36)}`,
        start_x: tempWall.start.x,
        start_y: tempWall.start.y,
        end_x: tempWall.end.x,
        end_y: tempWall.end.y,
        length: tempWall.length,
        thickness: WALL_THICKNESS,
        has_door: false,
        has_window: false
      };

      setLayout(prev => ({
        ...prev,
        walls: [...prev.walls, newWall]
      }));
      setHasChanges(true);
    }

    setIsDrawing(false);
    setTempWall(null);
  };

  // Find module at position
  const findModuleAt = (x, y) => {
    if (!layout?.modules) return null;
    
    return layout.modules.find(m => {
      const w = m.width * scale;
      const h = m.depth * scale; // Using depth for top view
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

  // Add module
  const addModule = (x, y) => {
    if (!selectedModuleType || !moduleLibrary.module_types) return;

    const moduleType = moduleLibrary.module_types[selectedModuleType];
    if (!moduleType) return;

    // Snap to nearest wall if close
    let snapToWall = null;
    let positionOnWall = 0;
    
    for (const wall of layout?.walls || []) {
      const wallDist = distanceToWall(x, y, wall);
      if (wallDist < SNAP_THRESHOLD / scale) {
        snapToWall = wall.wall_id;
        positionOnWall = calculatePositionOnWall(x, y, wall);
        break;
      }
    }

    const newModule = {
      module_id: `mod_${Date.now().toString(36)}`,
      module_type: selectedModuleType,
      wall_id: snapToWall,
      position_on_wall: positionOnWall,
      x: Math.round(x),
      y: Math.round(y),
      width: moduleType.default_width,
      height: moduleType.default_height,
      depth: moduleType.default_depth,
      rotation: 0,
      finish_type: 'laminate',
      shutter_type: 'flat',
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

  // Calculate position on wall
  const calculatePositionOnWall = (x, y, wall) => {
    const dx = wall.end_x - wall.start_x;
    const dy = wall.end_y - wall.start_y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return 0;
    
    const t = ((x - wall.start_x) * dx + (y - wall.start_y) * dy) / (length * length);
    return Math.max(0, Math.min(wall.length, t * wall.length));
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
    }

    setSelectedItem(null);
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
            <p className="text-sm text-slate-500">
              {project?.project_name} • {roomName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={roomName} onValueChange={setRoomName}>
            <SelectTrigger className="w-40">
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
        <div className="w-14 bg-white border-r flex flex-col items-center py-2 gap-1 shrink-0">
          <Button
            variant={tool === 'select' ? 'secondary' : 'ghost'}
            size="sm"
            className="w-10 h-10 p-0"
            onClick={() => setTool('select')}
            title="Select"
          >
            <MousePointer className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === 'wall' ? 'secondary' : 'ghost'}
            size="sm"
            className="w-10 h-10 p-0"
            onClick={() => setTool('wall')}
            title="Draw Wall"
          >
            <Square className="h-5 w-5" />
          </Button>
          <Button
            variant={tool === 'module' ? 'secondary' : 'ghost'}
            size="sm"
            className="w-10 h-10 p-0"
            onClick={() => setTool('module')}
            title="Add Module"
          >
            <Package className="h-5 w-5" />
          </Button>
          
          <Separator className="my-2 w-8" />
          
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0" onClick={() => setScale(s => Math.min(s * 1.2, 0.5))} title="Zoom In">
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0" onClick={() => setScale(s => Math.max(s / 1.2, 0.05))} title="Zoom Out">
            <ZoomOut className="h-5 w-5" />
          </Button>
          
          <div className="flex-1" />
          
          {selectedItem && (
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0 text-red-500" onClick={deleteSelected} title="Delete">
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Module Library Panel */}
        <div className="w-56 bg-white border-r shrink-0 flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-medium text-sm">Module Library</h3>
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
                  className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                    selectedModuleType === key && tool === 'module'
                      ? 'bg-violet-100 border-violet-300 border'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: MODULE_COLORS[key] || '#888' }}
                    />
                    <span className="font-medium">{mod.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {mod.default_width}×{mod.default_height}×{mod.default_depth}mm
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-crosshair"
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
            style={{ cursor: tool === 'wall' ? 'crosshair' : tool === 'module' ? 'copy' : 'default' }}
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

            {/* Origin marker */}
            <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
              <circle cx="0" cy="0" r="5" fill="#ef4444" />
              <text x="10" y="4" fontSize="10" fill="#64748b">0,0</text>
            </g>

            {/* Walls */}
            <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
              {layout?.walls?.map(wall => {
                const isSelected = selectedItem?.type === 'wall' && selectedItem.item.wall_id === wall.wall_id;
                return (
                  <g key={wall.wall_id}>
                    {/* Wall line */}
                    <line
                      x1={wall.start_x * scale}
                      y1={wall.start_y * scale}
                      x2={wall.end_x * scale}
                      y2={wall.end_y * scale}
                      stroke={isSelected ? '#3b82f6' : '#374151'}
                      strokeWidth={wall.thickness * scale}
                      strokeLinecap="round"
                    />
                    {/* Dimension label */}
                    <text
                      x={(wall.start_x + wall.end_x) / 2 * scale}
                      y={(wall.start_y + wall.end_y) / 2 * scale - 10}
                      fontSize="11"
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

              {/* Modules */}
              {layout?.modules?.map(module => {
                const isSelected = selectedItem?.type === 'module' && selectedItem.item.module_id === module.module_id;
                const color = MODULE_COLORS[module.module_type] || '#888';
                const modInfo = moduleLibrary.module_types?.[module.module_type] || {};

                return (
                  <g
                    key={module.module_id}
                    transform={`translate(${module.x * scale}, ${module.y * scale}) rotate(${module.rotation})`}
                  >
                    {/* Module body (top view - using width and depth) */}
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
                    {/* Module label */}
                    <text
                      x={module.width * scale / 2}
                      y={module.depth * scale / 2}
                      fontSize="10"
                      fill="white"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontWeight="500"
                    >
                      {modInfo.name?.substring(0, 3) || 'MOD'}
                    </text>
                    {/* Dimension label */}
                    <text
                      x={module.width * scale / 2}
                      y={module.depth * scale + 12}
                      fontSize="9"
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
        </div>

        {/* Right Properties Panel */}
        <div className="w-64 bg-white border-l shrink-0 flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-medium text-sm">Properties</h3>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {selectedItem?.type === 'module' && (
                <>
                  <div>
                    <Label className="text-xs text-slate-500">Module Type</Label>
                    <p className="font-medium">
                      {moduleLibrary.module_types?.[selectedItem.item.module_type]?.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Width (mm)</Label>
                      <Input
                        type="number"
                        value={selectedItem.item.width}
                        onChange={(e) => updateModule(selectedItem.item.module_id, { width: parseInt(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height (mm)</Label>
                      <Input
                        type="number"
                        value={selectedItem.item.height}
                        onChange={(e) => updateModule(selectedItem.item.module_id, { height: parseInt(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Depth (mm)</Label>
                      <Input
                        type="number"
                        value={selectedItem.item.depth}
                        onChange={(e) => updateModule(selectedItem.item.module_id, { depth: parseInt(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Finish Type</Label>
                    <Select
                      value={selectedItem.item.finish_type}
                      onValueChange={(v) => updateModule(selectedItem.item.module_id, { finish_type: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {moduleLibrary.finish_types && Object.entries(moduleLibrary.finish_types).map(([key, f]) => (
                          <SelectItem key={key} value={key}>{f.name} (₹{f.rate_per_sqft}/sqft)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Shutter Type</Label>
                    <Select
                      value={selectedItem.item.shutter_type}
                      onValueChange={(v) => updateModule(selectedItem.item.module_id, { shutter_type: v })}
                    >
                      <SelectTrigger className="h-8">
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
                    <Label className="text-xs">Position X (mm)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedItem.item.x)}
                      onChange={(e) => updateModule(selectedItem.item.module_id, { x: parseInt(e.target.value) || 0 })}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Position Y (mm)</Label>
                    <Input
                      type="number"
                      value={Math.round(selectedItem.item.y)}
                      onChange={(e) => updateModule(selectedItem.item.module_id, { y: parseInt(e.target.value) || 0 })}
                      className="h-8"
                    />
                  </div>
                </>
              )}

              {selectedItem?.type === 'wall' && (
                <>
                  <div>
                    <Label className="text-xs text-slate-500">Wall</Label>
                    <p className="font-medium">{selectedItem.item.length}mm</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label>Start X</Label>
                      <p>{Math.round(selectedItem.item.start_x)}</p>
                    </div>
                    <div>
                      <Label>Start Y</Label>
                      <p>{Math.round(selectedItem.item.start_y)}</p>
                    </div>
                    <div>
                      <Label>End X</Label>
                      <p>{Math.round(selectedItem.item.end_x)}</p>
                    </div>
                    <div>
                      <Label>End Y</Label>
                      <p>{Math.round(selectedItem.item.end_y)}</p>
                    </div>
                  </div>
                </>
              )}

              {!selectedItem && (
                <div className="text-center py-8 text-slate-400">
                  <MousePointer className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Select an item to edit</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Summary Footer */}
          {summary && (
            <div className="border-t p-3 bg-slate-50 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Walls</span>
                <span className="font-medium">{summary.wallCount} ({summary.totalWallLength}mm)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Modules</span>
                <span className="font-medium">{summary.moduleCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cabinet Length</span>
                <span className="font-medium">{summary.totalCabinetLength}mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Material Area</span>
                <span className="font-medium">{summary.totalAreaSqft} sqft</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-sm">
                <span className="font-medium">Est. Cost</span>
                <span className="font-bold text-green-600">{formatCurrency(summary.totalCost)}</span>
              </div>
            </div>
          )}
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
  );
}
