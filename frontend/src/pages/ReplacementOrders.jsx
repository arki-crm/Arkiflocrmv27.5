import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import {
  ArrowLeft,
  Package,
  Loader2,
  Plus,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  MapPin,
  User,
  Calendar,
  RefreshCw,
  PackageCheck,
  Send
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  dispatched: { label: 'Dispatched', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-700' },
  low: { label: 'Low', color: 'bg-slate-50 text-slate-500' }
};

export default function ReplacementOrders() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [salesReturns, setSalesReturns] = useState([]);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [filters, setFilters] = useState({
    status: '',
    priority: ''
  });
  
  const [formData, setFormData] = useState({
    linked_return_id: '',
    replacement_items: [],
    expected_dispatch_date: '',
    delivery_address: '',
    priority: 'normal',
    remarks: ''
  });
  
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    dispatch_date: '',
    delivery_date: '',
    tracking_number: '',
    delivered_by: '',
    remarks: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchSalesReturns();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
      
      const response = await axios.get(`${API}/finance/replacement-orders?${params}`, {
        withCredentials: true
      });
      setOrders(response.data || []);
    } catch (err) {
      console.error('Failed to fetch replacement orders:', err);
      toast.error('Failed to load replacement orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReturns = async () => {
    try {
      const response = await axios.get(`${API}/finance/sales-returns`, {
        withCredentials: true
      });
      // Filter returns that need replacement and don't have orders yet
      const returns = response.data || [];
      setSalesReturns(returns.filter(r => r.requires_replacement && !r.linked_replacement_order_id));
    } catch (err) {
      console.error('Failed to fetch sales returns:', err);
    }
  };

  const handleSelectReturn = (returnId) => {
    const selectedReturn = salesReturns.find(r => r.return_id === returnId);
    if (selectedReturn) {
      const items = (selectedReturn.items_returned || []).map(item => ({
        item_name: item.item_name || 'Item',
        qty: item.qty || 1,
        specifications: item.notes || '',
        notes: ''
      }));
      
      setFormData(prev => ({
        ...prev,
        linked_return_id: returnId,
        replacement_items: items,
        delivery_address: selectedReturn.delivery_address || ''
      }));
    }
  };

  const handleCreate = async () => {
    if (!formData.linked_return_id) {
      toast.error('Please select a sales return');
      return;
    }
    if (formData.replacement_items.length === 0) {
      toast.error('Please add at least one replacement item');
      return;
    }

    try {
      setCreating(true);
      await axios.post(`${API}/finance/replacement-orders`, formData, {
        withCredentials: true
      });
      toast.success('Replacement order created successfully');
      setShowCreateModal(false);
      setFormData({
        linked_return_id: '',
        replacement_items: [],
        expected_dispatch_date: '',
        delivery_address: '',
        priority: 'normal',
        remarks: ''
      });
      fetchOrders();
      fetchSalesReturns();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create replacement order');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenStatusModal = (order) => {
    setSelectedOrder(order);
    setStatusUpdate({
      status: '',
      dispatch_date: '',
      delivery_date: '',
      tracking_number: '',
      delivered_by: '',
      remarks: ''
    });
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdate.status) {
      toast.error('Please select a status');
      return;
    }

    try {
      setUpdating(true);
      await axios.put(`${API}/finance/replacement-orders/${selectedOrder.order_id}/status`, statusUpdate, {
        withCredentials: true
      });
      toast.success('Order status updated successfully');
      setShowStatusModal(false);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const getNextStatuses = (currentStatus) => {
    const transitions = {
      pending: ['processing', 'cancelled'],
      processing: ['dispatched', 'cancelled'],
      dispatched: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };
    return transitions[currentStatus] || [];
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const processingCount = orders.filter(o => o.status === 'processing').length;
  const dispatchedCount = orders.filter(o => o.status === 'dispatched').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="replacement-orders-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Replacement Orders</h1>
            <p className="text-sm text-slate-500">Track replacement deliveries for sales returns</p>
          </div>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button data-testid="create-replacement-order-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Replacement Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Replacement Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              <div>
                <Label>Link to Sales Return *</Label>
                <Select value={formData.linked_return_id} onValueChange={handleSelectReturn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sales return needing replacement" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReturns.length === 0 ? (
                      <SelectItem value="none" disabled>No returns requiring replacement</SelectItem>
                    ) : (
                      salesReturns.map(ret => (
                        <SelectItem key={ret.return_id} value={ret.return_id}>
                          {ret.return_id} - {ret.customer_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.replacement_items.length > 0 && (
                <div className="space-y-2">
                  <Label>Replacement Items</Label>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    {formData.replacement_items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>{item.qty}x {item.item_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expected Dispatch Date</Label>
                  <Input
                    type="date"
                    value={formData.expected_dispatch_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_dispatch_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Delivery Address</Label>
                <Textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                  placeholder="Full delivery address"
                  rows={2}
                />
              </div>
              
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional notes"
                  rows={2}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Order
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending</p>
                <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Processing</p>
                <p className="text-xl font-bold text-blue-600">{processingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Dispatched</p>
                <p className="text-xl font-bold text-purple-600">{dispatchedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Delivered</p>
                <p className="text-xl font-bold text-green-600">{deliveredCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-40">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">Priority</Label>
              <Select value={filters.priority || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, priority: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFilters({ status: '', priority: '' })}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No replacement orders found</p>
              <p className="text-sm mt-1">Create a replacement order for sales returns</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Order ID</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Customer</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Items</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Priority</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Dispatch Date</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => {
                    const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const priorityInfo = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal;
                    const StatusIcon = statusInfo.icon;
                    const nextStatuses = getNextStatuses(order.status);
                    
                    return (
                      <tr key={order.order_id} className="hover:bg-slate-50" data-testid={`replacement-order-row-${order.order_id}`}>
                        <td className="p-3">
                          <span className="font-mono text-sm text-blue-600">{order.order_id}</span>
                          <p className="text-xs text-slate-400">{order.linked_return_id}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">{order.customer_name || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">{order.replacement_items?.length || 0} items</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${priorityInfo.color} text-xs`}>
                            {priorityInfo.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {order.actual_dispatch_date || order.expected_dispatch_date || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${statusInfo.color} text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          {nextStatuses.length > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleOpenStatusModal(order)}
                            >
                              Update
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium">{selectedOrder.order_id}</p>
                <p className="text-xs text-slate-500">{selectedOrder.customer_name}</p>
              </div>
              
              <div>
                <Label>New Status *</Label>
                <Select value={statusUpdate.status} onValueChange={(v) => setStatusUpdate(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    {getNextStatuses(selectedOrder.status).map(status => {
                      const info = STATUS_CONFIG[status];
                      return (
                        <SelectItem key={status} value={status}>
                          {info.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {statusUpdate.status === 'dispatched' && (
                <>
                  <div>
                    <Label>Dispatch Date</Label>
                    <Input
                      type="date"
                      value={statusUpdate.dispatch_date}
                      onChange={(e) => setStatusUpdate(prev => ({ ...prev, dispatch_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Tracking Number</Label>
                    <Input
                      value={statusUpdate.tracking_number}
                      onChange={(e) => setStatusUpdate(prev => ({ ...prev, tracking_number: e.target.value }))}
                      placeholder="Enter tracking number"
                    />
                  </div>
                </>
              )}
              
              {statusUpdate.status === 'delivered' && (
                <>
                  <div>
                    <Label>Delivery Date</Label>
                    <Input
                      type="date"
                      value={statusUpdate.delivery_date}
                      onChange={(e) => setStatusUpdate(prev => ({ ...prev, delivery_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Delivered By</Label>
                    <Input
                      value={statusUpdate.delivered_by}
                      onChange={(e) => setStatusUpdate(prev => ({ ...prev, delivered_by: e.target.value }))}
                      placeholder="Name of delivery person"
                    />
                  </div>
                </>
              )}
              
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={statusUpdate.remarks}
                  onChange={(e) => setStatusUpdate(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional notes"
                  rows={2}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancel</Button>
                <Button onClick={handleUpdateStatus} disabled={updating}>
                  {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
