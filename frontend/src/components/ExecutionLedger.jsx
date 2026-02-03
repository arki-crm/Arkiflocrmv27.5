import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Package,
  Wrench,
  Truck,
  Building,
  Hammer,
  Box,
  Loader2,
  FileText,
  ChevronDown,
  ChevronRight,
  Pencil,
  History,
  CreditCard,
  Banknote,
  Link2,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Percent,
  Tag
} from 'lucide-react';
import VendorSelect from './VendorSelect';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_ICONS = {
  "Modular Material": Package,
  "Hardware & Accessories": Wrench,
  "Factory / Job Work": Building,
  "Installation": Hammer,
  "Transportation / Logistics": Truck,
  "Non-Modular Furniture": Box,
  "Site Expense": ClipboardList
};

const CATEGORY_COLORS = {
  "Modular Material": "bg-blue-100 text-blue-800",
  "Hardware & Accessories": "bg-purple-100 text-purple-800",
  "Factory / Job Work": "bg-orange-100 text-orange-800",
  "Installation": "bg-green-100 text-green-800",
  "Transportation / Logistics": "bg-yellow-100 text-yellow-800",
  "Non-Modular Furniture": "bg-pink-100 text-pink-800",
  "Site Expense": "bg-slate-100 text-slate-800"
};

const PAYMENT_STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800', icon: CheckCircle }
};

const UNITS = ['pcs', 'sqft', 'rft', 'kg', 'meter', 'set', 'nos', 'lot'];
const PAYMENT_MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'card'];

const formatCurrency = (val) => {
  if (val === null || val === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Empty line item template
const emptyLineItem = {
  category: '',
  material_name: '',
  specification: '',
  brand: '',
  quantity: '',
  unit: 'pcs',
  rate: '',
  // GST fields (optional)
  hsn_code: '',
  cgst_percent: '',
  sgst_percent: '',
  igst_percent: ''
};

// Empty form template
const emptyForm = {
  vendor_id: '',
  vendor_name: '',
  invoice_no: '',
  invoice_date: '',
  execution_date: new Date().toISOString().split('T')[0],
  purchase_type: 'credit',
  items: [{ ...emptyLineItem }],
  discount_type: '',  // 'flat' or 'percentage'
  discount_value: '',  // Amount or percentage value
  remarks: ''
};

// Empty payment form
const emptyPaymentForm = {
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  payment_mode: 'bank_transfer',
  account_id: '',
  remarks: ''
};

export default function ExecutionLedger({ projectId, userRole, accounts = [] }) {
  const { hasPermission } = useAuth();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingEntry, setPayingEntry] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ ...emptyPaymentForm });
  const [recordingPayment, setRecordingPayment] = useState(false);
  
  // Expanded entries (for viewing line items)
  const [expandedEntries, setExpandedEntries] = useState({});
  
  // Filter
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all');
  
  // Form state - Invoice-based
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [projectId, filterCategory]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API}/api/finance/execution-ledger/categories`, { credentials: 'include' });
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = filterCategory && filterCategory !== 'all' 
        ? `${API}/api/finance/execution-ledger/project/${projectId}?category=${filterCategory}`
        : `${API}/api/finance/execution-ledger/project/${projectId}`;
      
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      
      setEntries(data.entries || []);
      setSummary(data.summary_by_category || {});
      setTotalValue(data.total_value || 0);
    } catch (error) {
      console.error('Failed to fetch execution entries:', error);
      toast.error('Failed to load invoice entries');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingEntry(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setForm({
      vendor_id: entry.vendor_id || '',
      vendor_name: entry.vendor_name || '',
      invoice_no: entry.invoice_no || '',
      invoice_date: entry.invoice_date || '',
      execution_date: entry.execution_date || '',
      purchase_type: entry.purchase_type || 'credit',
      items: entry.items?.map(item => ({
        category: item.category || '',
        material_name: item.material_name || '',
        specification: item.specification || '',
        brand: item.brand || '',
        quantity: item.quantity?.toString() || '',
        unit: item.unit || 'pcs',
        rate: item.rate?.toString() || '',
        // GST fields
        hsn_code: item.hsn_code || '',
        cgst_percent: item.cgst_percent?.toString() || '',
        sgst_percent: item.sgst_percent?.toString() || '',
        igst_percent: item.igst_percent?.toString() || ''
      })) || [{ ...emptyLineItem }],
      discount_type: entry.discount_type || '',
      discount_value: entry.discount_value?.toString() || '',
      remarks: entry.remarks || ''
    });
    setShowModal(true);
  };

  const openPaymentModal = (entry) => {
    setPayingEntry(entry);
    const remaining = (entry.amount_remaining !== undefined) ? entry.amount_remaining : entry.total_value;
    setPaymentForm({
      ...emptyPaymentForm,
      amount: remaining.toString()
    });
    setShowPaymentModal(true);
  };

  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...emptyLineItem }]
    }));
  };

  const removeLineItem = (index) => {
    if (form.items.length === 1) {
      toast.error('At least one line item is required');
      return;
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateTotal = () => {
    return form.items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      return sum + (qty * rate);
    }, 0);
  };

  // Calculate GST totals from all line items
  const calculateGSTTotals = () => {
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    
    form.items.forEach(item => {
      const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
      const cgstPercent = parseFloat(item.cgst_percent) || 0;
      const sgstPercent = parseFloat(item.sgst_percent) || 0;
      const igstPercent = parseFloat(item.igst_percent) || 0;
      
      totalCGST += (lineTotal * cgstPercent / 100);
      totalSGST += (lineTotal * sgstPercent / 100);
      totalIGST += (lineTotal * igstPercent / 100);
    });
    
    return {
      totalCGST,
      totalSGST,
      totalIGST,
      totalGST: totalCGST + totalSGST + totalIGST
    };
  };

  // Calculate discount amount based on type
  const calculateDiscountAmount = () => {
    const grossTotal = calculateTotal();
    const discountValue = parseFloat(form.discount_value) || 0;
    
    if (!form.discount_type || discountValue <= 0) return 0;
    
    if (form.discount_type === 'flat') {
      return Math.min(discountValue, grossTotal);
    } else if (form.discount_type === 'percentage') {
      return (grossTotal * Math.min(discountValue, 100)) / 100;
    }
    return 0;
  };

  // Net taxable = Gross - Discount (before GST)
  const calculateNetTaxable = () => {
    return calculateTotal() - calculateDiscountAmount();
  };

  // Grand Total = Net Taxable + GST (final vendor payable)
  const calculateGrandTotal = () => {
    const netTaxable = calculateNetTaxable();
    const { totalGST } = calculateGSTTotals();
    return netTaxable + totalGST;
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.vendor_name) {
      toast.error('Please select or enter a vendor');
      return;
    }
    if (!form.execution_date) {
      toast.error('Please enter execution date');
      return;
    }
    
    // Validate line items
    const validItems = form.items.filter(item => 
      item.category && item.material_name && item.quantity && item.rate
    );
    
    if (validItems.length === 0) {
      toast.error('Please add at least one complete line item (category, material, quantity, rate)');
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        project_id: projectId,
        vendor_id: form.vendor_id || null,
        vendor_name: form.vendor_name,
        invoice_no: form.invoice_no || null,
        invoice_date: form.invoice_date || null,
        execution_date: form.execution_date,
        purchase_type: form.purchase_type,
        items: validItems.map(item => ({
          category: item.category,
          material_name: item.material_name,
          specification: item.specification || null,
          brand: item.brand || null,
          quantity: parseFloat(item.quantity),
          unit: item.unit || 'pcs',
          rate: parseFloat(item.rate),
          // GST fields (optional)
          hsn_code: item.hsn_code || null,
          cgst_percent: item.cgst_percent ? parseFloat(item.cgst_percent) : null,
          sgst_percent: item.sgst_percent ? parseFloat(item.sgst_percent) : null,
          igst_percent: item.igst_percent ? parseFloat(item.igst_percent) : null
        })),
        // Discount fields
        discount_type: form.discount_type || null,
        discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
        remarks: form.remarks || null
      };

      const url = editingEntry 
        ? `${API}/api/finance/execution-ledger/${editingEntry.execution_id}`
        : `${API}/api/finance/execution-ledger`;
      
      const method = editingEntry ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to save entry');
      }

      toast.success(editingEntry ? 'Invoice entry updated successfully' : 'Invoice entry saved successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payingEntry) return;
    
    // Validation
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    
    const remaining = payingEntry.amount_remaining ?? payingEntry.total_value;
    if (amount > remaining) {
      toast.error(`Payment amount cannot exceed remaining balance (${formatCurrency(remaining)})`);
      return;
    }
    
    if (!paymentForm.account_id) {
      toast.error('Please select a payment account');
      return;
    }
    
    if (!paymentForm.payment_date) {
      toast.error('Please enter payment date');
      return;
    }

    try {
      setRecordingPayment(true);
      
      const res = await fetch(`${API}/api/finance/execution-ledger/${payingEntry.execution_id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: amount,
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          account_id: paymentForm.account_id,
          remarks: paymentForm.remarks || null
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to record payment');
      }

      const result = await res.json();
      toast.success(result.message || 'Payment recorded successfully');
      setShowPaymentModal(false);
      setPayingEntry(null);
      setPaymentForm({ ...emptyPaymentForm });
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    
    try {
      const res = await fetch(`${API}/api/finance/execution-ledger/${deletingEntry.execution_id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to delete entry');
      }

      toast.success('Entry deleted');
      setDeletingEntry(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete entry');
    }
  };

  const toggleExpanded = (entryId) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  // Permission check - Finance users with proper permissions can add entries
  const canEdit = ['Admin', 'Founder', 'ProjectManager'].includes(userRole) || 
                  hasPermission('finance.execution_ledger.create') ||
                  hasPermission('finance.add_transaction') ||
                  hasPermission('finance.cashbook.create');
  const canDelete = userRole === 'Admin';
  const canRecordPayment = ['Admin', 'Founder', 'SeniorAccountant', 'FinanceManager', 'ProjectManager'].includes(userRole);

  // Filter entries by payment status
  const filteredEntries = filterPaymentStatus === 'all' 
    ? entries 
    : entries.filter(e => (e.payment_status || 'unpaid') === filterPaymentStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="execution-ledger">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Purchase Invoices
          </h3>
          <p className="text-sm text-gray-500">
            {filteredEntries.length} purchase invoice(s) • Total: {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {canEdit && (
            <Button onClick={openCreateModal} data-testid="add-purchase-invoice">
              <Plus className="h-4 w-4 mr-2" />
              Add Purchase Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(summary).map(([cat, data]) => {
            const Icon = CATEGORY_ICONS[cat] || Package;
            const colorClass = CATEGORY_COLORS[cat] || "bg-gray-100 text-gray-800";
            return (
              <Card key={cat} className="p-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${colorClass}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{cat}</p>
                    <p className="text-sm font-semibold">{formatCurrency(data.total_value)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700">No Invoice Entries</h3>
            <p className="text-gray-500 mt-1">Add vendor invoices to track material execution and payments</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedEntries[entry.execution_id];
            const hasPayments = entry.payments?.length > 0;
            const hasEditHistory = entry.edit_history?.length > 0;
            const paymentStatus = entry.payment_status || 'unpaid';
            const statusConfig = PAYMENT_STATUS_CONFIG[paymentStatus];
            const StatusIcon = statusConfig?.icon || AlertCircle;
            const remaining = entry.amount_remaining ?? entry.total_value;
            const totalPaid = entry.total_paid || 0;
            
            return (
              <Card key={entry.execution_id} className="overflow-hidden" data-testid={`invoice-entry-${entry.execution_id}`}>
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => toggleExpanded(entry.execution_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-gray-400">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.vendor_name}</span>
                        {entry.invoice_no && (
                          <Badge variant="outline" className="text-xs">
                            Inv# {entry.invoice_no}
                          </Badge>
                        )}
                        <Badge variant={entry.purchase_type === 'cash' ? 'secondary' : 'default'} className="text-xs">
                          {entry.purchase_type === 'cash' ? <Banknote className="h-3 w-3 mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                          {entry.purchase_type === 'cash' ? 'Cash' : 'Credit'}
                        </Badge>
                        <Badge className={`${statusConfig?.color} text-xs`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig?.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        {formatDate(entry.execution_date)} • {entry.item_count || entry.items?.length || 0} items
                        {hasPayments && (
                          <span className="text-green-600">
                            • {entry.payments.length} payment(s)
                          </span>
                        )}
                        {hasEditHistory && (
                          <span className="flex items-center text-amber-600">
                            <History className="h-3 w-3 mr-1" />
                            Edited {entry.edit_history.length}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {/* Show gross and discount if discount exists */}
                      {entry.discount_amount > 0 ? (
                        <>
                          <p className="text-xs text-gray-400 line-through">{formatCurrency(entry.gross_total)}</p>
                          <p className="font-semibold text-lg flex items-center justify-end gap-1">
                            {formatCurrency(entry.net_payable || entry.total_value)}
                            <span className="text-xs font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              -{entry.discount_type === 'percentage' 
                                ? `${entry.discount_value}%` 
                                : formatCurrency(entry.discount_amount)}
                            </span>
                          </p>
                        </>
                      ) : (
                        <p className="font-semibold text-lg">{formatCurrency(entry.total_value)}</p>
                      )}
                      {paymentStatus !== 'unpaid' && (
                        <p className="text-xs text-gray-500">
                          Paid: <span className="text-green-600">{formatCurrency(totalPaid)}</span>
                          {remaining > 0 && (
                            <> | Due: <span className="text-red-600">{formatCurrency(remaining)}</span></>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {canRecordPayment && paymentStatus !== 'paid' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openPaymentModal(entry)}
                          title="Record payment"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          data-testid={`record-payment-${entry.execution_id}`}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Pay
                        </Button>
                      )}
                      {canEdit && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditModal(entry)}
                          title="Edit invoice"
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      {canDelete && !hasPayments && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setDeletingEntry(entry)}
                          title="Delete invoice"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    {/* Line Items Table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Specification</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(entry.items || []).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge className={`${CATEGORY_COLORS[item.category] || 'bg-gray-100'} text-xs`}>
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{item.material_name}</TableCell>
                            <TableCell className="text-gray-500">{item.specification || '-'}</TableCell>
                            <TableCell className="text-gray-500">{item.brand || '-'}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.line_total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Discount Summary in expanded view */}
                    {entry.discount_amount > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Gross Total:</span>
                          <span className="font-medium">{formatCurrency(entry.gross_total)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-700">
                          <span>Vendor Discount ({entry.discount_type === 'percentage' ? `${entry.discount_value}%` : 'Flat'}):</span>
                          <span className="font-medium">−{formatCurrency(entry.discount_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold pt-1 mt-1 border-t border-amber-300">
                          <span>Net Payable:</span>
                          <span className="text-emerald-700">{formatCurrency(entry.net_payable || entry.total_value)}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Payment History */}
                    {hasPayments && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Payment History
                        </h4>
                        <div className="space-y-2">
                          {entry.payments.map((pmt, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                              <div>
                                <span className="font-medium">{formatCurrency(pmt.amount)}</span>
                                <span className="text-gray-500 ml-2">via {pmt.payment_mode}</span>
                                {pmt.account_name && (
                                  <span className="text-gray-400 ml-1">({pmt.account_name})</span>
                                )}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {formatDate(pmt.payment_date)} by {pmt.recorded_by_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {entry.remarks && (
                      <p className="text-sm text-gray-500 mt-3 pt-3 border-t">
                        <strong>Remarks:</strong> {entry.remarks}
                      </p>
                    )}
                    
                    {hasEditHistory && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-400 mb-1">Edit History:</p>
                        {entry.edit_history.slice(-3).map((edit, idx) => (
                          <p key={idx} className="text-xs text-gray-500">
                            {formatDate(edit.edited_at)} by {edit.edited_by_name}: {edit.changes?.join(', ') || 'Modified'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Purchase Invoice Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Edit Purchase Invoice' : 'Add Purchase Invoice'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Invoice Header */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <VendorSelect
                  value={form.vendor_id}
                  onChange={(vendorId, vendorName) => setForm(prev => ({ 
                    ...prev, 
                    vendor_id: vendorId, 
                    vendor_name: vendorName 
                  }))}
                  label="Vendor"
                  required
                  placeholder="Select or create vendor..."
                />
              </div>
              
              <div>
                <Label>Invoice No</Label>
                <Input
                  value={form.invoice_no}
                  onChange={(e) => setForm(prev => ({ ...prev, invoice_no: e.target.value }))}
                  placeholder="e.g., INV-2024-001"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Execution Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.execution_date}
                  onChange={(e) => setForm(prev => ({ ...prev, execution_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              {/* Purchase Type */}
              <div>
                <Label>Purchase Type <span className="text-red-500">*</span></Label>
                <RadioGroup 
                  value={form.purchase_type} 
                  onValueChange={(v) => setForm(prev => ({ ...prev, purchase_type: v }))}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="credit" id="credit" />
                    <Label htmlFor="credit" className="flex items-center cursor-pointer">
                      <CreditCard className="h-4 w-4 mr-1" /> Credit Purchase
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center cursor-pointer">
                      <Banknote className="h-4 w-4 mr-1" /> Cash Purchase
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Category *</TableHead>
                      <TableHead>Material *</TableHead>
                      <TableHead className="w-[100px]">Spec</TableHead>
                      <TableHead className="w-[80px]">Brand</TableHead>
                      <TableHead className="w-[70px]">Qty *</TableHead>
                      <TableHead className="w-[70px]">Unit</TableHead>
                      <TableHead className="w-[90px]">Rate *</TableHead>
                      <TableHead className="w-[90px] text-right">Total</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((item, idx) => {
                      const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="p-1">
                            <Select 
                              value={item.category} 
                              onValueChange={(v) => updateLineItem(idx, 'category', v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.material_name}
                              onChange={(e) => updateLineItem(idx, 'material_name', e.target.value)}
                              placeholder="Material name"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.specification}
                              onChange={(e) => updateLineItem(idx, 'specification', e.target.value)}
                              placeholder="Spec"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.brand}
                              onChange={(e) => updateLineItem(idx, 'brand', e.target.value)}
                              placeholder="Brand"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Select 
                              value={item.unit} 
                              onValueChange={(v) => updateLineItem(idx, 'unit', v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS.map(u => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateLineItem(idx, 'rate', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell className="p-1 text-right font-medium">
                            {formatCurrency(lineTotal)}
                          </TableCell>
                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeLineItem(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Discount & Total Section */}
              <div className="flex justify-between items-start mt-3 gap-4">
                {/* Discount Section */}
                <div className="flex-1 border rounded-lg p-3 bg-amber-50">
                  <Label className="text-sm font-medium flex items-center gap-1 mb-2">
                    <Tag className="h-4 w-4 text-amber-600" />
                    Vendor Discount (if any)
                  </Label>
                  <div className="flex gap-3 items-center">
                    <Select
                      value={form.discount_type}
                      onValueChange={(v) => setForm(prev => ({ 
                        ...prev, 
                        discount_type: v,
                        discount_value: v ? prev.discount_value : '' // Clear value if type cleared
                      }))}
                    >
                      <SelectTrigger className="w-[120px] h-9">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat (₹)</SelectItem>
                        <SelectItem value="percentage">Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                        {form.discount_type === 'percentage' ? '%' : '₹'}
                      </span>
                      <Input
                        type="number"
                        value={form.discount_value}
                        onChange={(e) => setForm(prev => ({ ...prev, discount_value: e.target.value }))}
                        placeholder="0"
                        className="pl-6 h-9"
                        disabled={!form.discount_type}
                      />
                    </div>
                    {form.discount_type && form.discount_value && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9"
                        onClick={() => setForm(prev => ({ ...prev, discount_type: '', discount_value: '' }))}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Total Summary */}
                <div className="text-right min-w-[180px]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Gross Total:</span>
                      <span className="font-medium">{formatCurrency(calculateTotal())}</span>
                    </div>
                    {calculateDiscountAmount() > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Discount:</span>
                        <span className="font-medium">−{formatCurrency(calculateDiscountAmount())}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t">
                      <span className="font-semibold">Net Payable:</span>
                      <span className="text-xl font-bold text-emerald-700">{formatCurrency(calculateNetPayable())}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Any additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Note:</strong> This creates an invoice record only. Use the &quot;Pay&quot; button after saving to record payments and create Cashbook entries.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : (editingEntry ? 'Update Entry' : 'Save Entry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          
          {payingEntry && (
            <div className="space-y-4 py-4">
              {/* Invoice Summary */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium">{payingEntry.vendor_name}</p>
                {payingEntry.invoice_no && (
                  <p className="text-sm text-gray-500">Invoice: {payingEntry.invoice_no}</p>
                )}
                {/* Show gross and discount if discount exists */}
                {payingEntry.discount_amount > 0 && (
                  <>
                    <div className="flex justify-between mt-2 text-sm text-gray-500">
                      <span>Gross Total:</span>
                      <span>{formatCurrency(payingEntry.gross_total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Discount ({payingEntry.discount_type === 'percentage' ? `${payingEntry.discount_value}%` : 'Flat'}):</span>
                      <span>−{formatCurrency(payingEntry.discount_amount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between mt-2 text-sm">
                  <span>Net Payable:</span>
                  <span className="font-semibold">{formatCurrency(payingEntry.net_payable || payingEntry.total_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Already Paid:</span>
                  <span className="text-green-600">{formatCurrency(payingEntry.total_paid || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                  <span>Remaining:</span>
                  <span className="text-red-600">{formatCurrency(payingEntry.amount_remaining ?? payingEntry.total_value)}</span>
                </div>
              </div>
              
              {/* Payment Form */}
              <div>
                <Label>Payment Amount <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Payment Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Payment Mode <span className="text-red-500">*</span></Label>
                <Select 
                  value={paymentForm.payment_mode} 
                  onValueChange={(v) => setPaymentForm(prev => ({ ...prev, payment_mode: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(mode => (
                      <SelectItem key={mode} value={mode}>
                        {mode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Payment Account <span className="text-red-500">*</span></Label>
                <Select 
                  value={paymentForm.account_id} 
                  onValueChange={(v) => setPaymentForm(prev => ({ ...prev, account_id: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.account_id} value={acc.account_id}>
                        {acc.name} ({formatCurrency(acc.current_balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional payment notes..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              
              {/* Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                This will automatically create a Cashbook outflow entry and update the invoice payment status.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPaymentModal(false); setPayingEntry(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleRecordPayment} 
              disabled={recordingPayment}
              className="bg-green-600 hover:bg-green-700"
            >
              {recordingPayment ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Recording...</>
              ) : (
                <><DollarSign className="h-4 w-4 mr-2" /> Record Payment</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={() => setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the invoice entry for &quot;{deletingEntry?.vendor_name}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
