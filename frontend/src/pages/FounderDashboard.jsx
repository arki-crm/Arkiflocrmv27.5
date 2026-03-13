import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Loader2, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  RefreshCw,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Target,
  DollarSign,
  BarChart3,
  Ban,
  PiggyBank,
  FileText,
  Users,
  Briefcase,
  Building,
  CreditCard,
  Receipt,
  ClipboardList,
  TrendingUp as ChartLine
} from 'lucide-react';
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

const FounderDashboard = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  
  // Main dashboard data from comprehensive endpoint
  const [dashboardData, setDashboardData] = useState(null);
  
  // Additional data from other endpoints
  const [safeSpend, setSafeSpend] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [expenseStats, setExpenseStats] = useState(null);
  const [safeUseSummary, setSafeUseSummary] = useState(null);
  const [liabilitiesSummary, setLiabilitiesSummary] = useState(null);
  const [revenueReality, setRevenueReality] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        founderRes,
        safeSpendRes, 
        alertsRes, 
        expenseStatsRes, 
        safeUseRes, 
        liabilitiesRes
      ] = await Promise.all([
        axios.get(`${API}/founder/dashboard`, { withCredentials: true }),
        axios.get(`${API}/finance/safe-spend`, { withCredentials: true }),
        axios.get(`${API}/finance/alerts`, { withCredentials: true }),
        axios.get(`${API}/finance/expense-requests/stats/summary`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/finance/safe-use-summary`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/finance/liabilities/summary`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      
      setDashboardData(founderRes.data);
      setSafeSpend(safeSpendRes.data);
      setAlerts(alertsRes.data);
      setExpenseStats(expenseStatsRes.data);
      setSafeUseSummary(safeUseRes.data);
      setLiabilitiesSummary(liabilitiesRes.data);
      setLastUpdated(new Date());
      
      // Fetch revenue reality check
      fetchRevenueReality();
    } catch (error) {
      console.error('Failed to fetch founder dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueReality = async () => {
    try {
      const res = await axios.get(`${API}/finance/revenue-reality-check?period=${revenuePeriod}`, { withCredentials: true });
      setRevenueReality(res.data);
    } catch (error) {
      console.error('Failed to fetch revenue reality:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dashboardData) {
      fetchRevenueReality();
    }
  }, [revenuePeriod]);

  if (!hasPermission('finance.founder_dashboard') && user?.role !== 'Admin' && user?.role !== 'Founder') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <ShieldX className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">This dashboard is restricted to Founders and Admins.</p>
        </div>
      </div>
    );
  }

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Failed to load dashboard</p>
      </div>
    );
  }

  const { summary, cash_position, receivable_pipeline, upcoming_payments, todays_activity, ongoing_projects, profitability, pending_approvals, sales_pipeline } = dashboardData;

  // Calculate health status
  const netPosition = summary?.net_position || 0;
  const health = netPosition < 0 ? 'critical' : netPosition < (summary?.payables || 0) ? 'warning' : 'healthy';
  const healthMessage = health === 'critical' ? 'Negative net position - immediate attention needed' : 
                        health === 'warning' ? 'Low buffer - proceed with caution' : 
                        'Finances look healthy';

  const healthColors = {
    healthy: { bg: 'bg-green-500', text: 'text-green-400', icon: ShieldCheck },
    warning: { bg: 'bg-amber-500', text: 'text-amber-400', icon: ShieldAlert },
    critical: { bg: 'bg-red-500', text: 'text-red-400', icon: ShieldX }
  };

  const HealthIcon = healthColors[health]?.icon || ShieldCheck;

  const alertIcons = {
    critical: XCircle,
    high: AlertTriangle,
    medium: AlertCircle,
    low: Bell
  };

  const alertColors = {
    critical: 'text-red-400 bg-red-500/20',
    high: 'text-amber-400 bg-amber-500/20',
    medium: 'text-blue-400 bg-blue-500/20',
    low: 'text-slate-400 bg-slate-500/20'
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6" data-testid="founder-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Founder Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time overview of your company's financial and operational health
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            data-testid="refresh-btn"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts && alerts.summary && (alerts.summary.critical > 0 || alerts.summary.high > 0) && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 font-medium">
              {alerts.summary.critical + alerts.summary.high} urgent alerts require attention
            </span>
          </div>
        </div>
      )}

      {/* Health Status + Safe Spend Answer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Health Status */}
        <Card className={cn(
          "border-0",
          health === 'healthy' && "bg-gradient-to-r from-green-900/50 to-green-800/30",
          health === 'warning' && "bg-gradient-to-r from-amber-900/50 to-amber-800/30",
          health === 'critical' && "bg-gradient-to-r from-red-900/50 to-red-800/30"
        )} data-testid="health-status-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              healthColors[health]?.bg
            )}>
              <HealthIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className={cn("text-2xl font-bold capitalize", healthColors[health]?.text)}>
                {health}
              </h2>
              <p className="text-slate-300">{healthMessage}</p>
            </div>
          </CardContent>
        </Card>

        {/* Safe Spend Answer */}
        <Card className={cn(
          "border-2",
          safeSpend?.can_spend_safely 
            ? "bg-green-900/30 border-green-600" 
            : "bg-red-900/30 border-red-600"
        )} data-testid="safe-spend-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Can you spend safely today?</p>
                <p className={cn(
                  "text-3xl font-bold",
                  safeSpend?.can_spend_safely ? "text-green-400" : "text-red-400"
                )}>
                  {safeSpend?.can_spend_safely ? "YES" : "NO"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Daily Safe Limit</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(safeSpend?.daily_safe_spend)}
                </p>
              </div>
            </div>
            {safeSpend?.warnings?.length > 0 && (
              <div className="mt-4 space-y-1">
                {safeSpend.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">⚠️ {w}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: CASH POSITION */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="cash-position-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-400" />
              Cash Position
            </CardTitle>
            <Badge className="bg-blue-900/50 text-blue-300">
              {formatCurrency(cash_position?.total)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Cash</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(cash_position?.by_type?.cash)}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Bank</p>
              <p className="text-xl font-bold text-blue-400">{formatCurrency(cash_position?.by_type?.bank)}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Digital</p>
              <p className="text-xl font-bold text-purple-400">{formatCurrency(cash_position?.by_type?.digital)}</p>
            </div>
          </div>
          
          {/* Account breakdown */}
          {cash_position?.accounts?.filter(a => a.balance > 0).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400 mb-2">Account Breakdown</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {cash_position.accounts.filter(a => a.balance > 0).slice(0, 6).map((acc, idx) => (
                  <div key={idx} className="bg-slate-700/30 rounded p-2 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-white truncate" style={{maxWidth: '150px'}}>{acc.account_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{acc.account_type} • {acc.holder}</p>
                    </div>
                    <p className="text-sm font-medium text-white">{formatCurrency(acc.balance)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 2: RECEIVABLE PIPELINE */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="receivables-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-400" />
              Receivable Pipeline
            </CardTitle>
            <Badge className="bg-green-900/50 text-green-300">
              {formatCurrency(receivable_pipeline?.total_receivable)} pending
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {receivable_pipeline?.projects_with_dues || 0} projects with pending payments
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {receivable_pipeline?.details?.length > 0 ? (
            <div className="space-y-3">
              {receivable_pipeline.details.slice(0, 5).map((proj, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-700/30 rounded-lg p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/finance/project-finance/${proj.project_id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-slate-600 px-2 py-0.5 rounded text-slate-300">
                          {proj.pid?.replace('ARKI-', '')}
                        </span>
                        <span className="text-white font-medium">{proj.project_name}</span>
                      </div>
                      <p className="text-sm text-slate-400">{proj.client_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">{formatCurrency(proj.balance_due)}</p>
                      <p className="text-xs text-slate-500">of {formatCurrency(proj.contract_value)}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Received: {formatCurrency(proj.received)}</span>
                      <span>{Math.round((proj.received / proj.contract_value) * 100)}%</span>
                    </div>
                    <Progress value={(proj.received / proj.contract_value) * 100} className="h-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>No pending receivables</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 3: UPCOMING PAYMENTS */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="upcoming-payments-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-red-400" />
              Upcoming Payments
            </CardTitle>
            <Badge className="bg-red-900/50 text-red-300">
              {formatCurrency(upcoming_payments?.total_payable)} due
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-amber-900/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-4 h-4 text-amber-400" />
                <p className="text-amber-400 text-xs">Expense Requests</p>
              </div>
              <p className="text-xl font-bold text-amber-300">{formatCurrency(upcoming_payments?.expense_requests?.total)}</p>
              <p className="text-xs text-slate-500">{upcoming_payments?.expense_requests?.count || 0} pending</p>
            </div>
            <div className="bg-purple-900/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building className="w-4 h-4 text-purple-400" />
                <p className="text-purple-400 text-xs">Vendor Payables</p>
              </div>
              <p className="text-xl font-bold text-purple-300">{formatCurrency(upcoming_payments?.vendor_payables?.total)}</p>
              <p className="text-xs text-slate-500">{upcoming_payments?.vendor_payables?.count || 0} invoices</p>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-400" />
                <p className="text-blue-400 text-xs">Salary Payable</p>
              </div>
              <p className="text-xl font-bold text-blue-300">{formatCurrency(upcoming_payments?.salary_payable)}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <p className="text-slate-400 text-xs">Other Liabilities</p>
              </div>
              <p className="text-xl font-bold text-slate-300">{formatCurrency(upcoming_payments?.other_liabilities)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 4: TODAY'S FINANCIAL ACTIVITY */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="todays-activity-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Today's Financial Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-900/30 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">Receipts</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(todays_activity?.receipts)}</p>
            </div>
            <div className="bg-red-900/30 rounded-lg p-4 text-center">
              <TrendingDown className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">Expenses</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(todays_activity?.expenses)}</p>
            </div>
            <div className={cn(
              "rounded-lg p-4 text-center",
              todays_activity?.net_movement >= 0 ? "bg-green-900/30" : "bg-red-900/30"
            )}>
              <ChartLine className={cn(
                "w-6 h-6 mx-auto mb-2",
                todays_activity?.net_movement >= 0 ? "text-green-400" : "text-red-400"
              )} />
              <p className="text-slate-400 text-xs mb-1">Net Movement</p>
              <p className={cn(
                "text-xl font-bold",
                todays_activity?.net_movement >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {todays_activity?.net_movement >= 0 ? '+' : ''}{formatCurrency(todays_activity?.net_movement)}
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <Receipt className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">Transactions</p>
              <p className="text-xl font-bold text-white">{todays_activity?.transaction_count || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 5: ONGOING PROJECTS */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="ongoing-projects-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              Ongoing Projects
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/project-finance')}
              className="text-blue-400 hover:text-blue-300"
            >
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {ongoing_projects?.length || 0} active projects
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {ongoing_projects?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="text-left p-3">Project</th>
                    <th className="text-center p-3">Progress</th>
                    <th className="text-right p-3">Contract Value</th>
                    <th className="text-right p-3">Received</th>
                    <th className="text-right p-3">Actual Cost</th>
                    <th className="text-right p-3">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {ongoing_projects.slice(0, 10).map((proj, idx) => (
                    <tr 
                      key={idx} 
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                      onClick={() => navigate(`/finance/project-finance/${proj.project_id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                            {proj.pid?.replace('ARKI-', '')}
                          </span>
                          <div>
                            <p className="text-white font-medium text-sm truncate" style={{maxWidth: '200px'}}>{proj.project_name}</p>
                            <p className="text-xs text-slate-500">{proj.client_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={proj.progress} className="w-16 h-2" />
                          <span className="text-xs text-slate-400">{proj.progress}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-white font-medium">{formatCurrency(proj.contract_value)}</td>
                      <td className="p-3 text-right text-green-400">{formatCurrency(proj.total_received)}</td>
                      <td className="p-3 text-right text-amber-400">{formatCurrency(proj.actual_cost)}</td>
                      <td className="p-3 text-right">
                        <span className={cn(
                          "font-bold",
                          proj.profit_loss >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {formatCurrency(proj.profit_loss)}
                        </span>
                        <span className={cn(
                          "text-xs ml-1",
                          proj.profit_margin >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          ({proj.profit_margin}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Briefcase className="w-8 h-8 mx-auto mb-2" />
              <p>No active projects</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 6: PROJECT PROFITABILITY OVERVIEW */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="profitability-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Project Profitability Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs mb-1">Total Projects</p>
              <p className="text-2xl font-bold text-white">{profitability?.total_projects || 0}</p>
            </div>
            <div className="bg-green-900/30 rounded-lg p-4 text-center">
              <p className="text-green-400 text-xs mb-1">Profitable</p>
              <p className="text-2xl font-bold text-green-400">{profitability?.profitable_projects || 0}</p>
              <p className="text-xs text-slate-500">{formatCurrency(profitability?.total_profit)}</p>
            </div>
            <div className="bg-red-900/30 rounded-lg p-4 text-center">
              <p className="text-red-400 text-xs mb-1">Loss Making</p>
              <p className="text-2xl font-bold text-red-400">{profitability?.loss_making_projects || 0}</p>
              <p className="text-xs text-slate-500">-{formatCurrency(profitability?.total_loss)}</p>
            </div>
            <div className={cn(
              "rounded-lg p-4 text-center",
              (profitability?.net_profit || 0) >= 0 ? "bg-emerald-900/30" : "bg-red-900/30"
            )}>
              <p className="text-slate-400 text-xs mb-1">Net Profit</p>
              <p className={cn(
                "text-2xl font-bold",
                (profitability?.net_profit || 0) >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {formatCurrency(profitability?.net_profit)}
              </p>
            </div>
          </div>

          {/* Top Profitable & Loss Making */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Profitable */}
            {profitability?.top_profitable?.length > 0 && (
              <div>
                <p className="text-sm text-green-400 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Top Profitable
                </p>
                <div className="space-y-2">
                  {profitability.top_profitable.slice(0, 3).map((p, i) => (
                    <div key={i} className="bg-green-900/20 rounded p-2 flex justify-between">
                      <span className="text-sm text-white truncate" style={{maxWidth: '200px'}}>{p.project_name}</span>
                      <span className="text-green-400 font-medium">{formatCurrency(p.profit_loss)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Loss Making */}
            {profitability?.top_loss_making?.length > 0 && (
              <div>
                <p className="text-sm text-red-400 mb-2 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" /> Needs Attention
                </p>
                <div className="space-y-2">
                  {profitability.top_loss_making.slice(0, 3).map((p, i) => (
                    <div key={i} className="bg-red-900/20 rounded p-2 flex justify-between">
                      <span className="text-sm text-white truncate" style={{maxWidth: '200px'}}>{p.project_name}</span>
                      <span className="text-red-400 font-medium">{formatCurrency(p.profit_loss)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 7: PENDING APPROVALS */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="pending-approvals-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Pending Approvals
            </CardTitle>
            {pending_approvals?.total_count > 0 && (
              <Badge className="bg-amber-900/50 text-amber-300">
                {pending_approvals.total_count} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {pending_approvals?.total_count > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Expense Requests */}
              <div className="bg-amber-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-amber-400 font-medium flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Expense Requests
                  </p>
                  <Badge variant="outline" className="border-amber-600 text-amber-400">
                    {pending_approvals.expense_requests?.count || 0}
                  </Badge>
                </div>
                <p className="text-xl font-bold text-white mb-2">
                  {formatCurrency(pending_approvals.expense_requests?.total_amount)}
                </p>
                {pending_approvals.expense_requests?.items?.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-sm text-slate-400 mb-1 flex justify-between">
                    <span className="truncate" style={{maxWidth: '150px'}}>{item.description}</span>
                    <span className="text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/finance/expense-requests')}
                  className="text-amber-400 hover:text-amber-300 mt-2 w-full"
                >
                  Review All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Vendor Payments */}
              <div className="bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-purple-400 font-medium flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Vendor Payments
                  </p>
                  <Badge variant="outline" className="border-purple-600 text-purple-400">
                    {pending_approvals.vendor_payments?.count || 0}
                  </Badge>
                </div>
                <p className="text-xl font-bold text-white mb-2">
                  {formatCurrency(pending_approvals.vendor_payments?.total_amount)}
                </p>
                {pending_approvals.vendor_payments?.items?.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-sm text-slate-400 mb-1 flex justify-between">
                    <span className="truncate" style={{maxWidth: '150px'}}>{item.vendor_name}</span>
                    <span className="text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>No pending approvals</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 8: SALES PIPELINE */}
      {/* ============================================================ */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="sales-pipeline-section">
        <CardHeader className="border-b border-slate-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              Sales Pipeline
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/sales')}
              className="text-blue-400 hover:text-blue-300"
            >
              View Funnel <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">Total Leads</p>
              <p className="text-2xl font-bold text-white">{sales_pipeline?.total_leads || 0}</p>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-blue-400 text-xs mb-1">New (30 days)</p>
              <p className="text-2xl font-bold text-blue-400">{sales_pipeline?.new_leads_30d || 0}</p>
            </div>
            <div className="bg-amber-900/30 rounded-lg p-4 text-center">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-amber-400 text-xs mb-1">Hot Leads</p>
              <p className="text-2xl font-bold text-amber-400">{sales_pipeline?.hot_leads || 0}</p>
            </div>
            <div className="bg-green-900/30 rounded-lg p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 text-xs mb-1">Conversions (30d)</p>
              <p className="text-2xl font-bold text-green-400">{sales_pipeline?.recent_conversions || 0}</p>
            </div>
          </div>

          {/* Lead Status Breakdown */}
          {sales_pipeline?.by_status && Object.keys(sales_pipeline.by_status).length > 0 && (
            <div>
              <p className="text-sm text-slate-400 mb-3">Lead Status Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(sales_pipeline.by_status).map(([status, count]) => (
                  <Badge 
                    key={status} 
                    variant="outline" 
                    className={cn(
                      "text-sm",
                      status === 'Qualified' && "border-green-600 text-green-400",
                      status === 'New' && "border-blue-600 text-blue-400",
                      status === 'Contacted' && "border-cyan-600 text-cyan-400",
                      status === 'In Progress' && "border-amber-600 text-amber-400",
                      status === 'Waiting' && "border-purple-600 text-purple-400",
                      !['Qualified', 'New', 'Contacted', 'In Progress', 'Waiting'].includes(status) && "border-slate-600 text-slate-400"
                    )}
                  >
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* ADDITIONAL SECTIONS - Alerts, Safe Use, Liabilities, Revenue Reality */}
      {/* ============================================================ */}

      {/* Alerts & Signals */}
      {alerts && alerts.alerts?.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Alerts & Signals
              </CardTitle>
              <div className="flex gap-2">
                {alerts.summary?.critical > 0 && (
                  <Badge className="bg-red-500/20 text-red-400">{alerts.summary.critical} Critical</Badge>
                )}
                {alerts.summary?.high > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400">{alerts.summary.high} High</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
              {alerts.alerts.slice(0, 10).map((alert, idx) => {
                const AlertIcon = alertIcons[alert.severity] || Bell;
                return (
                  <div key={idx} className="p-4 hover:bg-slate-800/50">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", alertColors[alert.severity])}>
                        <AlertIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{alert.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{alert.message}</p>
                      </div>
                      {alert.project_id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/finance/project-finance/${alert.project_id}`)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safe Use Summary */}
      {safeUseSummary && (
        <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="safe-use-summary">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-400" />
                Advance Cash Lock
              </CardTitle>
              <Badge 
                className={cn(
                  "text-xs",
                  safeUseSummary.safe_use_warning 
                    ? "bg-red-900/50 text-red-300 border-red-700" 
                    : "bg-emerald-900/50 text-emerald-300 border-emerald-700"
                )}
              >
                {safeUseSummary.safe_use_months} months runway
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-xs mb-1">Total Received</p>
                <p className="text-xl font-bold text-white">{formatCurrency(safeUseSummary.total_project_received)}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-amber-400 text-xs mb-1">Locked</p>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(safeUseSummary.total_locked)}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-orange-400 text-xs mb-1">Commitments</p>
                <p className="text-xl font-bold text-orange-400">{formatCurrency(safeUseSummary.total_commitments)}</p>
              </div>
              <div className="bg-emerald-900/30 rounded-lg p-4">
                <p className="text-emerald-400 text-xs mb-1">Safe to Use</p>
                <p className={cn(
                  "text-xl font-bold",
                  safeUseSummary.safe_use_warning ? "text-red-400" : "text-emerald-400"
                )}>
                  {formatCurrency(safeUseSummary.project_safe_to_use)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Liabilities */}
      {liabilitiesSummary && liabilitiesSummary.total_outstanding > 0 && (
        <Card className="bg-slate-800/50 border-slate-700 border-red-700/50 mb-6" data-testid="liabilities-summary">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-400" />
                Outstanding Liabilities
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/finance/liabilities')}
                className="text-blue-400 hover:text-blue-300"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-xs mb-1">Total Outstanding</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(liabilitiesSummary.total_outstanding)}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-xs mb-1">Due This Month</p>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(liabilitiesSummary.due_this_month)}</p>
              </div>
              <div className={cn(
                "rounded-lg p-4",
                liabilitiesSummary.overdue > 0 ? "bg-red-900/30" : "bg-slate-700/50"
              )}>
                <p className="text-slate-400 text-xs mb-1">Overdue</p>
                <p className={cn(
                  "text-2xl font-bold",
                  liabilitiesSummary.overdue > 0 ? "text-red-400" : "text-slate-400"
                )}>
                  {formatCurrency(liabilitiesSummary.overdue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Reality Check */}
      {revenueReality && (
        <Card className="bg-slate-800/50 border-slate-700 mb-6" data-testid="revenue-reality-check">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Revenue Reality Check
              </CardTitle>
              <Select value={revenuePeriod} onValueChange={setRevenuePeriod}>
                <SelectTrigger className="w-32 h-8 bg-slate-700 border-slate-600 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="month" className="text-white hover:bg-slate-700">Month</SelectItem>
                  <SelectItem value="quarter" className="text-white hover:bg-slate-700">Quarter</SelectItem>
                  <SelectItem value="year" className="text-white hover:bg-slate-700">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-xs mb-1">Total Booked</p>
                <p className="text-xl font-bold text-white">{formatCurrency(revenueReality.total_booked_value)}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-emerald-400 text-xs mb-1">Active Value</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(revenueReality.active_project_value)}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-green-400 text-xs mb-1">Cash Received</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(revenueReality.revenue_realised)}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-red-400 text-xs mb-1">Lost Value</p>
                <p className="text-xl font-bold text-red-400">{formatCurrency(revenueReality.lost_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Issues Message */}
      {(!alerts || alerts.alerts?.length === 0) && profitability?.loss_making_projects === 0 && pending_approvals?.total_count === 0 && (
        <Card className="bg-green-900/20 border-green-800">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-green-400 font-medium">All systems healthy. No critical alerts.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FounderDashboard;
