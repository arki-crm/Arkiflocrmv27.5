import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { 
  Loader2, 
  Plus,
  Receipt,
  Search,
  Download,
  Eye,
  Ban,
  Pencil,
  Trash2,
  BookOpen,
  AlertTriangle,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' }
];

const Receipts = () => {
  const { hasPermission, user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Cancel receipt state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [receiptToCancel, setReceiptToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  // Delete receipt state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const [newReceipt, setNewReceipt] = useState({
    project_id: '',
    amount: '',
    payment_mode: '',
    account_id: '',
    stage_name: '',
    notes: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

  // Check if user is Founder or Admin
  const isFounderOrAdmin = user?.role === 'Founder' || user?.role === 'Admin';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [receiptsRes, projectsRes, accountsRes] = await Promise.all([
        axios.get(`${API}/finance/receipts`, { withCredentials: true }),
        axios.get(`${API}/finance/project-finance`, { withCredentials: true }),
        axios.get(`${API}/accounting/accounts`, { withCredentials: true })
      ]);
      setReceipts(receiptsRes.data);
      setProjects(projectsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddReceipt = async () => {
    if (!newReceipt.project_id || !newReceipt.amount || !newReceipt.payment_mode || !newReceipt.account_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${API}/finance/receipts`, {
        project_id: newReceipt.project_id,
        amount: parseFloat(newReceipt.amount),
        payment_mode: newReceipt.payment_mode,
        account_id: newReceipt.account_id,
        stage_name: newReceipt.stage_name || null,
        notes: newReceipt.notes || null,
        payment_date: newReceipt.payment_date
      }, { withCredentials: true });
      
      toast.success(`Receipt ${res.data.receipt_number} created`);
      setIsAddDialogOpen(false);
      setNewReceipt({ project_id: '', amount: '', payment_mode: '', account_id: '', stage_name: '', notes: '', payment_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceipt = async (receiptId) => {
    try {
      const res = await axios.get(`${API}/finance/receipts/${receiptId}`, { withCredentials: true });
      setViewReceipt(res.data);
    } catch (error) {
      toast.error('Failed to load receipt details');
    }
  };

  const handleDownloadPDF = async (receiptId, receiptNumber) => {
    try {
      toast.info('Generating PDF...');
      const res = await axios.get(`${API}/finance/receipts/${receiptId}/pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Receipt_${receiptNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Open cancel confirmation dialog
  const openCancelDialog = (receipt) => {
    setReceiptToCancel(receipt);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  // Handle receipt cancellation
  const handleCancelReceipt = async () => {
    if (!receiptToCancel) return;
    
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    try {
      setCancelling(true);
      const res = await axios.post(
        `${API}/finance/receipts/${receiptToCancel.receipt_id}/cancel`,
        { reason: cancelReason },
        { withCredentials: true }
      );
      
      toast.success(res.data.message || 'Receipt cancelled successfully');
      setCancelDialogOpen(false);
      setReceiptToCancel(null);
      setCancelReason('');
      
      // Close view dialog if open
      if (viewReceipt?.receipt_id === receiptToCancel.receipt_id) {
        setViewReceipt(null);
      }
      
      // Refresh data to update project financials
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel receipt');
    } finally {
      setCancelling(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (receipt) => {
    setReceiptToDelete(receipt);
    setDeleteDialogOpen(true);
  };

  // Handle receipt deletion (Founder/Admin only)
  const handleDeleteReceipt = async () => {
    if (!receiptToDelete) return;

    try {
      setDeleting(true);
      await axios.delete(
        `${API}/finance/receipts/${receiptToDelete.receipt_id}`,
        { withCredentials: true }
      );
      
      toast.success('Receipt deleted successfully');
      setDeleteDialogOpen(false);
      setReceiptToDelete(null);
      
      if (viewReceipt?.receipt_id === receiptToDelete.receipt_id) {
        setViewReceipt(null);
      }
      
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete receipt');
    } finally {
      setDeleting(false);
    }
  };

  // Navigate to General Ledger for the receipt's account
  const handleViewLedger = (receipt) => {
    // Open ledger in new tab or navigate
    window.open(`/finance/general-ledger?account_id=${receipt.account_id}`, '_blank');
  };

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = !search || 
      r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.pid?.toLowerCase().includes(search.toLowerCase()) ||
      r.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && r.status !== 'cancelled') ||
      (statusFilter === 'cancelled' && r.status === 'cancelled');
    
    return matchesSearch && matchesStatus;
  });

  // Get status badge
  const getStatusBadge = (status) => {
    if (status === 'cancelled') {
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          CANCELLED
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        ACTIVE
      </Badge>
    );
  };

  if (!hasPermission('finance.view_receipts')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don't have permission to view receipts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="receipts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Payment Receipts
          </h1>
          <p className="text-slate-500 text-sm mt-1">Record and manage customer payments</p>
        </div>
        {hasPermission('finance.add_receipt') && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Receipt
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by receipt number, PID, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Receipts List */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No receipts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receipt #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mode</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReceipts.map((receipt) => {
                    const isCancelled = receipt.status === 'cancelled';
                    return (
                      <tr key={receipt.receipt_id} className={cn("hover:bg-slate-50", isCancelled && "bg-red-50/30")}>
                        <td className="px-4 py-3">
                          <span className={cn("font-mono text-sm", isCancelled ? "text-slate-400 line-through" : "text-blue-600")}>
                            {receipt.receipt_number}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(receipt.payment_date)}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{receipt.pid}</span>
                          <p className="text-sm text-slate-700 mt-0.5">{receipt.project_name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{receipt.client_name}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-semibold", isCancelled ? "text-slate-400 line-through" : "text-green-600")}>
                            {formatCurrency(receipt.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(receipt.status)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">{receipt.payment_mode?.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleViewReceipt(receipt.receipt_id)} 
                              data-testid={`view-receipt-${receipt.receipt_id}`}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownloadPDF(receipt.receipt_id, receipt.receipt_number)} 
                              data-testid={`download-receipt-${receipt.receipt_id}`}
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4 text-blue-600" />
                            </Button>
                            {!isCancelled && hasPermission('finance.issue_refund') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openCancelDialog(receipt)}
                                data-testid={`cancel-receipt-${receipt.receipt_id}`}
                                title="Cancel Receipt"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Add Receipt Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment Receipt</DialogTitle>
            <DialogDescription>
              Create a receipt for incoming customer payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Project *</Label>
              <Select value={newReceipt.project_id} onValueChange={(v) => setNewReceipt(prev => ({ ...prev, project_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.pid_display} - {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={newReceipt.amount}
                  onChange={(e) => setNewReceipt(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="25000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={newReceipt.payment_mode} onValueChange={(v) => setNewReceipt(prev => ({ ...prev, payment_mode: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Receipt Date *</Label>
                <Input
                  type="date"
                  value={newReceipt.payment_date}
                  onChange={(e) => setNewReceipt(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="mt-1"
                  data-testid="receipt-date-input"
                />
                <p className="text-xs text-slate-500 mt-1">Date for Cashbook & Daily Closing</p>
              </div>
              <div>
                <Label>Account *</Label>
                <Select value={newReceipt.account_id} onValueChange={(v) => setNewReceipt(prev => ({ ...prev, account_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.account_id} value={a.account_id}>{a.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Payment Stage</Label>
              <Input
                value={newReceipt.stage_name}
                onChange={(e) => setNewReceipt(prev => ({ ...prev, stage_name: e.target.value }))}
                placeholder="e.g., Booking Amount, Design Payment"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newReceipt.notes}
                onChange={(e) => setNewReceipt(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddReceipt} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewReceipt} onOpenChange={(open) => !open && setViewReceipt(null)}>
        <DialogContent className="sm:max-w-[550px] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Receipt className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="break-words">Receipt {viewReceipt?.receipt_number}</span>
              {viewReceipt && (
                <span className="ml-2">
                  {getStatusBadge(viewReceipt.status)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewReceipt && (
            <div className="space-y-4 py-4 overflow-hidden">
              {/* Cancelled Banner */}
              {viewReceipt.status === 'cancelled' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-red-700">This receipt has been cancelled</p>
                      <p className="text-sm text-red-600 mt-1">
                        Cancelled by {viewReceipt.cancelled_by_name} on {formatDateTime(viewReceipt.cancelled_at)}
                      </p>
                      {viewReceipt.cancellation_reason && (
                        <p className="text-sm text-red-600 mt-1">
                          Reason: {viewReceipt.cancellation_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className={cn(
                "p-4 rounded-lg text-center w-full max-w-full overflow-hidden box-border",
                viewReceipt.status === 'cancelled' ? "bg-slate-100" : "bg-green-50"
              )}>
                <p className={cn(
                  "text-2xl sm:text-3xl font-bold break-words",
                  viewReceipt.status === 'cancelled' ? "text-slate-400 line-through" : "text-green-600"
                )}>
                  {formatCurrency(viewReceipt.amount)}
                </p>
                <p className={cn(
                  "text-sm mt-1",
                  viewReceipt.status === 'cancelled' ? "text-slate-500" : "text-green-700"
                )}>
                  {viewReceipt.status === 'cancelled' ? 'Payment Cancelled' : 'Payment Received'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Date</p>
                  <p className="font-medium">{formatDate(viewReceipt.payment_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Mode</p>
                  <p className="font-medium capitalize">{viewReceipt.payment_mode?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Account</p>
                  <p className="font-medium">{viewReceipt.account_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Stage</p>
                  <p className="font-medium">{viewReceipt.stage_name || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-slate-500 text-sm">Project</p>
                <p className="font-medium">{viewReceipt.project?.pid} - {viewReceipt.project?.project_name}</p>
                <p className="text-sm text-slate-600">{viewReceipt.project?.client_name}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Contract Value</span>
                  <span className="font-medium">{formatCurrency(viewReceipt.project?.contract_value)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Total Received</span>
                  <span className="font-medium text-green-600">{formatCurrency(viewReceipt.total_received)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-slate-700 font-medium">Balance Remaining</span>
                  <span className="font-bold">{formatCurrency(viewReceipt.balance_remaining)}</span>
                </div>
              </div>

              {viewReceipt.notes && (
                <div>
                  <p className="text-slate-500 text-sm">Notes</p>
                  <p className="text-sm">{viewReceipt.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* Actions based on receipt status */}
            {viewReceipt && viewReceipt.status !== 'cancelled' && (
              <>
                {hasPermission('finance.issue_refund') && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setViewReceipt(null);
                      openCancelDialog(viewReceipt);
                    }}
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    data-testid="cancel-receipt-btn"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Cancel Receipt
                  </Button>
                )}
                {isFounderOrAdmin && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setViewReceipt(null);
                      openDeleteDialog(viewReceipt);
                    }}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    data-testid="delete-receipt-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
              </>
            )}
            
            <Button 
              variant="outline"
              onClick={() => viewReceipt && handleViewLedger(viewReceipt)}
              data-testid="view-ledger-btn"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              View Ledger
            </Button>
            
            <Button 
              onClick={() => viewReceipt && handleDownloadPDF(viewReceipt.receipt_id, viewReceipt.receipt_number)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="download-pdf-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Receipt Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Cancel Receipt?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to cancel receipt <strong>{receiptToCancel?.receipt_number}</strong> for{' '}
                  <strong>{formatCurrency(receiptToCancel?.amount)}</strong>.
                </p>
                <div className="bg-orange-50 p-3 rounded-lg text-sm text-orange-800">
                  <p className="font-medium mb-1">This action will:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>Create reverse accounting entries</li>
                    <li>Reduce project advance received amount</li>
                    <li>Mark receipt as CANCELLED</li>
                  </ul>
                </div>
                <div>
                  <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
                  <Textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Enter reason for cancellation..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Receipt</AlertDialogCancel>
            <Button
              onClick={handleCancelReceipt}
              disabled={cancelling || !cancelReason.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {cancelling && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Cancel Receipt
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Receipt Confirmation Dialog (Founder/Admin only) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Receipt Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to permanently delete receipt <strong>{receiptToDelete?.receipt_number}</strong>.
                </p>
                <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800">
                  <p className="font-medium mb-1">Warning:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>This action cannot be undone</li>
                    <li>Only delete if receipt was never posted to accounting</li>
                    <li>Use "Cancel Receipt" instead for posted receipts</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep Receipt</AlertDialogCancel>
            <Button
              onClick={handleDeleteReceipt}
              disabled={deleting}
              variant="destructive"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Receipts;
