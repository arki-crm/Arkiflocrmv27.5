import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ArrowLeft, Plus, Trash2, Copy, Save, Lock, FileText,
  ChevronDown, ChevronUp, History, Edit, MoreVertical,
  Calculator, Package, Ruler, Check, AlertCircle, Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const API = process.env.REACT_APP_BACKEND_URL;

// Unit options
const BOQ_UNITS = ['sqft', 'rft', 'nos', 'set', 'lump sum'];

// Status badge colors
const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-700', icon: Edit },
  under_review: { label: 'Under Review', bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  locked: { label: 'Locked', bg: 'bg-green-100', text: 'text-green-700', icon: Lock }
};

export default function BOQBuilder() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState(null);
  const [boq, setBoq] = useState(null);
  const [user, setUser] = useState(null);
  const [expandedRooms, setExpandedRooms] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Modal states
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showRenameRoomModal, setShowRenameRoomModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [showDeleteRoomDialog, setShowDeleteRoomDialog] = useState(false);
  
  // Form states
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [projectRes, boqRes, userRes] = await Promise.all([
        axios.get(`${API}/api/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/api/projects/${projectId}/boq`, { withCredentials: true }),
        axios.get(`${API}/api/auth/me`, { withCredentials: true })
      ]);
      
      setProject(projectRes.data);
      setBoq(boqRes.data);
      setUser(userRes.data);
      
      // Expand all rooms by default
      const expanded = {};
      (boqRes.data?.rooms || []).forEach(room => {
        expanded[room.room_id] = true;
      });
      setExpandedRooms(expanded);
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load BOQ');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate totals
  const calculateTotals = useCallback((rooms) => {
    let grandTotal = 0;
    const updatedRooms = rooms.map(room => {
      let subtotal = 0;
      const updatedItems = room.items.map(item => {
        const total = (item.quantity || 0) * (item.unit_price || 0);
        subtotal += total;
        return { ...item, total_price: Math.round(total * 100) / 100 };
      });
      grandTotal += subtotal;
      return { ...room, items: updatedItems, subtotal: Math.round(subtotal * 100) / 100 };
    });
    return { rooms: updatedRooms, grandTotal: Math.round(grandTotal * 100) / 100 };
  }, []);

  // Update room
  const updateRoom = (roomId, updates) => {
    setBoq(prev => {
      const newRooms = prev.rooms.map(room => 
        room.room_id === roomId ? { ...room, ...updates } : room
      );
      const { rooms, grandTotal } = calculateTotals(newRooms);
      return { ...prev, rooms, grand_total: grandTotal };
    });
    setHasChanges(true);
  };

  // Update item
  const updateItem = (roomId, itemId, updates) => {
    setBoq(prev => {
      const newRooms = prev.rooms.map(room => {
        if (room.room_id !== roomId) return room;
        const newItems = room.items.map(item =>
          item.item_id === itemId ? { ...item, ...updates } : item
        );
        return { ...room, items: newItems };
      });
      const { rooms, grandTotal } = calculateTotals(newRooms);
      return { ...prev, rooms, grand_total: grandTotal };
    });
    setHasChanges(true);
  };

  // Add item to room
  const addItem = (roomId) => {
    const newItem = {
      item_id: `item_${Date.now().toString(36)}`,
      name: '',
      description: '',
      width: null,
      height: null,
      depth: null,
      quantity: 1,
      unit: 'nos',
      unit_price: 0,
      total_price: 0
    };
    
    setBoq(prev => {
      const newRooms = prev.rooms.map(room => {
        if (room.room_id !== roomId) return room;
        return { ...room, items: [...room.items, newItem] };
      });
      return { ...prev, rooms: newRooms };
    });
    setHasChanges(true);
  };

  // Duplicate item
  const duplicateItem = (roomId, item) => {
    const newItem = {
      ...item,
      item_id: `item_${Date.now().toString(36)}`,
      name: `${item.name} (Copy)`
    };
    
    setBoq(prev => {
      const newRooms = prev.rooms.map(room => {
        if (room.room_id !== roomId) return room;
        const itemIndex = room.items.findIndex(i => i.item_id === item.item_id);
        const newItems = [...room.items];
        newItems.splice(itemIndex + 1, 0, newItem);
        return { ...room, items: newItems };
      });
      const { rooms, grandTotal } = calculateTotals(newRooms);
      return { ...prev, rooms, grand_total: grandTotal };
    });
    setHasChanges(true);
  };

  // Delete item
  const deleteItem = (roomId, itemId) => {
    setBoq(prev => {
      const newRooms = prev.rooms.map(room => {
        if (room.room_id !== roomId) return room;
        return { ...room, items: room.items.filter(i => i.item_id !== itemId) };
      });
      const { rooms, grandTotal } = calculateTotals(newRooms);
      return { ...prev, rooms, grand_total: grandTotal };
    });
    setHasChanges(true);
  };

  // Add room
  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    
    try {
      await axios.post(
        `${API}/api/projects/${projectId}/boq/rooms`,
        { name: newRoomName.trim() },
        { withCredentials: true }
      );
      toast.success('Room added');
      setShowAddRoomModal(false);
      setNewRoomName('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add room');
    }
  };

  // Rename room
  const handleRenameRoom = () => {
    if (!selectedRoom || !newRoomName.trim()) return;
    updateRoom(selectedRoom.room_id, { name: newRoomName.trim() });
    setShowRenameRoomModal(false);
    setSelectedRoom(null);
    setNewRoomName('');
  };

  // Delete room
  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    
    try {
      await axios.delete(
        `${API}/api/projects/${projectId}/boq/rooms/${selectedRoom.room_id}`,
        { withCredentials: true }
      );
      toast.success('Room deleted');
      setShowDeleteRoomDialog(false);
      setSelectedRoom(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete room');
    }
  };

  // Save BOQ
  const handleSave = async () => {
    if (!boq) return;
    
    try {
      setSaving(true);
      await axios.put(
        `${API}/api/projects/${projectId}/boq`,
        { rooms: boq.rooms, notes: boq.notes },
        { withCredentials: true }
      );
      toast.success('BOQ saved successfully');
      setHasChanges(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save BOQ');
    } finally {
      setSaving(false);
    }
  };

  // Update status
  const handleStatusChange = async (newStatus) => {
    try {
      await axios.put(
        `${API}/api/projects/${projectId}/boq/status`,
        { status: newStatus, change_notes: statusNotes },
        { withCredentials: true }
      );
      toast.success(`BOQ status updated to ${STATUS_CONFIG[newStatus]?.label}`);
      setShowStatusModal(false);
      setStatusNotes('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    }
  };

  // Fetch versions
  const fetchVersions = async () => {
    try {
      const res = await axios.get(
        `${API}/api/projects/${projectId}/boq/versions`,
        { withCredentials: true }
      );
      setVersions(res.data?.versions || []);
      setShowVersionsModal(true);
    } catch (err) {
      toast.error('Failed to load versions');
    }
  };

  // View specific version
  const viewVersion = async (version) => {
    try {
      const res = await axios.get(
        `${API}/api/projects/${projectId}/boq/versions/${version}`,
        { withCredentials: true }
      );
      setSelectedVersion(res.data);
    } catch (err) {
      toast.error('Failed to load version');
    }
  };

  // Permission checks
  const canEdit = boq?.status !== 'locked';
  const canLock = user?.role === 'Admin' || user?.role === 'Founder';
  const canReview = user?.role === 'Admin' || user?.role === 'Founder' || user?.role === 'Design Manager';

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bg} ${config.text} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(`/projects/${projectId}`)}
                data-testid="back-to-project"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  BOQ Builder
                  <StatusBadge status={boq?.status} />
                </h1>
                <p className="text-sm text-slate-500">
                  {project?.project_name} • Version {boq?.version || 1}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchVersions}
                data-testid="view-versions"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
              
              {canEdit && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowStatusModal(true)}
                    data-testid="change-status"
                  >
                    Status
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    data-testid="save-boq"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-32">
        {/* Add Room Button */}
        {canEdit && (
          <div className="mb-4">
            <Button 
              variant="outline" 
              onClick={() => setShowAddRoomModal(true)}
              data-testid="add-room"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Room
            </Button>
          </div>
        )}

        {/* Room Cards */}
        <div className="space-y-4">
          {boq?.rooms?.map((room, roomIndex) => (
            <Card key={room.room_id} className="overflow-hidden" data-testid={`room-card-${room.room_id}`}>
              <CardHeader 
                className="bg-slate-50 py-3 cursor-pointer"
                onClick={() => setExpandedRooms(prev => ({
                  ...prev,
                  [room.room_id]: !prev[room.room_id]
                }))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedRooms[room.room_id] ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                    <div>
                      <CardTitle className="text-base">{room.name}</CardTitle>
                      <CardDescription>
                        {room.items?.length || 0} items • Subtotal: {formatCurrency(room.subtotal)}
                      </CardDescription>
                    </div>
                  </div>
                  
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoom(room);
                          setNewRoomName(room.name);
                          setShowRenameRoomModal(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRoom(room);
                            setShowDeleteRoomDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              
              {expandedRooms[room.room_id] && (
                <CardContent className="p-0">
                  {/* Item Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Item Name</th>
                          <th className="text-left px-4 py-2 font-medium">Description</th>
                          <th className="text-left px-4 py-2 font-medium w-32">Dimensions (W×H×D)</th>
                          <th className="text-right px-4 py-2 font-medium w-20">Qty</th>
                          <th className="text-left px-4 py-2 font-medium w-28">Unit</th>
                          <th className="text-right px-4 py-2 font-medium w-28">Unit Price</th>
                          <th className="text-right px-4 py-2 font-medium w-28">Total</th>
                          {canEdit && <th className="w-20"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {room.items?.map((item) => (
                          <tr key={item.item_id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <Input
                                value={item.name}
                                onChange={(e) => updateItem(room.room_id, item.item_id, { name: e.target.value })}
                                placeholder="Item name"
                                disabled={!canEdit}
                                className="h-8 text-sm"
                                data-testid={`item-name-${item.item_id}`}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={item.description || ''}
                                onChange={(e) => updateItem(room.room_id, item.item_id, { description: e.target.value })}
                                placeholder="Description"
                                disabled={!canEdit}
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <Input
                                  type="number"
                                  value={item.width || ''}
                                  onChange={(e) => updateItem(room.room_id, item.item_id, { width: parseFloat(e.target.value) || null })}
                                  placeholder="W"
                                  disabled={!canEdit}
                                  className="h-8 text-sm w-12 px-1 text-center"
                                />
                                <span className="text-slate-400 self-center">×</span>
                                <Input
                                  type="number"
                                  value={item.height || ''}
                                  onChange={(e) => updateItem(room.room_id, item.item_id, { height: parseFloat(e.target.value) || null })}
                                  placeholder="H"
                                  disabled={!canEdit}
                                  className="h-8 text-sm w-12 px-1 text-center"
                                />
                                <span className="text-slate-400 self-center">×</span>
                                <Input
                                  type="number"
                                  value={item.depth || ''}
                                  onChange={(e) => updateItem(room.room_id, item.item_id, { depth: parseFloat(e.target.value) || null })}
                                  placeholder="D"
                                  disabled={!canEdit}
                                  className="h-8 text-sm w-12 px-1 text-center"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(room.room_id, item.item_id, { quantity: parseFloat(e.target.value) || 0 })}
                                disabled={!canEdit}
                                className="h-8 text-sm text-right"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Select
                                value={item.unit}
                                onValueChange={(v) => updateItem(room.room_id, item.item_id, { unit: v })}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BOQ_UNITS.map(unit => (
                                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateItem(room.room_id, item.item_id, { unit_price: parseFloat(e.target.value) || 0 })}
                                disabled={!canEdit}
                                className="h-8 text-sm text-right"
                                min="0"
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {formatCurrency(item.total_price)}
                            </td>
                            {canEdit && (
                              <td className="px-2 py-2">
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => duplicateItem(room.room_id, item)}
                                    className="h-8 w-8 p-0"
                                    title="Duplicate"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteItem(room.room_id, item.item_id)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                        
                        {/* Empty state */}
                        {(!room.items || room.items.length === 0) && (
                          <tr>
                            <td colSpan={canEdit ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                              No items in this room
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Add Item Button */}
                  {canEdit && (
                    <div className="p-3 border-t bg-slate-50">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => addItem(room.room_id)}
                        data-testid={`add-item-${room.room_id}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Empty state */}
        {(!boq?.rooms || boq.rooms.length === 0) && (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No rooms in this BOQ</p>
            {canEdit && (
              <Button className="mt-4" onClick={() => setShowAddRoomModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Room
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Sticky Grand Total Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-slate-500">Total Rooms</p>
                <p className="text-lg font-semibold">{boq?.rooms?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Items</p>
                <p className="text-lg font-semibold">
                  {boq?.rooms?.reduce((acc, r) => acc + (r.items?.length || 0), 0) || 0}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Grand Total</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(boq?.grand_total)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Room Modal */}
      <Dialog open={showAddRoomModal} onOpenChange={setShowAddRoomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
            <DialogDescription>Enter a name for the new room section</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Room Name</Label>
            <Input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g., Bathroom, Balcony, Study Room"
              data-testid="new-room-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRoomModal(false)}>Cancel</Button>
            <Button onClick={handleAddRoom} disabled={!newRoomName.trim()}>Add Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Room Modal */}
      <Dialog open={showRenameRoomModal} onOpenChange={setShowRenameRoomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Room</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Room Name</Label>
            <Input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter new name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameRoomModal(false)}>Cancel</Button>
            <Button onClick={handleRenameRoom} disabled={!newRoomName.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Room Dialog */}
      <AlertDialog open={showDeleteRoomDialog} onOpenChange={setShowDeleteRoomDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRoom?.name}"? This will remove all items in this room. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update BOQ Status</DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Current status: <StatusBadge status={boq?.status} />
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Change Notes (Optional)</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add notes about this status change..."
              />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {boq?.status === 'draft' && (
                <Button 
                  onClick={() => handleStatusChange('under_review')}
                  className="justify-start"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Move to Under Review
                </Button>
              )}
              
              {boq?.status === 'under_review' && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => handleStatusChange('draft')}
                    className="justify-start"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Revert to Draft
                  </Button>
                  {canLock && (
                    <Button 
                      onClick={() => handleStatusChange('locked')}
                      className="justify-start bg-green-600 hover:bg-green-700"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Lock BOQ (Final Sign-off)
                    </Button>
                  )}
                </>
              )}
              
              {boq?.status === 'locked' && (
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <Check className="h-6 w-6 mx-auto text-green-600 mb-2" />
                  <p className="font-medium text-green-800">BOQ is Locked</p>
                  <p className="text-sm text-green-600">No further changes allowed</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      <Dialog open={showVersionsModal} onOpenChange={setShowVersionsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BOQ Version History</DialogTitle>
            <DialogDescription>View all versions and changes</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {versions.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No version history yet</p>
            ) : (
              versions.map((ver) => (
                <Card key={ver.version} className={`cursor-pointer hover:shadow-md transition-shadow ${selectedVersion?.version === ver.version ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardContent className="py-3" onClick={() => viewVersion(ver.version)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 rounded-full px-3 py-1 text-sm font-medium">
                          v{ver.version}
                        </div>
                        <StatusBadge status={ver.status} />
                        {ver.is_locked_version && (
                          <Badge variant="outline" className="bg-green-50">Signed Off</Badge>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{formatCurrency(ver.grand_total)}</p>
                        <p className="text-slate-500">{formatDate(ver.updated_at || ver.created_at)}</p>
                      </div>
                    </div>
                    {ver.locked_by_name && (
                      <p className="text-xs text-slate-500 mt-2">
                        Locked by {ver.locked_by_name} on {formatDate(ver.locked_at)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
            
            {/* Selected Version Detail */}
            {selectedVersion && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium mb-2">Version {selectedVersion.version} Details</h4>
                <div className="text-sm space-y-1">
                  <p>Status: <StatusBadge status={selectedVersion.status} /></p>
                  <p>Grand Total: {formatCurrency(selectedVersion.grand_total)}</p>
                  <p>Rooms: {selectedVersion.rooms?.length || 0}</p>
                  <p>Items: {selectedVersion.rooms?.reduce((a, r) => a + (r.items?.length || 0), 0) || 0}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowVersionsModal(false); setSelectedVersion(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
