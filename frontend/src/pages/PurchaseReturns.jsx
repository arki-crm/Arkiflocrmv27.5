import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  Plus,
  Package,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Warehouse,
  Truck,
  Trash2,
  DollarSign,
  Banknote
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RETURN_REASONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'excess_quantity', label: 'Excess Quantity' },
  { value: 'other', label: 'Other' }
];

const REFUND_MODES = [
  { value: 'cash', label: 'Cash Refund' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'adjustment', label: 'Adjustment in Next Bill' },
  { value: 'no_refund', label: 'No Refund (Loss)' }
];

const ITEM_DISPOSITIONS = [
  { value: 'returned_to_vendor', label: 'Returned to Vendor' },
  { value: 'with_company_office', label: 'With Company - Office' },
  { value: 'with_company_site', label: 'With Company - Site' },
  { value: 'scrapped', label: 'Scrapped' },
  { value: 'vendor_rejected', label: 'Vendor Rejected' },
  { value: 'pending_decision', label: 'Pending Decision' }
];

const REFUND_STATUSES = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  no_refund: { label: 'No Refund', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const DISPOSITION_ICONS = {
  returned_to_vendor: Truck,
  with_company_office: Warehouse,
  with_company_site: Package,
  scrapped: Trash2,
  vendor_rejected: XCircle,
  pending_decision: AlertTriangle
};

export default function PurchaseReturns() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Refund settlement state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [refundData, setRefundData] = useState({
    refund_status: 'completed',
    actual_refund_received: 0,
    refund_date: new Date().toISOString().split('T')[0],
    refund_mode: 'bank_transfer',
    refund_account_id: '',
    loss_amount: 0,
    loss_reason: '',
    remarks: ''
  });
  const [submittingRefund, setSubmittingRefund] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    refund_status: '',
    item_disposition: '',
    from_date: '',
    to_date: ''
  });
  
  // Form state
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [formData, setFormData] = useState({
    linked_invoice_id: '',
    return_date: new Date().toISOString().split('T')[0],
    return_reason: '',
    return_reason_notes: '',
    items_returned: [{ item_name: '', qty: 1, rate: 0, amount: 0, notes: '' }],
    total_return_value: 0,
    expected_refund_amount: 0,
    refund_mode: 'bank',
    item_disposition: 'pending_decision',
    disposition_location: '',
    disposition_notes: '',
    remarks: ''
  });

  useEffect(() => {
    fetchReturns();
    fetchInvoices();
    fetchAccounts();
  }, [filters]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.refund_status) params.append('refund_status', filters.refund_status);
      if (filters.item_disposition) params.append('item_disposition', filters.item_disposition);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      
      const response = await axios.get(`${API}/finance/purchase-returns?${params}`, {
        withCredentials: true
      });
      setReturns(response.data);
    } catch (err) {
      console.error('Failed to fetch returns:', err);
      toast.error('Failed to load purchase returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API}/finance/execution-ledger`, {
        withCredentials: true
      });
      setInvoices(response.data.entries || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    }
  };
  
  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API}/accounting/accounts`, {
        withCredentials: true
      });
      setAccounts(response.data || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };
  
  // Open refund modal
  const openRefundModal = (returnItem) => {
    setSelectedReturn(returnItem);
    setRefundData({
      refund_status: 'completed',
      actual_refund_received: returnItem.expected_refund_amount || returnItem.total_return_value || 0,
      refund_date: new Date().toISOString().split('T')[0],
      refund_mode: returnItem.refund_mode || 'bank_transfer',
      refund_account_id: '',
      loss_amount: 0,
      loss_reason: '',
      remarks: ''
    });
    setShowRefundModal(true);
  };
  
  // Handle refund amount change and calculate loss
  const handleRefundAmountChange = (value) => {
    const amount = parseFloat(value) || 0;
    const expected = selectedReturn?.expected_refund_amount || selectedReturn?.total_return_value || 0;
    const loss = Math.max(0, expected - amount);
    setRefundData(prev => ({
      ...prev,
      actual_refund_received: amount,
      loss_amount: loss
    }));
  };
  
  // Submit refund settlement
  const handleSubmitRefund = async () => {
    if (!selectedReturn) return;
    
    if (refundData.refund_status !== 'no_refund' && !refundData.refund_account_id) {
      toast.error('Please select an account to receive the refund');
      return;
    }
    
    try {
      setSubmittingRefund(true);
      await axios.put(`${API}/finance/purchase-returns/${selectedReturn.return_id}/refund`, {
        refund_status: refundData.refund_status,
        actual_refund_received: refundData.refund_status === 'no_refund' ? 0 : refundData.actual_refund_received,
        refund_date: refundData.refund_date,
        refund_mode: refundData.refund_mode,
        refund_account_id: refundData.refund_account_id,
        loss_amount: refundData.loss_amount,
        loss_reason: refundData.loss_reason,
        remarks: refundData.remarks
      }, { withCredentials: true });
      
      toast.success('Refund recorded successfully');
      setShowRefundModal(false);
      setSelectedReturn(null);
      fetchReturns();
    } catch (err) {
      console.error('Failed to record refund:', err);
      toast.error(err.response?.data?.detail || 'Failed to record refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleInvoiceSelect = (invoiceId) => {
    const invoice = invoices.find(i => i.execution_id === invoiceId);
    setSelectedInvoice(invoice);
    setFormData(prev => ({
      ...prev,
      linked_invoice_id: invoiceId,
      total_return_value: 0,
      expected_refund_amount: 0
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items_returned];
    newItems[index][field] = value;
    
    if (field === 'qty' || field === 'rate') {
      newItems[index].amount = newItems[index].qty * newItems[index].rate;
    }
    
    const total = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      items_returned: newItems,
      total_return_value: total,
      expected_refund_amount: total
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items_returned: [...prev.items_returned, { item_name: '', qty: 1, rate: 0, amount: 0, notes: '' }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items_returned.length === 1) return;
    const newItems = formData.items_returned.filter((_, i) => i !== index);
    const total = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    setFormData(prev => ({
      ...prev,
      items_returned: newItems,
      total_return_value: total,
      expected_refund_amount: total
    }));
  };

  const handleSubmit = async () => {
    if (!formData.linked_invoice_id) {
      toast.error('Please select an invoice');
      return;
    }
    if (!formData.return_reason) {
      toast.error('Please select a return reason');
      return;
    }
    if (formData.total_return_value <= 0) {
      toast.error('Return value must be greater than 0');
      return;
    }
    
    try {
      setCreating(true);
      await axios.post(`${API}/finance/purchase-returns`, formData, {
        withCredentials: true
      });
      toast.success('Purchase return created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchReturns();
    } catch (err) {
      console.error('Failed to create return:', err);
      toast.error(err.response?.data?.detail || 'Failed to create purchase return');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedInvoice(null);
    setFormData({
      linked_invoice_id: '',
      return_date: new Date().toISOString().split('T')[0],
      return_reason: '',
      return_reason_notes: '',
      items_returned: [{ item_name: '', qty: 1, rate: 0, amount: 0, notes: '' }],
      total_return_value: 0,
      expected_refund_amount: 0,
      refund_mode: 'bank',
      item_disposition: 'pending_decision',
      disposition_location: '',
      disposition_notes: '',
      remarks: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Purchase Returns</h1>
            <p className="text-sm text-slate-500">Manage returns against purchase invoices</p>
          </div>
        </div>
        {hasPermission('finance.liabilities.create') && (
          <Button onClick={() => setShowCreateModal(true)} data-testid="create-return-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-40">
              <Label className="text-xs">Refund Status</Label>
              <Select value={filters.refund_status || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, refund_status: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_refund">No Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Item Disposition</Label>
              <Select value={filters.item_disposition || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, item_disposition: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ITEM_DISPOSITIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                className="h-9"
                value={filters.from_date}
                onChange={(e) => setFilters(prev => ({ ...prev, from_date: e.target.value }))}
              />
            </div>
            <div className="w-36">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                className="h-9"
                value={filters.to_date}
                onChange={(e) => setFilters(prev => ({ ...prev, to_date: e.target.value }))}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setFilters({ refund_status: '', item_disposition: '', from_date: '', to_date: '' })}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Returns List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No purchase returns found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Return ID</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Date</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Vendor</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Reason</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Value</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Refund Status</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Item Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {returns.map((ret) => {
                    const refundInfo = REFUND_STATUSES[ret.refund_status] || REFUND_STATUSES.pending;
                    const RefundIcon = refundInfo.icon;
                    const DispositionIcon = DISPOSITION_ICONS[ret.item_disposition] || Package;
                    
                    return (
                      <tr key={ret.return_id} className="hover:bg-slate-50" data-testid={`return-row-${ret.return_id}`}>
                        <td className="p-3">
                          <span className="font-mono text-sm text-blue-600">{ret.return_id}</span>
                        </td>
                        <td className="p-3 text-sm">{ret.return_date}</td>
                        <td className="p-3 text-sm">{ret.vendor_name || 'Unknown'}</td>
                        <td className="p-3 text-sm capitalize">{ret.return_reason?.replace(/_/g, ' ')}</td>
                        <td className="p-3 text-sm text-right font-medium">{formatCurrency(ret.total_return_value)}</td>
                        <td className="p-3 text-center">
                          <Badge className={`${refundInfo.color} text-xs`}>
                            <RefundIcon className="w-3 h-3 mr-1" />
                            {refundInfo.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">
                            <DispositionIcon className="w-3 h-3 mr-1" />
                            {ITEM_DISPOSITIONS.find(d => d.value === ret.item_disposition)?.label || ret.item_disposition}
                          </Badge>
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

      {/* Create Return Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Return</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Invoice Selection */}
            <div>
              <Label>Select Purchase Invoice *</Label>
              <Select value={formData.linked_invoice_id} onValueChange={handleInvoiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map(inv => (
                    <SelectItem key={inv.execution_id} value={inv.execution_id}>
                      {inv.invoice_no || inv.execution_id} - {inv.vendor_name} - {formatCurrency(inv.grand_total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInvoice && (
                <p className="text-xs text-slate-500 mt-1">
                  Invoice Total: {formatCurrency(selectedInvoice.grand_total)} | 
                  Existing Returns: {formatCurrency(selectedInvoice.total_returns || 0)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={formData.return_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Return Reason *</Label>
                <Select value={formData.return_reason} onValueChange={(v) => setFormData(prev => ({ ...prev, return_reason: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items Returned</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formData.items_returned.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded">
                    <Input
                      placeholder="Item name"
                      className="flex-1 h-8"
                      value={item.item_name}
                      onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      className="w-16 h-8"
                      value={item.qty}
                      onChange={(e) => updateItem(idx, 'qty', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      placeholder="Rate"
                      className="w-24 h-8"
                      value={item.rate}
                      onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                    />
                    <span className="w-24 text-sm text-right font-medium">{formatCurrency(item.amount)}</span>
                    {formData.items_returned.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                        <XCircle className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 font-medium">
                Total: {formatCurrency(formData.total_return_value)}
              </div>
            </div>

            {/* Refund Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expected Refund</Label>
                <Input
                  type="number"
                  value={formData.expected_refund_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_refund_amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Refund Mode</Label>
                <Select value={formData.refund_mode} onValueChange={(v) => setFormData(prev => ({ ...prev, refund_mode: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Item Disposition */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Item Disposition *</Label>
                <Select value={formData.item_disposition} onValueChange={(v) => setFormData(prev => ({ ...prev, item_disposition: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_DISPOSITIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location (if with company)</Label>
                <Input
                  placeholder="e.g., Office Godown"
                  value={formData.disposition_location}
                  onChange={(e) => setFormData(prev => ({ ...prev, disposition_location: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea
                placeholder="Additional notes..."
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
