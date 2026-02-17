import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Users, Plus, DollarSign, Calendar, AlertTriangle, CheckCircle, 
  Clock, ArrowRight, XCircle, Wallet, Edit, History, LogOut,
  TrendingUp, PiggyBank, Settings, Star, Award, Target, Gift, Percent, Minus, UserCheck, Briefcase,
  Trash2, Check, X, Eye
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
import { Checkbox } from '../components/ui/checkbox';
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
  
  // Compensation & Payout states
  const [incentives, setIncentives] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [deductionTypes, setDeductionTypes] = useState({});
  const [projects, setProjects] = useState([]);
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedIncentive, setSelectedIncentive] = useState(null);
  const [selectedCommission, setSelectedCommission] = useState(null);
  
  // Approval workflow states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState({ type: null, id: null }); // { type: 'incentive'|'commission', id: string }
  const [showEditIncentiveModal, setShowEditIncentiveModal] = useState(false);
  const [showEditCommissionModal, setShowEditCommissionModal] = useState(false);
  const [editIncentiveData, setEditIncentiveData] = useState(null);
  const [editCommissionData, setEditCommissionData] = useState(null);
  
  // Classification management states
  const [classificationSummary, setClassificationSummary] = useState(null);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedEmployeeForClassification, setSelectedEmployeeForClassification] = useState(null);
  const [classificationHistory, setClassificationHistory] = useState([]);
  const [showClassificationHistoryModal, setShowClassificationHistoryModal] = useState(false);
  const [newClassification, setNewClassification] = useState('');
  
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
  
  // Deduction form state
  const [deductionData, setDeductionData] = useState({
    employee_id: '',
    month_year: getCurrentMonth(),
    gross_salary: '',
    deductions: []
  });
  
  // Incentive form state
  const [incentiveData, setIncentiveData] = useState({
    employee_id: '',
    incentive_type: 'booking',
    project_id: '',
    amount: '',
    calculation_type: 'fixed',
    percentage_of: '',
    trigger_event: '',
    notes: ''
  });
  
  // Commission form state
  const [commissionData, setCommissionData] = useState({
    recipient_type: 'referral',
    recipient_name: '',
    recipient_contact: '',
    commission_type: 'referral',
    project_id: '',
    amount: '',
    calculation_type: 'fixed',
    percentage_of: '',
    notes: ''
  });
  
  // Payout form state
  const [payoutData, setPayoutData] = useState({
    account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

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
      
      // Fetch compensation data
      try {
        const [incentivesRes, commissionsRes, deductionTypesRes, projectsRes, classificationRes] = await Promise.all([
          axios.get(`${API}/api/finance/incentives`, { withCredentials: true }).catch(() => ({ data: { incentives: [] } })),
          axios.get(`${API}/api/finance/commissions`, { withCredentials: true }).catch(() => ({ data: { commissions: [] } })),
          axios.get(`${API}/api/finance/deduction-types`, { withCredentials: true }).catch(() => ({ data: { deduction_types: {} } })),
          axios.get(`${API}/api/projects`, { withCredentials: true }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/hr/classification-summary`, { withCredentials: true }).catch(() => ({ data: null }))
        ]);
        setIncentives(incentivesRes.data?.incentives || []);
        setCommissions(commissionsRes.data?.commissions || []);
        setDeductionTypes(deductionTypesRes.data?.deduction_types || {});
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.projects || []);
        setClassificationSummary(classificationRes.data);
      } catch (err) {
        console.log('Compensation data fetch error:', err);
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

  // ============ INCENTIVE HANDLERS ============
  const handleCreateIncentive = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...incentiveData,
        amount: parseFloat(incentiveData.amount) || 0,
        percentage_of: incentiveData.calculation_type === 'percentage' ? parseFloat(incentiveData.percentage_of) || 0 : null,
        project_id: incentiveData.project_id || null
      };
      
      await axios.post(`${API}/api/finance/incentives`, payload, { withCredentials: true });
      toast.success('Incentive created successfully');
      setShowIncentiveModal(false);
      setIncentiveData({
        employee_id: '',
        incentive_type: 'booking',
        project_id: '',
        amount: '',
        calculation_type: 'fixed',
        percentage_of: '',
        trigger_event: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create incentive');
    }
  };
  
  const handleApproveIncentive = async (incentiveId) => {
    try {
      await axios.put(`${API}/api/finance/incentives/${incentiveId}/approve`, {}, { withCredentials: true });
      toast.success('Incentive approved');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve incentive');
    }
  };
  
  const handleRejectIncentive = async () => {
    if (!rejectTarget.id || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await axios.put(`${API}/api/finance/incentives/${rejectTarget.id}/reject`, 
        { reason: rejectReason }, 
        { withCredentials: true }
      );
      toast.success('Incentive rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setRejectTarget({ type: null, id: null });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject incentive');
    }
  };
  
  const handleEditIncentive = async (e) => {
    e.preventDefault();
    if (!editIncentiveData) return;
    try {
      await axios.put(`${API}/api/finance/incentives/${editIncentiveData.incentive_id}`, {
        amount: parseFloat(editIncentiveData.amount) || 0,
        notes: editIncentiveData.notes || ''
      }, { withCredentials: true });
      toast.success('Incentive updated');
      setShowEditIncentiveModal(false);
      setEditIncentiveData(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update incentive');
    }
  };
  
  const handleDeleteIncentive = async (incentiveId) => {
    if (!window.confirm('Are you sure you want to delete this incentive?')) return;
    try {
      await axios.delete(`${API}/api/finance/incentives/${incentiveId}`, { withCredentials: true });
      toast.success('Incentive deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete incentive');
    }
  };
  
  const handleApproveCommission = async (commissionId) => {
    try {
      await axios.put(`${API}/api/finance/commissions/${commissionId}/approve`, {}, { withCredentials: true });
      toast.success('Commission approved');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve commission');
    }
  };
  
  const handleRejectCommission = async () => {
    if (!rejectTarget.id || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await axios.put(`${API}/api/finance/commissions/${rejectTarget.id}/reject`, 
        { reason: rejectReason }, 
        { withCredentials: true }
      );
      toast.success('Commission rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setRejectTarget({ type: null, id: null });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject commission');
    }
  };
  
  const handleEditCommission = async (e) => {
    e.preventDefault();
    if (!editCommissionData) return;
    try {
      await axios.put(`${API}/api/finance/commissions/${editCommissionData.commission_id}`, {
        amount: parseFloat(editCommissionData.amount) || 0,
        notes: editCommissionData.notes || '',
        recipient_name: editCommissionData.recipient_name || ''
      }, { withCredentials: true });
      toast.success('Commission updated');
      setShowEditCommissionModal(false);
      setEditCommissionData(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update commission');
    }
  };
  
  const handleDeleteCommission = async (commissionId) => {
    if (!window.confirm('Are you sure you want to delete this commission?')) return;
    try {
      await axios.delete(`${API}/api/finance/commissions/${commissionId}`, { withCredentials: true });
      toast.success('Commission deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete commission');
    }
  };
  
  const openRejectModal = (type, id) => {
    setRejectTarget({ type, id });
    setRejectReason('');
    setShowRejectModal(true);
  };
  
  const handleRejectSubmit = () => {
    if (rejectTarget.type === 'incentive') {
      handleRejectIncentive();
    } else if (rejectTarget.type === 'commission') {
      handleRejectCommission();
    }
  };
  
  const handlePayoutIncentive = async (e) => {
    e.preventDefault();
    if (!selectedIncentive) return;
    
    try {
      await axios.post(`${API}/api/finance/incentives/${selectedIncentive.incentive_id}/payout`, {
        incentive_id: selectedIncentive.incentive_id,
        ...payoutData
      }, { withCredentials: true });
      toast.success('Incentive paid successfully');
      setShowPayoutModal(false);
      setSelectedIncentive(null);
      setPayoutData({ account_id: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process payout');
    }
  };
  
  // ============ COMMISSION HANDLERS ============
  const handleCreateCommission = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...commissionData,
        amount: parseFloat(commissionData.amount) || 0,
        percentage_of: commissionData.calculation_type === 'percentage' ? parseFloat(commissionData.percentage_of) || 0 : null,
        project_id: commissionData.project_id || null
      };
      
      await axios.post(`${API}/api/finance/commissions`, payload, { withCredentials: true });
      toast.success('Commission created successfully');
      setShowCommissionModal(false);
      setCommissionData({
        recipient_type: 'referral',
        recipient_name: '',
        recipient_contact: '',
        commission_type: 'referral',
        project_id: '',
        amount: '',
        calculation_type: 'fixed',
        percentage_of: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create commission');
    }
  };
  
  const handlePayoutCommission = async (e) => {
    e.preventDefault();
    if (!selectedCommission) return;
    
    try {
      await axios.post(`${API}/api/finance/commissions/${selectedCommission.commission_id}/payout`, {
        commission_id: selectedCommission.commission_id,
        ...payoutData
      }, { withCredentials: true });
      toast.success('Commission paid successfully');
      setShowPayoutModal(false);
      setSelectedCommission(null);
      setPayoutData({ account_id: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process payout');
    }
  };
  
  // ============ DEDUCTION HANDLERS ============
  const handleAddDeduction = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        employee_id: deductionData.employee_id,
        month_year: deductionData.month_year,
        gross_salary: parseFloat(deductionData.gross_salary) || 0,
        deductions: deductionData.deductions.map(d => ({
          deduction_type: d.type,
          amount: parseFloat(d.amount) || 0,
          reason: d.reason || '',
          custom_label: d.custom_label || null,
          auto_calculated: false
        }))
      };
      
      await axios.post(`${API}/api/finance/salary-processing`, payload, { withCredentials: true });
      toast.success('Salary processed with deductions');
      setShowDeductionModal(false);
      setDeductionData({
        employee_id: '',
        month_year: getCurrentMonth(),
        gross_salary: '',
        deductions: []
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process salary');
    }
  };
  
  const addDeductionRow = () => {
    setDeductionData(prev => ({
      ...prev,
      deductions: [...prev.deductions, { type: 'leave', amount: '', reason: '', custom_label: '' }]
    }));
  };
  
  const removeDeductionRow = (index) => {
    setDeductionData(prev => ({
      ...prev,
      deductions: prev.deductions.filter((_, i) => i !== index)
    }));
  };
  
  const updateDeductionRow = (index, field, value) => {
    setDeductionData(prev => ({
      ...prev,
      deductions: prev.deductions.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }));
  };

  // ============ CLASSIFICATION HANDLERS ============
  const handleChangeClassification = async () => {
    if (!selectedEmployeeForClassification || !newClassification) return;
    
    try {
      await axios.put(
        `${API}/api/hr/employees/${selectedEmployeeForClassification.user_id}/classification`,
        { classification: newClassification },
        { withCredentials: true }
      );
      toast.success(`Classification updated to ${newClassification}`);
      setShowClassificationModal(false);
      setSelectedEmployeeForClassification(null);
      setNewClassification('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update classification');
    }
  };

  const fetchClassificationHistory = async (employee) => {
    try {
      const res = await axios.get(
        `${API}/api/hr/employees/${employee.user_id}/classification-history`,
        { withCredentials: true }
      );
      setClassificationHistory(res.data?.history || []);
      setSelectedEmployeeForClassification(employee);
      setShowClassificationHistoryModal(true);
    } catch (err) {
      toast.error('Failed to fetch classification history');
    }
  };

  const openClassificationModal = (employee) => {
    setSelectedEmployeeForClassification(employee);
    setNewClassification(employee.employee_classification || 'permanent');
    setShowClassificationModal(true);
  };

  const getClassificationBadge = (classification) => {
    const config = {
      permanent: { bg: 'bg-green-100', text: 'text-green-800', label: 'Permanent' },
      probation: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Probation' },
      trainee: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Trainee' },
      freelancer: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Freelancer' },
      channel_partner: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Channel Partner' }
    };
    const c = config[classification] || { bg: 'bg-gray-100', text: 'text-gray-800', label: classification };
    return <Badge className={`${c.bg} ${c.text}`}>{c.label}</Badge>;
  };

  const getPaymentMethodLabel = (classification) => {
    const methods = {
      permanent: 'Salary',
      probation: 'Salary',
      trainee: 'Stipend',
      freelancer: 'Commission',
      channel_partner: 'Commission'
    };
    return methods[classification] || 'Unknown';
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Status</TabsTrigger>
          <TabsTrigger value="employees">All Employees</TabsTrigger>
          <TabsTrigger value="classifications">Classifications</TabsTrigger>
          <TabsTrigger value="incentives">Incentives</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Label>Select Month:</Label>
              <Input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-48"
              />
            </div>
            <Button onClick={() => setShowDeductionModal(true)} variant="outline">
              <Minus className="w-4 h-4 mr-2" /> Process with Deductions
            </Button>
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
                      <th className="text-right py-3 px-4">Gross Salary</th>
                      <th className="text-right py-3 px-4">Deductions</th>
                      <th className="text-right py-3 px-4">Net Payable</th>
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
                          <td className="text-right py-3 px-4">{formatCurrency(cycle.gross_salary || cycle.monthly_salary)}</td>
                          <td className="text-right py-3 px-4 text-red-600">
                            {(cycle.total_deductions || 0) > 0 ? (
                              <span title={cycle.deductions?.map(d => `${d.type_name}: ₹${d.amount}`).join('\n')}>
                                -{formatCurrency(cycle.total_deductions)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="text-right py-3 px-4 font-medium">{formatCurrency(cycle.net_payable || cycle.monthly_salary)}</td>
                          <td className="text-right py-3 px-4 text-green-600">{formatCurrency((cycle.total_salary_paid || 0) + (cycle.total_advances || 0))}</td>
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
        
        {/* Incentives Tab */}
        <TabsContent value="incentives" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-500" />
                  Incentive Management
                </CardTitle>
                <CardDescription>Manage booking and execution incentives</CardDescription>
              </div>
              <Button onClick={() => setShowIncentiveModal(true)}>
                <Plus className="w-4 h-4 mr-2" /> Create Incentive
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-xs text-purple-600">Total Incentives</p>
                    <p className="text-xl font-bold text-purple-700">
                      {formatCurrency(incentives.reduce((sum, i) => sum + (i.amount || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <p className="text-xs text-amber-600">Pending Approval</p>
                    <p className="text-xl font-bold text-amber-700">
                      {formatCurrency(incentives.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-blue-600">Approved</p>
                    <p className="text-xl font-bold text-blue-700">
                      {formatCurrency(incentives.filter(i => i.status === 'approved').reduce((sum, i) => sum + (i.amount || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-600">Paid Out</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(incentives.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0))}
                    </p>
                  </div>
                </div>
                
                {/* Incentives List */}
                <div className="divide-y">
                  {incentives.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No incentives found</p>
                  ) : (
                    incentives.map(inc => (
                      <div key={inc.incentive_id} className="py-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{inc.employee_name}</p>
                            <Badge variant={inc.status === 'paid' ? 'default' : inc.status === 'approved' ? 'secondary' : 'outline'}>
                              {inc.status}
                            </Badge>
                            {inc.project_linked && (
                              <Badge variant="outline" className="text-xs">Project-Linked</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">{inc.incentive_type_name}</p>
                          {inc.project_name && <p className="text-xs text-slate-400">Project: {inc.project_name}</p>}
                        </div>
                        <div className="text-right mr-4">
                          <p className="font-bold text-lg">{formatCurrency(inc.amount)}</p>
                          <p className="text-xs text-slate-400">{inc.trigger_event || inc.calculation_type}</p>
                        </div>
                        <div className="flex gap-2">
                          {inc.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => handleApproveIncentive(inc.incentive_id)}>
                              Approve
                            </Button>
                          )}
                          {(inc.status === 'pending' || inc.status === 'approved') && (
                            <Button size="sm" onClick={() => {
                              setSelectedIncentive(inc);
                              setShowPayoutModal(true);
                            }}>
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Commissions Tab */}
        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-500" />
                  Commission Management
                </CardTitle>
                <CardDescription>Manage external commissions for referrals and channel partners</CardDescription>
              </div>
              <Button onClick={() => setShowCommissionModal(true)}>
                <Plus className="w-4 h-4 mr-2" /> Create Commission
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-xs text-indigo-600">Total Commissions</p>
                    <p className="text-xl font-bold text-indigo-700">
                      {formatCurrency(commissions.reduce((sum, c) => sum + (c.amount || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <p className="text-xs text-amber-600">Pending</p>
                    <p className="text-xl font-bold text-amber-700">
                      {formatCurrency(commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-600">Paid</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0))}
                    </p>
                  </div>
                </div>
                
                {/* Commissions List */}
                <div className="divide-y">
                  {commissions.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No commissions found</p>
                  ) : (
                    commissions.map(com => (
                      <div key={com.commission_id} className="py-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{com.recipient_name}</p>
                            <Badge variant={com.status === 'paid' ? 'default' : 'outline'}>
                              {com.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500">{com.commission_type_name}</p>
                          {com.project_name && <p className="text-xs text-slate-400">Project: {com.project_name}</p>}
                        </div>
                        <div className="text-right mr-4">
                          <p className="font-bold text-lg">{formatCurrency(com.amount)}</p>
                          <p className="text-xs text-slate-400">{com.recipient_type}</p>
                        </div>
                        <div>
                          {com.status === 'pending' && (
                            <Button size="sm" onClick={() => {
                              setSelectedCommission(com);
                              setShowPayoutModal(true);
                            }}>
                              Pay
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Classifications Tab */}
        <TabsContent value="classifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Employee Classifications
                  </CardTitle>
                  <CardDescription>Manage employee types and payment workflows</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Classification Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {classificationSummary && Object.entries(classificationSummary.by_classification || {}).map(([cls, data]) => (
                  <Card key={cls} className={`border-l-4 ${
                    cls === 'permanent' ? 'border-l-green-500' :
                    cls === 'probation' ? 'border-l-blue-500' :
                    cls === 'trainee' ? 'border-l-purple-500' :
                    cls === 'freelancer' ? 'border-l-orange-500' :
                    'border-l-pink-500'
                  }`}>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{data.count}</div>
                      <div className="text-sm font-medium capitalize">{cls.replace('_', ' ')}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {getPaymentMethodLabel(cls)} workflow
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {data.is_salary_eligible && <Badge variant="outline" className="text-xs">Salary</Badge>}
                        {data.is_stipend_eligible && <Badge variant="outline" className="text-xs">Stipend</Badge>}
                        {data.is_incentive_eligible && <Badge variant="outline" className="text-xs">Incentive</Badge>}
                        {data.is_statutory_exempt && <Badge variant="outline" className="text-xs bg-amber-50">No Statutory</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Payment Workflow Rules */}
              <Card className="mb-6 bg-slate-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Payment Workflow Rules (Enforced)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    {classificationSummary?.workflow_guidance && Object.entries(classificationSummary.workflow_guidance).map(([cls, rules]) => (
                      <div key={cls} className="p-3 bg-white rounded-lg border">
                        <div className="font-medium capitalize mb-1">{cls.replace('_', ' ')}</div>
                        <div className="text-xs space-y-1 text-slate-600">
                          <p><span className="font-medium">Payment:</span> {rules.payment_method}</p>
                          <p><span className="font-medium">Statutory:</span> {rules.statutory_deductions}</p>
                          <p><span className="font-medium">Can Receive:</span> {rules.can_receive?.join(', ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Employee List by Classification */}
              <div className="space-y-4">
                {classificationSummary && Object.entries(classificationSummary.by_classification || {}).map(([cls, data]) => (
                  data.employees?.length > 0 && (
                    <Card key={cls}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          {getClassificationBadge(cls)}
                          <span className="text-slate-500 font-normal">({data.count} employees)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="divide-y">
                          {data.employees.map(emp => (
                            <div key={emp.user_id} className="flex items-center justify-between py-2">
                              <div>
                                <p className="font-medium">{emp.name}</p>
                                <p className="text-sm text-slate-500">{emp.role} • {emp.email}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => fetchClassificationHistory(emp)}
                                  data-testid={`view-history-${emp.user_id}`}
                                >
                                  <History className="h-4 w-4 mr-1" />
                                  History
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openClassificationModal(emp)}
                                  data-testid={`change-classification-${emp.user_id}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Change
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                ))}
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
      
      {/* Create Incentive Modal */}
      <Dialog open={showIncentiveModal} onOpenChange={setShowIncentiveModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-500" />
              Create Incentive
            </DialogTitle>
            <DialogDescription>Create a new incentive for an employee</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateIncentive} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Employee</Label>
                <Select value={incentiveData.employee_id} onValueChange={v => setIncentiveData(prev => ({ ...prev, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {salaries.map(s => (
                      <SelectItem key={s.employee_id} value={s.employee_id}>{s.employee_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Incentive Type</Label>
                <Select value={incentiveData.incentive_type} onValueChange={v => setIncentiveData(prev => ({ ...prev, incentive_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking">Booking Incentive</SelectItem>
                    <SelectItem value="execution_50_percent">50% Collection Incentive</SelectItem>
                    <SelectItem value="project_completion">Project Completion</SelectItem>
                    <SelectItem value="customer_review">Customer Review</SelectItem>
                    <SelectItem value="performance">Performance Incentive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project (Optional)</Label>
                <Select value={incentiveData.project_id || "none"} onValueChange={v => setIncentiveData(prev => ({ ...prev, project_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.project_name || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Calculation Type</Label>
                <Select value={incentiveData.calculation_type} onValueChange={v => setIncentiveData(prev => ({ ...prev, calculation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{incentiveData.calculation_type === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}</Label>
                <Input 
                  type="number" 
                  value={incentiveData.amount} 
                  onChange={e => setIncentiveData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={incentiveData.calculation_type === 'percentage' ? 'e.g., 2' : 'e.g., 5000'}
                  required
                />
              </div>
              {incentiveData.calculation_type === 'percentage' && (
                <div className="col-span-2">
                  <Label>Percentage of (Base Amount ₹)</Label>
                  <Input 
                    type="number" 
                    value={incentiveData.percentage_of} 
                    onChange={e => setIncentiveData(prev => ({ ...prev, percentage_of: e.target.value }))}
                    placeholder="e.g., 500000 (booking amount)"
                  />
                </div>
              )}
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea 
                  value={incentiveData.notes} 
                  onChange={e => setIncentiveData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowIncentiveModal(false)}>Cancel</Button>
              <Button type="submit">Create Incentive</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Create Commission Modal */}
      <Dialog open={showCommissionModal} onOpenChange={setShowCommissionModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500" />
              Create Commission
            </DialogTitle>
            <DialogDescription>Create a commission for external parties</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCommission} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Recipient Type</Label>
                <Select value={commissionData.recipient_type} onValueChange={v => setCommissionData(prev => ({ ...prev, recipient_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referral">Referral Partner</SelectItem>
                    <SelectItem value="channel_partner">Channel Partner</SelectItem>
                    <SelectItem value="associate">Associate Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Commission Type</Label>
                <Select value={commissionData.commission_type} onValueChange={v => setCommissionData(prev => ({ ...prev, commission_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referral">Referral Commission</SelectItem>
                    <SelectItem value="channel_partner">Channel Partner</SelectItem>
                    <SelectItem value="project_linked">Project Commission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recipient Name</Label>
                <Input 
                  value={commissionData.recipient_name} 
                  onChange={e => setCommissionData(prev => ({ ...prev, recipient_name: e.target.value }))}
                  placeholder="Name"
                  required
                />
              </div>
              <div>
                <Label>Contact (Optional)</Label>
                <Input 
                  value={commissionData.recipient_contact} 
                  onChange={e => setCommissionData(prev => ({ ...prev, recipient_contact: e.target.value }))}
                  placeholder="Phone/Email"
                />
              </div>
              <div className="col-span-2">
                <Label>Project (Optional)</Label>
                <Select value={commissionData.project_id || "none"} onValueChange={v => setCommissionData(prev => ({ ...prev, project_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.project_name || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Calculation Type</Label>
                <Select value={commissionData.calculation_type} onValueChange={v => setCommissionData(prev => ({ ...prev, calculation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{commissionData.calculation_type === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}</Label>
                <Input 
                  type="number" 
                  value={commissionData.amount} 
                  onChange={e => setCommissionData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              {commissionData.calculation_type === 'percentage' && (
                <div className="col-span-2">
                  <Label>Percentage of (Base Amount ₹)</Label>
                  <Input 
                    type="number" 
                    value={commissionData.percentage_of} 
                    onChange={e => setCommissionData(prev => ({ ...prev, percentage_of: e.target.value }))}
                  />
                </div>
              )}
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea 
                  value={commissionData.notes} 
                  onChange={e => setCommissionData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCommissionModal(false)}>Cancel</Button>
              <Button type="submit">Create Commission</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Payout Modal (for both incentives and commissions) */}
      <Dialog open={showPayoutModal} onOpenChange={(open) => {
        setShowPayoutModal(open);
        if (!open) {
          setSelectedIncentive(null);
          setSelectedCommission(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-500" />
              Process Payout
            </DialogTitle>
            <DialogDescription>
              {selectedIncentive ? `Pay incentive to ${selectedIncentive.employee_name}` : 
               selectedCommission ? `Pay commission to ${selectedCommission.recipient_name}` : 'Process payout'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={selectedIncentive ? handlePayoutIncentive : handlePayoutCommission} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Amount to Pay</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency((selectedIncentive || selectedCommission)?.amount || 0)}
                </span>
              </div>
            </div>
            <div>
              <Label>Bank Account</Label>
              <Select value={payoutData.account_id} onValueChange={v => setPayoutData(prev => ({ ...prev, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.account_type === 'bank' && !a.is_archived).map(a => (
                    <SelectItem key={a.account_id} value={a.account_id}>
                      {a.account_name || a.name} ({formatCurrency(a.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input 
                type="date" 
                value={payoutData.payment_date} 
                onChange={e => setPayoutData(prev => ({ ...prev, payment_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                value={payoutData.notes} 
                onChange={e => setPayoutData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional payment notes..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPayoutModal(false)}>Cancel</Button>
              <Button type="submit">Process Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Salary Deduction Modal */}
      <Dialog open={showDeductionModal} onOpenChange={setShowDeductionModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minus className="w-5 h-5 text-red-500" />
              Process Salary with Deductions
            </DialogTitle>
            <DialogDescription>Add structured deductions to salary processing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDeduction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <Select value={deductionData.employee_id} onValueChange={v => {
                  const emp = salaries.find(s => s.employee_id === v);
                  setDeductionData(prev => ({ 
                    ...prev, 
                    employee_id: v,
                    gross_salary: emp?.monthly_salary || ''
                  }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {salaries.map(s => (
                      <SelectItem key={s.employee_id} value={s.employee_id}>{s.employee_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month</Label>
                <Input 
                  type="month" 
                  value={deductionData.month_year} 
                  onChange={e => setDeductionData(prev => ({ ...prev, month_year: e.target.value }))}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label>Gross Salary (₹)</Label>
                <Input 
                  type="number" 
                  value={deductionData.gross_salary} 
                  onChange={e => setDeductionData(prev => ({ ...prev, gross_salary: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            {/* Deductions Section */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">Deductions</h4>
                <Button type="button" size="sm" variant="outline" onClick={addDeductionRow}>
                  <Plus className="w-4 h-4 mr-1" /> Add Deduction
                </Button>
              </div>
              
              {deductionData.deductions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No deductions added</p>
              ) : (
                <div className="space-y-3">
                  {deductionData.deductions.map((ded, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded">
                      <div className="col-span-3">
                        <Label className="text-xs">Type</Label>
                        <Select value={ded.type} onValueChange={v => updateDeductionRow(idx, 'type', v)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leave">Leave Deduction</SelectItem>
                            <SelectItem value="late_attendance">Late Attendance</SelectItem>
                            <SelectItem value="loss_recovery">Loss/Damage Recovery</SelectItem>
                            <SelectItem value="advance_recovery">Advance Recovery</SelectItem>
                            <SelectItem value="penalty">Penalty/Disciplinary</SelectItem>
                            <SelectItem value="tds">TDS</SelectItem>
                            <SelectItem value="pf">Provident Fund</SelectItem>
                            <SelectItem value="esi">ESI</SelectItem>
                            <SelectItem value="professional_tax">Professional Tax</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Amount</Label>
                        <Input 
                          type="number" 
                          className="h-9"
                          value={ded.amount} 
                          onChange={e => updateDeductionRow(idx, 'amount', e.target.value)}
                          placeholder="₹"
                        />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">Reason</Label>
                        <Input 
                          className="h-9"
                          value={ded.reason} 
                          onChange={e => updateDeductionRow(idx, 'reason', e.target.value)}
                          placeholder="Reason..."
                        />
                      </div>
                      {ded.type === 'custom' && (
                        <div className="col-span-2">
                          <Label className="text-xs">Label</Label>
                          <Input 
                            className="h-9"
                            value={ded.custom_label} 
                            onChange={e => updateDeductionRow(idx, 'custom_label', e.target.value)}
                            placeholder="Label"
                          />
                        </div>
                      )}
                      <div className={ded.type === 'custom' ? 'col-span-1' : 'col-span-3'}>
                        <Button type="button" size="sm" variant="ghost" className="h-9 text-red-500" onClick={() => removeDeductionRow(idx)}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Summary */}
              {deductionData.deductions.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Gross Salary:</span>
                    <span>{formatCurrency(parseFloat(deductionData.gross_salary) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Total Deductions:</span>
                    <span>- {formatCurrency(deductionData.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                    <span>Net Payable:</span>
                    <span className="text-green-600">
                      {formatCurrency(
                        (parseFloat(deductionData.gross_salary) || 0) - 
                        deductionData.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDeductionModal(false)}>Cancel</Button>
              <Button type="submit">Process Salary</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Classification Modal */}
      <Dialog open={showClassificationModal} onOpenChange={setShowClassificationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Employee Classification</DialogTitle>
            <DialogDescription>
              Update classification for {selectedEmployeeForClassification?.name}. This will affect their payment workflow and statutory deductions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="font-medium text-amber-800 mb-1">⚠️ Important</p>
              <ul className="text-amber-700 text-xs space-y-1">
                <li>• <strong>Permanent/Probation:</strong> Salary workflow with statutory deductions (PF, ESI)</li>
                <li>• <strong>Trainee:</strong> Stipend workflow only, no statutory deductions</li>
                <li>• <strong>Freelancer/Channel Partner:</strong> Commission workflow only, no statutory deductions</li>
              </ul>
            </div>
            
            <div>
              <Label>Current Classification</Label>
              <div className="mt-1">
                {getClassificationBadge(selectedEmployeeForClassification?.employee_classification || 'permanent')}
              </div>
            </div>
            
            <div>
              <Label>New Classification</Label>
              <Select value={newClassification} onValueChange={setNewClassification}>
                <SelectTrigger data-testid="new-classification-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent Employee</SelectItem>
                  <SelectItem value="probation">Probation Employee</SelectItem>
                  <SelectItem value="trainee">Trainee / Intern</SelectItem>
                  <SelectItem value="freelancer">Freelancer / Consultant</SelectItem>
                  <SelectItem value="channel_partner">Channel Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newClassification && newClassification !== (selectedEmployeeForClassification?.employee_classification || 'permanent') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <p className="font-medium text-blue-800">After this change:</p>
                <p className="text-blue-700 text-xs mt-1">
                  {newClassification === 'permanent' && 'Employee will be eligible for Salary payments with statutory deductions (PF, ESI, Professional Tax).'}
                  {newClassification === 'probation' && 'Employee will be eligible for Salary payments with statutory deductions (PF, ESI).'}
                  {newClassification === 'trainee' && 'Employee will only receive Stipend payments. No statutory deductions.'}
                  {newClassification === 'freelancer' && 'Employee will only receive Commission/Professional Fee payments. No statutory deductions.'}
                  {newClassification === 'channel_partner' && 'Employee will only receive Commission payments. No statutory deductions.'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassificationModal(false)}>Cancel</Button>
            <Button 
              onClick={handleChangeClassification}
              disabled={!newClassification || newClassification === (selectedEmployeeForClassification?.employee_classification || 'permanent')}
              data-testid="confirm-classification-change"
            >
              Update Classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Classification History Modal */}
      <Dialog open={showClassificationHistoryModal} onOpenChange={setShowClassificationHistoryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Classification History</DialogTitle>
            <DialogDescription>
              History of classification changes for {selectedEmployeeForClassification?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {classificationHistory.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No classification changes recorded</p>
            ) : (
              <div className="space-y-3">
                {classificationHistory.map((record, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="bg-white p-2 rounded-full">
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getClassificationBadge(record.old_classification)}
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        {getClassificationBadge(record.new_classification)}
                      </div>
                      <p className="text-xs text-slate-500">
                        Changed by {record.changed_by_name} on {formatDate(record.changed_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassificationHistoryModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
