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
  FileText,
  Loader2,
  Plus,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  Clock,
  XCircle,
  Building2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  issued: { label: 'Issued', color: 'bg-blue-100 text-blue-700', icon: FileText },
  utilized: { label: 'Utilized', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partial: { label: 'Partially Used', color: 'bg-amber-100 text-amber-700', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export default function CreditNotes() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [salesReturns, setSalesReturns] = useState([]);
  const [creating, setCreating] = useState(false);
  
  const [filters, setFilters] = useState({
    status: '',
    from_date: '',
    to_date: ''
  });
  
  const [formData, setFormData] = useState({
    linked_return_id: '',
    credit_note_date: new Date().toISOString().split('T')[0],
    amount: 0,
    gst_amount: 0,
    reason: '',
    remarks: ''
  });

  useEffect(() => {
    fetchCreditNotes();
    fetchSalesReturns();
  }, [filters]);

  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      
      const response = await axios.get(`${API}/finance/credit-notes?${params}`, {
        withCredentials: true
      });
      setCreditNotes(response.data || []);
    } catch (err) {
      console.error('Failed to fetch credit notes:', err);
      toast.error('Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReturns = async () => {
    try {
      const response = await axios.get(`${API}/finance/sales-returns`, {
        withCredentials: true
      });
      // Filter returns that don't have credit notes yet
      const returns = response.data || [];
      setSalesReturns(returns.filter(r => !r.linked_credit_note_id));
    } catch (err) {
      console.error('Failed to fetch sales returns:', err);
    }
  };

  const handleSelectReturn = (returnId) => {
    const selectedReturn = salesReturns.find(r => r.return_id === returnId);
    if (selectedReturn) {
      setFormData(prev => ({
        ...prev,
        linked_return_id: returnId,
        amount: selectedReturn.total_return_value || 0,
        reason: `Sales Return - ${selectedReturn.return_reason || 'Customer return'}`
      }));
    }
  };

  const handleCreate = async () => {
    if (!formData.linked_return_id) {
      toast.error('Please select a sales return');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setCreating(true);
      await axios.post(`${API}/finance/credit-notes`, formData, {
        withCredentials: true
      });
      toast.success('Credit note created successfully');
      setShowCreateModal(false);
      setFormData({
        linked_return_id: '',
        credit_note_date: new Date().toISOString().split('T')[0],
        amount: 0,
        gst_amount: 0,
        reason: '',
        remarks: ''
      });
      fetchCreditNotes();
      fetchSalesReturns();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create credit note');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const totalIssued = creditNotes.reduce((sum, cn) => sum + (cn.total_amount || 0), 0);
  const totalUtilized = creditNotes.reduce((sum, cn) => sum + (cn.utilized_amount || 0), 0);
  const totalBalance = creditNotes.reduce((sum, cn) => sum + (cn.balance_amount || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="credit-notes-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Credit Notes</h1>
            <p className="text-sm text-slate-500">Manage credit notes for sales returns</p>
          </div>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button data-testid="create-credit-note-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Credit Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Credit Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Link to Sales Return *</Label>
                <Select value={formData.linked_return_id} onValueChange={handleSelectReturn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sales return" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReturns.length === 0 ? (
                      <SelectItem value="none" disabled>No eligible sales returns</SelectItem>
                    ) : (
                      salesReturns.map(ret => (
                        <SelectItem key={ret.return_id} value={ret.return_id}>
                          {ret.return_id} - {ret.customer_name} - {formatCurrency(ret.total_return_value)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Credit Note Date *</Label>
                  <Input
                    type="date"
                    value={formData.credit_note_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, credit_note_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <Label>GST Amount</Label>
                <Input
                  type="number"
                  value={formData.gst_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, gst_amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Input
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Reason for credit note"
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
                  Create Credit Note
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Issued</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totalIssued)}</p>
                <p className="text-xs text-slate-400">{creditNotes.length} notes</p>
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
                <p className="text-xs text-slate-500">Utilized</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalUtilized)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Balance</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(totalBalance)}</p>
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
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="partial">Partially Used</SelectItem>
                  <SelectItem value="utilized">Fully Utilized</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFilters({ status: '', from_date: '', to_date: '' })}
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
          ) : creditNotes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No credit notes found</p>
              <p className="text-sm mt-1">Create a credit note for sales returns</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Credit Note ID</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Date</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Customer</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Linked Return</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Amount</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">GST</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Balance</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {creditNotes.map((cn) => {
                    const statusInfo = STATUS_CONFIG[cn.status] || STATUS_CONFIG.issued;
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <tr key={cn.credit_note_id} className="hover:bg-slate-50" data-testid={`credit-note-row-${cn.credit_note_id}`}>
                        <td className="p-3">
                          <span className="font-mono text-sm text-blue-600">{cn.credit_note_id}</span>
                        </td>
                        <td className="p-3 text-sm text-slate-600">{cn.credit_note_date}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">{cn.customer_name || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-xs text-slate-500">{cn.linked_return_id}</span>
                        </td>
                        <td className="p-3 text-right text-sm font-medium">{formatCurrency(cn.amount)}</td>
                        <td className="p-3 text-right text-sm text-slate-500">{formatCurrency(cn.gst_amount)}</td>
                        <td className="p-3 text-right text-sm font-medium text-amber-600">{formatCurrency(cn.balance_amount)}</td>
                        <td className="p-3 text-center">
                          <Badge className={`${statusInfo.color} text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
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
    </div>
  );
}
