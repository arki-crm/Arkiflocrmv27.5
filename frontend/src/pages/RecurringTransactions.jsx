import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { RefreshCw, Plus, Play, Pause, Calendar, Edit2, Loader2, CheckCircle, XCircle, CreditCard, AlertTriangle, Clock, IndianRupee } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RecurringTransactions() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('payables');
  const [templates, setTemplates] = useState([]);
  const [payables, setPayables] = useState([]);
  const [payableSummary, setPayableSummary] = useState({ pending: 0, overdue: 0, total_pending_amount: 0 });
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [payingPayable, setPayingPayable] = useState(null);
  const [runningScheduled, setRunningScheduled] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [processing, setProcessing] = useState(null);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    amount: '',
    category_id: '',
    account_id: '',
    day_of_month: 1,
    description: '',
    paid_to: ''
  });

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: '',
    mode: 'bank_transfer',
    remarks: ''
  });

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API}/api/finance/recurring/templates`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      toast.error('Failed to fetch templates');
    }
  };

  const fetchPayables = async () => {
    try {
      const res = await fetch(`${API}/api/finance/recurring/payables`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPayables(data.payables || []);
        setPayableSummary(data.summary || { pending: 0, overdue: 0, total_pending_amount: 0 });
      }
    } catch (err) {
      toast.error('Failed to fetch payables');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndAccounts = async () => {
    try {
      const [catRes, accRes] = await Promise.all([
        fetch(`${API}/api/accounting/categories`, { credentials: 'include' }),
        fetch(`${API}/api/accounting/accounts`, { credentials: 'include' })
      ]);
      
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || catData || []);
      }
      
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData.accounts || accData || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories/accounts:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPayables();
    fetchCategoriesAndAccounts();
  }, []);

  const handleCreateTemplate = async () => {
    if (!form.name || !form.amount || !form.category_id || !form.account_id) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const res = await fetch(`${API}/api/finance/recurring/templates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          amount: parseFloat(form.amount),
          category_id: form.category_id,
          account_id: form.account_id,
          day_of_month: parseInt(form.day_of_month),
          description: form.description || form.name,
          paid_to: form.paid_to
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create template');
      }
      
      toast.success('Recurring template created');
      setShowCreateModal(false);
      resetForm();
      fetchTemplates();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!form.name || !form.amount) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const res = await fetch(`${API}/api/finance/recurring/templates/${editingTemplate.template_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          amount: parseFloat(form.amount),
          category_id: form.category_id || undefined,
          account_id: form.account_id || undefined,
          day_of_month: parseInt(form.day_of_month),
          description: form.description,
          paid_to: form.paid_to
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update template');
      }
      
      toast.success('Template updated');
      setEditingTemplate(null);
      resetForm();
      fetchTemplates();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleTemplate = async (templateId) => {
    setToggling(templateId);
    try {
      const res = await fetch(`${API}/api/finance/recurring/templates/${templateId}/toggle`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to toggle template');
      }
      
      const data = await res.json();
      toast.success(data.message);
      fetchTemplates();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToggling(null);
    }
  };

  const handleRunScheduled = async () => {
    setRunningScheduled(true);
    try {
      const res = await fetch(`${API}/api/finance/recurring/run-scheduled`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to run scheduled');
      }
      
      const data = await res.json();
      if (data.created_count > 0) {
        toast.success(`Created ${data.created_count} pending payables`);
        fetchPayables();
      } else {
        toast.info('No recurring expenses due today');
      }
      fetchTemplates();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningScheduled(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payingPayable) return;
    
    setProcessing(payingPayable.payable_id);
    try {
      const res = await fetch(`${API}/api/finance/recurring/payables/${payingPayable.payable_id}/pay`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentForm.amount ? parseFloat(paymentForm.amount) : null,
          payment_date: paymentForm.payment_date || null,
          mode: paymentForm.mode,
          remarks: paymentForm.remarks || null
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to record payment');
      }
      
      const data = await res.json();
      toast.success(`Payment recorded: ₹${data.amount?.toLocaleString()}`);
      setPayingPayable(null);
      setPaymentForm({ amount: '', payment_date: '', mode: 'bank_transfer', remarks: '' });
      fetchPayables();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCancelPayable = async (payableId) => {
    setProcessing(payableId);
    try {
      const res = await fetch(`${API}/api/finance/recurring/payables/${payableId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to cancel');
      }
      
      toast.success('Payable cancelled');
      fetchPayables();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      amount: '',
      category_id: '',
      account_id: '',
      day_of_month: 1,
      description: '',
      paid_to: ''
    });
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      amount: template.amount.toString(),
      category_id: template.category_id,
      account_id: template.account_id,
      day_of_month: template.day_of_month,
      description: template.description || '',
      paid_to: template.paid_to || ''
    });
  };

  const openPaymentModal = (payable) => {
    setPayingPayable(payable);
    setPaymentForm({
      amount: payable.amount.toString(),
      payment_date: new Date().toISOString().split('T')[0],
      mode: 'bank_transfer',
      remarks: ''
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  const canManage = user && ['Admin', 'Founder', 'SeniorAccountant'].includes(user.role);
  const pendingPayables = payables.filter(p => p.status === 'pending');
  const paidPayables = payables.filter(p => p.status === 'paid');

  return (
    <div className="p-6 space-y-6" data-testid="recurring-transactions-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Recurring Expenses</h1>
            <p className="text-sm text-slate-500">Monthly recurring expense templates & pending payables</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'Admin' && (
            <Button
              variant="outline"
              onClick={handleRunScheduled}
              disabled={runningScheduled}
              data-testid="run-scheduled-btn"
            >
              {runningScheduled ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Generate Due Payables
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setShowCreateModal(true)} data-testid="create-template-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={payableSummary.overdue > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending Payables</p>
                <p className="text-2xl font-bold text-slate-800">{payableSummary.pending}</p>
              </div>
              <Clock className={`w-8 h-8 ${payableSummary.overdue > 0 ? 'text-red-500' : 'text-slate-300'}`} />
            </div>
            {payableSummary.overdue > 0 && (
              <p className="text-xs text-red-600 mt-1">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {payableSummary.overdue} overdue
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pending Amount</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(payableSummary.total_pending_amount)}</p>
              </div>
              <IndianRupee className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Templates</p>
                <p className="text-2xl font-bold text-slate-800">{templates.filter(t => t.is_active).length}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payables" data-testid="tab-payables">
            <Clock className="w-4 h-4 mr-2" />
            Pending Payables ({pendingPayables.length})
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <RefreshCw className="w-4 h-4 mr-2" />
            Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <CheckCircle className="w-4 h-4 mr-2" />
            Paid History ({paidPayables.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Payables Tab */}
        <TabsContent value="payables" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Pending Payables
                <Badge variant="outline" className="text-xs">
                  Awaiting Payment
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading...</div>
              ) : pendingPayables.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-2" />
                  No pending payables
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-600">Expense</th>
                        <th className="text-left p-3 font-medium text-slate-600">Due Date</th>
                        <th className="text-right p-3 font-medium text-slate-600">Amount</th>
                        <th className="text-left p-3 font-medium text-slate-600">Category</th>
                        <th className="text-left p-3 font-medium text-slate-600">Pay To</th>
                        <th className="text-center p-3 font-medium text-slate-600">Status</th>
                        <th className="text-center p-3 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingPayables.map((payable) => (
                        <tr key={payable.payable_id} className={`hover:bg-slate-50 ${payable.is_overdue ? 'bg-red-50' : ''}`}>
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{payable.template_name}</div>
                            {payable.description && payable.description !== payable.template_name && (
                              <div className="text-xs text-slate-400">{payable.description}</div>
                            )}
                          </td>
                          <td className="p-3 text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDate(payable.due_date)}
                            </div>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700">
                            {formatCurrency(payable.amount)}
                          </td>
                          <td className="p-3 text-slate-600">{payable.category_name}</td>
                          <td className="p-3 text-slate-600">{payable.paid_to || '-'}</td>
                          <td className="p-3 text-center">
                            {payable.is_overdue ? (
                              <Badge className="bg-red-100 text-red-700">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Overdue
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <Button
                                size="sm"
                                onClick={() => openPaymentModal(payable)}
                                disabled={processing === payable.payable_id}
                                data-testid={`pay-${payable.payable_id}`}
                              >
                                {processing === payable.payable_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CreditCard className="w-4 h-4 mr-1" />
                                    Pay
                                  </>
                                )}
                              </Button>
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelPayable(payable.payable_id)}
                                  disabled={processing === payable.payable_id}
                                  title="Skip this payment"
                                >
                                  <XCircle className="w-4 h-4 text-slate-400" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recurring Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {templates.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No recurring templates. Create one to automate monthly expenses.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-600">Name</th>
                        <th className="text-right p-3 font-medium text-slate-600">Amount</th>
                        <th className="text-left p-3 font-medium text-slate-600">Category</th>
                        <th className="text-center p-3 font-medium text-slate-600">Day</th>
                        <th className="text-center p-3 font-medium text-slate-600">Next Due</th>
                        <th className="text-center p-3 font-medium text-slate-600">Status</th>
                        {canManage && <th className="text-center p-3 font-medium text-slate-600">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {templates.map((template) => (
                        <tr key={template.template_id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{template.name}</div>
                            {template.paid_to && (
                              <div className="text-xs text-slate-400">To: {template.paid_to}</div>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700">
                            {formatCurrency(template.amount)}
                          </td>
                          <td className="p-3 text-slate-600">{template.category_name}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">
                              {template.day_of_month}<sup>{getOrdinal(template.day_of_month)}</sup>
                            </Badge>
                          </td>
                          <td className="p-3 text-center text-slate-600">
                            {formatDate(template.next_run)}
                          </td>
                          <td className="p-3 text-center">
                            {template.is_active ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600">
                                <Pause className="w-3 h-3 mr-1" />
                                Paused
                              </Badge>
                            )}
                          </td>
                          {canManage && (
                            <td className="p-3 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditModal(template)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleTemplate(template.template_id)}
                                  disabled={toggling === template.template_id}
                                >
                                  {toggling === template.template_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : template.is_active ? (
                                    <Pause className="w-4 h-4 text-orange-500" />
                                  ) : (
                                    <Play className="w-4 h-4 text-green-500" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paid History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {paidPayables.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No paid recurring expenses yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-600">Expense</th>
                        <th className="text-left p-3 font-medium text-slate-600">Due Date</th>
                        <th className="text-left p-3 font-medium text-slate-600">Paid On</th>
                        <th className="text-right p-3 font-medium text-slate-600">Amount</th>
                        <th className="text-left p-3 font-medium text-slate-600">Paid By</th>
                        <th className="text-center p-3 font-medium text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paidPayables.map((payable) => (
                        <tr key={payable.payable_id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{payable.template_name}</div>
                          </td>
                          <td className="p-3 text-slate-600">{formatDate(payable.due_date)}</td>
                          <td className="p-3 text-slate-600">{formatDate(payable.paid_at)}</td>
                          <td className="p-3 text-right font-medium text-green-600">
                            {formatCurrency(payable.paid_amount)}
                          </td>
                          <td className="p-3 text-slate-600">{payable.paid_by_name || '-'}</td>
                          <td className="p-3 text-center">
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Paid
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Template Modal */}
      {(showCreateModal || editingTemplate) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b">
              <CardTitle>
                {editingTemplate ? 'Edit Recurring Template' : 'New Recurring Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  placeholder="e.g., Office Rent, Internet Bill"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="10000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Category *</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Account *</Label>
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.account_id} value={acc.account_id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Day of Month (1-28)</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Payable created on this day each month
                </p>
              </div>
              
              <div>
                <Label>Paid To</Label>
                <Input
                  placeholder="e.g., Landlord Name"
                  value={form.paid_to}
                  onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                >
                  {editingTemplate ? 'Update' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Record Payment Modal */}
      {payingPayable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Record Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded">
                <div className="text-sm text-slate-600">
                  <strong>Expense:</strong> {payingPayable.template_name}
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Due Amount:</strong> {formatCurrency(payingPayable.amount)}
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Due Date:</strong> {formatDate(payingPayable.due_date)}
                </div>
              </div>
              
              <div>
                <Label>Payment Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Leave unchanged to pay full amount
                </p>
              </div>
              
              <div>
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Payment Mode</Label>
                <Select value={paymentForm.mode} onValueChange={(v) => setPaymentForm({ ...paymentForm, mode: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Remarks (optional)</Label>
                <Input
                  placeholder="Any notes about this payment"
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setPayingPayable(null);
                    setPaymentForm({ amount: '', payment_date: '', mode: 'bank_transfer', remarks: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleRecordPayment}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Record Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
