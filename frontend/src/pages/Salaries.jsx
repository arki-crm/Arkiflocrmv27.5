import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Users, Plus, DollarSign, Calendar, AlertTriangle, CheckCircle, 
  Clock, ArrowRight, XCircle, Wallet, Edit, History, LogOut,
  TrendingUp, PiggyBank, Settings, Star, Award, Target
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function Salaries() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salaries, setSalaries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [salaryLadder, setSalaryLadder] = useState([]);
  const [promotionOverview, setPromotionOverview] = useState(null);
  
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);
  const [showLadderConfig, setShowLadderConfig] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeHistory, setEmployeeHistory] = useState(null);
  const [salaryChangeHistory, setSalaryChangeHistory] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  
  // Form states
  const [newSalary, setNewSalary] = useState({
    employee_id: '',
    monthly_salary: '',
    payment_type: 'monthly',
    salary_start_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  const [newPayment, setNewPayment] = useState({
    employee_id: '',
    amount: '',
    payment_type: 'salary',
    account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    month_year: getCurrentMonth(),
    notes: ''
  });
  
  const [promoteData, setPromoteData] = useState({
    new_salary: '',
    new_level: '',
    effective_date: new Date().toISOString().split('T')[0],
    reason: 'promotion',
    notes: ''
  });
  
  const [exitData, setExitData] = useState({
    exit_date: new Date().toISOString().split('T')[0]
  });

  const [ladderData, setLadderData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [salariesRes, summaryRes, cyclesRes, accountsRes, ladderRes] = await Promise.all([
        axios.get(`${API}/api/finance/salaries`, { withCredentials: true }),
        axios.get(`${API}/api/finance/salary-summary`, { withCredentials: true }),
        axios.get(`${API}/api/finance/salary-cycles?month_year=${selectedMonth}`, { withCredentials: true }),
        axios.get(`${API}/api/accounting/accounts`, { withCredentials: true }),
        axios.get(`${API}/api/finance/salary-ladder`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      
      setSalaries(salariesRes.data || []);
      setSummary(summaryRes.data || null);
      setCycles(cyclesRes.data || []);
      setAccounts(accountsRes.data || []);
      setSalaryLadder(ladderRes.data || []);
      setLadderData(ladderRes.data || []);
      
      // Fetch promotion overview
      try {
        const overviewRes = await axios.get(`${API}/api/hr/promotion-eligibility/overview`, { withCredentials: true });
        setPromotionOverview(overviewRes.data);
      } catch (err) {
        // May not have permission
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load salary data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const fetchAvailableEmployees = async () => {
    try {
      const res = await axios.get(`${API}/api/finance/employees-for-salary`, { withCredentials: true });
      setAvailableEmployees(res.data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSalary = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/finance/salaries`, {
        ...newSalary,
        monthly_salary: parseFloat(newSalary.monthly_salary)
      }, { withCredentials: true });
      
      toast.success('Salary setup created successfully');
      setShowAddSalary(false);
      setNewSalary({
        employee_id: '',
        monthly_salary: '',
        payment_type: 'monthly',
        salary_start_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create salary setup');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/finance/salary-payments`, {
        ...newPayment,
        amount: parseFloat(newPayment.amount)
      }, { withCredentials: true });
      
      toast.success(`Payment recorded: ${formatCurrency(res.data.payment.amount)}`);
      
      if (res.data.carry_forward > 0) {
        toast.info(`Excess amount ₹${res.data.carry_forward} will be recovered next month`);
      }
      
      setShowAddPayment(false);
      setNewPayment({
        employee_id: '',
        amount: '',
        payment_type: 'salary',
        account_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        month_year: getCurrentMonth(),
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record payment');
    }
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      const res = await axios.post(`${API}/api/finance/salaries/${selectedEmployee.employee_id}/promote`, {
        ...promoteData,
        new_salary: parseFloat(promoteData.new_salary)
      }, { withCredentials: true });
      
      toast.success(res.data.message);
      setShowPromoteModal(false);
      setSelectedEmployee(null);
      setPromoteData({
        new_salary: '',
        new_level: '',
        effective_date: new Date().toISOString().split('T')[0],
        reason: 'promotion',
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update salary');
    }
  };

  const handleViewHistory = async (employee) => {
    try {
      const res = await axios.get(`${API}/api/finance/salaries/${employee.employee_id}/history`, { withCredentials: true });
      setEmployeeHistory(res.data);
      setSelectedEmployee(employee);
      setShowHistory(true);
    } catch (err) {
      toast.error('Failed to load history');
    }
  };

  const handleViewSalaryHistory = async (employee) => {
    try {
      const res = await axios.get(`${API}/api/finance/salaries/${employee.employee_id}/salary-history`, { withCredentials: true });
      setSalaryChangeHistory(res.data || []);
      setSelectedEmployee(employee);
      setShowSalaryHistory(true);
    } catch (err) {
      toast.error('Failed to load salary history');
    }
  };

  const handleProcessExit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      const res = await axios.post(`${API}/api/finance/salaries/${selectedEmployee.employee_id}/exit`, exitData, { withCredentials: true });
      
      const settlement = res.data.settlement_details;
      toast.success(`Exit processed. ${settlement.settlement_type === 'payable_to_employee' ? 'Amount payable' : 'Amount recoverable'}: ${formatCurrency(settlement.final_amount)}`);
      
      setShowExitModal(false);
      setSelectedEmployee(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process exit');
    }
  };

  const handleCloseCycle = async (employeeId, monthYear) => {
    try {
      await axios.post(`${API}/api/finance/salary-cycles/${employeeId}/${monthYear}/close`, {}, { withCredentials: true });
      toast.success('Salary cycle closed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close cycle');
    }
  };

  const handleSaveLadder = async () => {
    try {
      await axios.put(`${API}/api/finance/salary-ladder`, { levels: ladderData }, { withCredentials: true });
      toast.success('Salary ladder updated');
      setShowLadderConfig(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update ladder');
    }
  };

  const openPromoteModal = (employee) => {
    setSelectedEmployee(employee);
    setPromoteData(prev => ({
      ...prev,
      new_salary: employee.monthly_salary?.toString() || '',
      new_level: employee.salary_level || ''
    }));
    setShowPromoteModal(true);
  };

  const openPaymentModal = (employee) => {
    setSelectedEmployee(employee);
    setNewPayment(prev => ({
      ...prev,
      employee_id: employee.employee_id,
      month_year: selectedMonth
    }));
    setShowAddPayment(true);
  };

  const openExitModal = (employee) => {
    setSelectedEmployee(employee);
    setShowExitModal(true);
  };

  const getRiskBadge = (status) => {
    switch (status) {
      case 'safe': return <Badge className="bg-green-100 text-green-800">Safe</Badge>;
      case 'tight': return <Badge className="bg-amber-100 text-amber-800">Tight</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getBudgetBadge = (status) => {
    switch (status) {
      case 'safe': return <Badge className="bg-green-100 text-green-800">Under Budget</Badge>;
      case 'near_limit': return <Badge className="bg-amber-100 text-amber-800">Near Limit</Badge>;
      case 'over_budget': return <Badge className="bg-red-100 text-red-800">Over Budget</Badge>;
      default: return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'on_hold': return <Badge className="bg-amber-100 text-amber-800">On Hold</Badge>;
      case 'exit': return <Badge className="bg-red-100 text-red-800">Exit</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEligibilityBadge = (status) => {
    switch (status) {
      case 'eligible': return <Badge className="bg-green-100 text-green-800"><Star className="h-3 w-3 mr-1" />Eligible</Badge>;
      case 'near_eligible': return <Badge className="bg-blue-100 text-blue-800"><Target className="h-3 w-3 mr-1" />Near</Badge>;
      case 'stagnant': return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Stagnant</Badge>;
      default: return <Badge variant="secondary">In Progress</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 min-h-screen overflow-y-auto" data-testid="salaries-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
          <p className="text-gray-500 mt-1">Track employee salaries, advances, and payments</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowLadderConfig(true)}
            data-testid="ladder-config-btn"
          >
            <Settings className="h-4 w-4 mr-2" />
            Salary Ladder
          </Button>
          <Button 
            variant="outline" 
            onClick={() => { fetchAvailableEmployees(); setShowAddSalary(true); }}
            data-testid="add-salary-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee Salary
          </Button>
          <Button onClick={() => setShowAddPayment(true)} data-testid="add-payment-btn">
            <DollarSign className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="summary-employees">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Employees</p>
                  <p className="text-2xl font-bold">{summary.active_employees}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="summary-monthly">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Monthly Salary Bill</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_monthly_salary)}</p>
                </div>
                <Wallet className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="summary-pending">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending This Month</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.pending_this_month)}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="summary-risk">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Cash Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getRiskBadge(summary.risk_status)}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{summary.risk_message}</p>
                </div>
                {summary.risk_status === 'safe' ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : summary.risk_status === 'tight' ? (
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Promotion Eligibility Overview */}
      {promotionOverview && (promotionOverview.eligible_count > 0 || promotionOverview.stagnant_count > 0) && (
        <Card className="border-blue-200 bg-blue-50/30" data-testid="promotion-overview">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              Promotion Eligibility Overview
            </CardTitle>
            <CardDescription>Employees flagged for review (no auto-promotion)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{promotionOverview.eligible_count}</p>
                <p className="text-sm text-green-600">Eligible for Review</p>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{promotionOverview.near_eligible_count}</p>
                <p className="text-sm text-blue-600">Near Eligible</p>
              </div>
              <div className="text-center p-3 bg-red-100 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{promotionOverview.stagnant_count}</p>
                <p className="text-sm text-red-600">Stagnant</p>
              </div>
              <div className="text-center p-3 bg-gray-100 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{promotionOverview.in_progress_count}</p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
            </div>
            {promotionOverview.eligible.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Eligible for Promotion Review:</p>
                <div className="flex flex-wrap gap-2">
                  {promotionOverview.eligible.map(emp => (
                    <Badge key={emp.employee_id} className="bg-green-100 text-green-800">
                      {emp.employee_name} ({formatCurrency(emp.current_salary)})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Budget vs Actual */}
      {summary?.budget_info && (
        <Card data-testid="budget-tracking">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Salary Budget Tracking</CardTitle>
              {getBudgetBadge(summary.budget_info.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-sm text-gray-500">Planned</p>
                <p className="text-xl font-semibold">{formatCurrency(summary.budget_info.planned)}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Actual Spent</p>
                <p className="text-xl font-semibold">{formatCurrency(summary.budget_info.actual)}</p>
              </div>
              <div className="ml-auto">
                <p className="text-sm text-gray-500">Variance</p>
                <p className={`text-xl font-semibold ${summary.budget_info.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.budget_info.variance >= 0 ? '+' : ''}{formatCurrency(summary.budget_info.variance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Utilization</p>
                <p className="text-xl font-semibold">{summary.budget_info.utilization_percent}%</p>
              </div>
            </div>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  summary.budget_info.utilization_percent > 100 ? 'bg-red-500' :
                  summary.budget_info.utilization_percent > 80 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(summary.budget_info.utilization_percent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Status</TabsTrigger>
          <TabsTrigger value="employees">All Employees</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Employees with pending salary for {selectedMonth}</CardDescription>
            </CardHeader>
            <CardContent>
              {cycles.filter(c => c.status === 'open' && c.balance_payable > 0).length === 0 ? (
                <p className="text-gray-500 text-center py-4">All salaries paid for this month! 🎉</p>
              ) : (
                <div className="space-y-3">
                  {cycles
                    .filter(c => c.status === 'open' && c.balance_payable > 0)
                    .map(cycle => (
                      <div 
                        key={cycle.cycle_id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        data-testid={`pending-cycle-${cycle.employee_id}`}
                      >
                        <div>
                          <p className="font-medium">{cycle.employee_name}</p>
                          <p className="text-sm text-gray-500">
                            Balance: {formatCurrency(cycle.balance_payable)}
                            {cycle.total_advances > 0 && (
                              <span className="text-amber-600 ml-2">
                                (Advances: {formatCurrency(cycle.total_advances)})
                              </span>
                            )}
                          </p>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => openPaymentModal({ employee_id: cycle.employee_id, employee_name: cycle.employee_name, monthly_salary: cycle.monthly_salary })}
                        >
                          Pay Now
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Settlements */}
          {summary?.pending_settlements > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Pending Final Settlements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salaries.filter(s => s.status === 'exit' && s.final_settlement_status === 'pending').map(salary => (
                  <div key={salary.salary_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg mb-2">
                    <div>
                      <p className="font-medium">{salary.employee_name}</p>
                      <p className="text-sm text-gray-600">
                        {salary.final_settlement_type === 'payable_to_employee' ? 'Payable to employee' : 'Recoverable from employee'}
                        : {formatCurrency(salary.final_settlement_amount)}
                      </p>
                    </div>
                    <Badge variant="destructive">Settlement Pending</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Monthly Status Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Label>Select Month:</Label>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-48"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Salary Cycles - {selectedMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Employee</th>
                      <th className="text-right py-3 px-4">Monthly Salary</th>
                      <th className="text-right py-3 px-4">Advances</th>
                      <th className="text-right py-3 px-4">Paid</th>
                      <th className="text-right py-3 px-4">Balance</th>
                      <th className="text-center py-3 px-4">Status</th>
                      <th className="text-right py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500">
                          No salary cycles for this month
                        </td>
                      </tr>
                    ) : (
                      cycles.map(cycle => (
                        <tr key={cycle.cycle_id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{cycle.employee_name}</p>
                              <p className="text-xs text-gray-500">{cycle.employee_role}</p>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">{formatCurrency(cycle.monthly_salary)}</td>
                          <td className="text-right py-3 px-4 text-amber-600">
                            {cycle.total_advances > 0 ? formatCurrency(cycle.total_advances) : '-'}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">{formatCurrency(cycle.total_salary_paid)}</td>
                          <td className="text-right py-3 px-4 font-medium">
                            {cycle.balance_payable > 0 ? (
                              <span className="text-red-600">{formatCurrency(cycle.balance_payable)}</span>
                            ) : (
                              <span className="text-green-600">Paid</span>
                            )}
                          </td>
                          <td className="text-center py-3 px-4">
                            {cycle.status === 'closed' ? (
                              <Badge variant="secondary">Closed</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800">Open</Badge>
                            )}
                          </td>
                          <td className="text-right py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {cycle.status === 'open' && cycle.balance_payable > 0 && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openPaymentModal({ employee_id: cycle.employee_id, employee_name: cycle.employee_name, monthly_salary: cycle.monthly_salary })}
                                >
                                  Pay
                                </Button>
                              )}
                              {cycle.status === 'open' && cycle.balance_payable <= 0 && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleCloseCycle(cycle.employee_id, cycle.month_year)}
                                >
                                  Close
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Salary Master</CardTitle>
              <CardDescription>All employees with salary configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Employee</th>
                      <th className="text-left py-3 px-4">Role</th>
                      <th className="text-right py-3 px-4">Monthly Salary</th>
                      <th className="text-center py-3 px-4">Level</th>
                      <th className="text-center py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Last Change</th>
                      <th className="text-right py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500">
                          No salary records found. Click "Add Employee Salary" to get started.
                        </td>
                      </tr>
                    ) : (
                      salaries.map(salary => (
                        <tr key={salary.salary_id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-medium">{salary.employee_name}</p>
                            <p className="text-xs text-gray-500">{salary.employee_email}</p>
                          </td>
                          <td className="py-3 px-4">{salary.employee_role}</td>
                          <td className="text-right py-3 px-4 font-medium">{formatCurrency(salary.monthly_salary)}</td>
                          <td className="text-center py-3 px-4">
                            {salary.salary_level ? (
                              <Badge variant="outline">{salary.salary_level}</Badge>
                            ) : '-'}
                          </td>
                          <td className="text-center py-3 px-4">{getStatusBadge(salary.status)}</td>
                          <td className="py-3 px-4">
                            {salary.last_salary_change_date ? (
                              <div>
                                <p className="text-sm">{formatDate(salary.last_salary_change_date)}</p>
                                <p className="text-xs text-gray-500 capitalize">{salary.last_salary_change_reason}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleViewSalaryHistory(salary)}
                                title="Salary Change History"
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleViewHistory(salary)}
                                title="Payment History"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              {salary.status === 'active' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => openPromoteModal(salary)}
                                    title="Edit/Promote Salary"
                                    data-testid={`promote-btn-${salary.employee_id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => openPaymentModal(salary)}
                                  >
                                    Pay
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    onClick={() => openExitModal(salary)}
                                  >
                                    <LogOut className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Salary Modal */}
      <Dialog open={showAddSalary} onOpenChange={setShowAddSalary}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee Salary</DialogTitle>
            <DialogDescription>Setup salary configuration for an employee</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSalary} className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={newSalary.employee_id} onValueChange={(v) => setNewSalary(prev => ({ ...prev, employee_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map(emp => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.name} ({emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly Salary (₹)</Label>
              <Input 
                type="number" 
                value={newSalary.monthly_salary}
                onChange={(e) => setNewSalary(prev => ({ ...prev, monthly_salary: e.target.value }))}
                placeholder="Enter monthly salary"
                required
              />
              {salaryLadder.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Reference: {salaryLadder.map(l => `${l.name}: ₹${l.min_salary}`).join(' → ')}
                </p>
              )}
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={newSalary.payment_type} onValueChange={(v) => setNewSalary(prev => ({ ...prev, payment_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="advance_balance">Advance + Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salary Start Date</Label>
              <Input 
                type="date" 
                value={newSalary.salary_start_date}
                onChange={(e) => setNewSalary(prev => ({ ...prev, salary_start_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input 
                value={newSalary.notes}
                onChange={(e) => setNewSalary(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddSalary(false)}>Cancel</Button>
              <Button type="submit">Create Salary Setup</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Payment Modal */}
      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Salary Payment</DialogTitle>
            <DialogDescription>
              {selectedEmployee ? `Payment for ${selectedEmployee.employee_name}` : 'Record advance or salary payment'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4">
            {!selectedEmployee && (
              <div>
                <Label>Employee</Label>
                <Select value={newPayment.employee_id} onValueChange={(v) => setNewPayment(prev => ({ ...prev, employee_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {salaries.filter(s => s.status === 'active').map(s => (
                      <SelectItem key={s.employee_id} value={s.employee_id}>
                        {s.employee_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Payment Type</Label>
              <Select value={newPayment.payment_type} onValueChange={(v) => setNewPayment(prev => ({ ...prev, payment_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="final_settlement">Final Settlement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input 
                type="number" 
                value={newPayment.amount}
                onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount"
                required
              />
            </div>
            <div>
              <Label>Month/Year Applied To</Label>
              <Input 
                type="month" 
                value={newPayment.month_year}
                onChange={(e) => setNewPayment(prev => ({ ...prev, month_year: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input 
                type="date" 
                value={newPayment.payment_date}
                onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Account</Label>
              <Select value={newPayment.account_id} onValueChange={(v) => setNewPayment(prev => ({ ...prev, account_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.is_active).map(account => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.account_name || account.name} ({formatCurrency(account.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input 
                value={newPayment.notes}
                onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Payment notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAddPayment(false); setSelectedEmployee(null); }}>Cancel</Button>
              <Button type="submit">Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promote/Edit Salary Modal */}
      <Dialog open={showPromoteModal} onOpenChange={setShowPromoteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Salary / Promote</DialogTitle>
            <DialogDescription>
              {selectedEmployee?.employee_name} - Current: {formatCurrency(selectedEmployee?.monthly_salary)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePromote} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Current Salary: <span className="font-semibold">{formatCurrency(selectedEmployee?.monthly_salary)}</span></p>
              {selectedEmployee?.salary_level && (
                <p className="text-sm text-gray-600">Current Level: <span className="font-semibold">{selectedEmployee.salary_level}</span></p>
              )}
            </div>
            <div>
              <Label>New Salary (₹)</Label>
              <Input 
                type="number" 
                value={promoteData.new_salary}
                onChange={(e) => setPromoteData(prev => ({ ...prev, new_salary: e.target.value }))}
                placeholder="Enter new salary"
                required
              />
              {salaryLadder.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {salaryLadder.map(level => (
                    <Button
                      key={level.level}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPromoteData(prev => ({ ...prev, new_salary: level.min_salary.toString(), new_level: level.name }))}
                    >
                      {level.name}: ₹{level.min_salary.toLocaleString()}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Level Label (Optional)</Label>
              <Input 
                value={promoteData.new_level}
                onChange={(e) => setPromoteData(prev => ({ ...prev, new_level: e.target.value }))}
                placeholder="e.g., Level 2, Senior"
              />
            </div>
            <div>
              <Label>Effective Date</Label>
              <Input 
                type="date" 
                value={promoteData.effective_date}
                onChange={(e) => setPromoteData(prev => ({ ...prev, effective_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={promoteData.reason} onValueChange={(v) => setPromoteData(prev => ({ ...prev, reason: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea 
                value={promoteData.notes}
                onChange={(e) => setPromoteData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Reason for change..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowPromoteModal(false); setSelectedEmployee(null); }}>Cancel</Button>
              <Button type="submit">Update Salary</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History - {selectedEmployee?.employee_name}</DialogTitle>
          </DialogHeader>
          {employeeHistory && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Current Monthly Salary</p>
                <p className="text-xl font-bold">{formatCurrency(employeeHistory.salary_master?.monthly_salary)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Since {formatDate(employeeHistory.salary_master?.salary_start_date)}
                </p>
              </div>
              
              <h4 className="font-medium">Payment History (Last 12 Months)</h4>
              {employeeHistory.cycles?.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No payment history</p>
              ) : (
                employeeHistory.cycles?.map(cycle => (
                  <div key={cycle.cycle_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{cycle.month_year}</span>
                      {cycle.status === 'closed' ? (
                        <Badge variant="secondary">Closed</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800">Open</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Salary</p>
                        <p>{formatCurrency(cycle.monthly_salary)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Advances</p>
                        <p className="text-amber-600">{formatCurrency(cycle.total_advances)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Paid</p>
                        <p className="text-green-600">{formatCurrency(cycle.total_salary_paid)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Balance</p>
                        <p className={cycle.balance_payable > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(cycle.balance_payable)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Salary Change History Modal */}
      <Dialog open={showSalaryHistory} onOpenChange={setShowSalaryHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Change History - {selectedEmployee?.employee_name}</DialogTitle>
            <DialogDescription>Audit trail of all salary changes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {salaryChangeHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No salary changes recorded</p>
            ) : (
              salaryChangeHistory.map(change => (
                <div key={change.history_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={change.reason === 'promotion' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                        {change.reason}
                      </Badge>
                      {change.new_level && <Badge variant="outline">{change.new_level}</Badge>}
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(change.effective_date)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Previous</p>
                      <p className="font-medium">{formatCurrency(change.previous_salary)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">New</p>
                      <p className="font-medium text-green-600">{formatCurrency(change.new_salary)}</p>
                    </div>
                  </div>
                  {change.notes && (
                    <p className="text-sm text-gray-600 mt-2">{change.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Changed by {change.changed_by_name} on {formatDate(change.changed_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit Modal */}
      <Dialog open={showExitModal} onOpenChange={setShowExitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">Process Employee Exit</DialogTitle>
            <DialogDescription>
              Calculate final settlement for {selectedEmployee?.employee_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProcessExit} className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                ⚠️ This action will mark the employee as exited and calculate their final settlement.
                All advances will be adjusted against the final amount.
              </p>
            </div>
            <div>
              <Label>Exit Date</Label>
              <Input 
                type="date" 
                value={exitData.exit_date}
                onChange={(e) => setExitData({ exit_date: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowExitModal(false); setSelectedEmployee(null); }}>Cancel</Button>
              <Button type="submit" variant="destructive">Process Exit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Salary Ladder Config Modal */}
      <Dialog open={showLadderConfig} onOpenChange={setShowLadderConfig}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Salary Ladder Configuration</DialogTitle>
            <DialogDescription>Reference salary levels for guidance and eligibility flagging</DialogDescription>
          </DialogHeader>
          
          {/* Disclaimer Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <p className="text-sm text-blue-800 font-medium">
              ℹ️ This is a reference salary ladder for guidance and eligibility flagging only.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Salary changes are always manual and controlled by Admin. No automatic promotions.
            </p>
          </div>
          
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {/* Column Headers */}
            <div className="grid grid-cols-4 gap-3 px-3 pb-2 border-b">
              <div>
                <Label className="font-semibold">Level Name</Label>
              </div>
              <div>
                <Label className="font-semibold">Reference Monthly Salary</Label>
                <p className="text-xs text-gray-500">Guidance only, not enforced</p>
              </div>
              <div>
                <Label className="font-semibold">Eligibility Credits</Label>
                <p className="text-xs text-gray-500">Bookings Sent to Production</p>
              </div>
              <div></div>
            </div>
            
            {ladderData.map((level, index) => {
              const isTrainee = level.level === 'trainee' || level.name.toLowerCase().includes('trainee');
              return (
                <div key={level.level} className="grid grid-cols-4 gap-3 items-center p-3 bg-gray-50 rounded-lg">
                  <Input
                    value={level.name}
                    onChange={(e) => {
                      const newData = [...ladderData];
                      newData[index].name = e.target.value;
                      setLadderData(newData);
                    }}
                    placeholder="e.g., Level 1"
                  />
                  {isTrainee ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={level.min_salary}
                        onChange={(e) => {
                          const newData = [...ladderData];
                          newData[index].min_salary = parseFloat(e.target.value) || 0;
                          setLadderData(newData);
                        }}
                        placeholder="Min"
                        className="w-24"
                      />
                      <span className="text-gray-500">–</span>
                      <Input
                        type="number"
                        value={level.max_salary}
                        onChange={(e) => {
                          const newData = [...ladderData];
                          newData[index].max_salary = parseFloat(e.target.value) || 0;
                          setLadderData(newData);
                        }}
                        placeholder="Max"
                        className="w-24"
                      />
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={level.min_salary}
                      onChange={(e) => {
                        const newData = [...ladderData];
                        const salary = parseFloat(e.target.value) || 0;
                        newData[index].min_salary = salary;
                        newData[index].max_salary = salary; // Keep in sync for non-trainee levels
                        setLadderData(newData);
                      }}
                      placeholder="₹ Monthly"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={level.order}
                      onChange={(e) => {
                        const newData = [...ladderData];
                        newData[index].order = parseInt(e.target.value) || 0;
                        setLadderData(newData);
                      }}
                      placeholder="0"
                      className="w-20"
                    />
                    <span className="text-xs text-gray-500">credits</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setLadderData(ladderData.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            
            {/* Helper text */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium">About Eligibility Credits:</p>
              <p className="mt-1">Used only to flag promotion eligibility. Salary updates are manual and admin-approved.</p>
              <p className="mt-1 text-xs text-amber-700">
                Example: An employee with 3+ production bookings across 3+ months is flagged as "Eligible for Review" — but promotion is still manual.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLadderData([...ladderData, {
                level: `level_${ladderData.length + 1}`,
                name: `Level ${ladderData.length + 1}`,
                min_salary: 0,
                max_salary: 0,
                order: ladderData.length
              }])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Level
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowLadderConfig(false)}>Cancel</Button>
            <Button onClick={handleSaveLadder}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
