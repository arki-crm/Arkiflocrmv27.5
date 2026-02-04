import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  FileCheck,
  CheckCircle,
  XCircle,
  Info,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('fy');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [showStageBreakdown, setShowStageBreakdown] = useState(false);
  const [showCancelledProjects, setShowCancelledProjects] = useState(false);
  const [designers, setDesigners] = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState('all');

  useEffect(() => {
    fetchDashboard();
    fetchDesigners();
  }, [period, selectedDesigner]);

  const fetchDesigners = async () => {
    try {
      const response = await axios.get(`${API}/users?role=Designer`, { withCredentials: true });
      if (response.data) {
        setDesigners(response.data.filter(u => u.role === 'Designer' || u.role === 'SeniorDesigner'));
      }
    } catch (err) {
      console.error('Failed to fetch designers:', err);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      let url = `${API}/dashboards/sales?period=${period}`;
      
      if (selectedDesigner !== 'all') {
        url += `&designer_id=${selectedDesigner}`;
      }
      
      if (period === 'custom' && customDates.from && customDates.to) {
        url += `&from_date=${customDates.from}&to_date=${customDates.to}`;
      }
      
      const response = await axios.get(url, { withCredentials: true });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch sales dashboard:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied. Sales Dashboard requires Sales Manager or Admin permissions.');
      } else {
        toast.error('Failed to load sales dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getChangeColor = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-slate-500';
  };

  const getChangeIcon = (value) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const funnel = data?.funnel_summary || {};
  const conversions = data?.conversion_rates || {};
  const valueChanges = data?.value_changes || {};

  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="sales-dashboard">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Sales & Funnel Analysis</h1>
              <p className="text-sm text-slate-500">{data?.period?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fy">Financial Year</SelectItem>
                <SelectItem value="qtd">Quarter to Date</SelectItem>
                <SelectItem value="mtd">Month to Date</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-36 h-9"
                  value={customDates.from}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, from: e.target.value }))}
                />
                <span className="text-slate-400">to</span>
                <Input
                  type="date"
                  className="w-36 h-9"
                  value={customDates.to}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, to: e.target.value }))}
                />
                <Button size="sm" onClick={fetchDashboard}>Apply</Button>
              </div>
            )}
          </div>
        </div>

        {/* Value Source Indicator */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-indigo-800">Full Value Lifecycle</p>
            <p className="text-xs text-indigo-600">{data?.value_sources_tooltip}</p>
          </div>
        </div>

        {/* Funnel Cards - Values with Counts */}
        <div className="grid grid-cols-4 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-l-4 border-l-slate-400 cursor-help" data-testid="inquiry-card">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    Inquiry Value
                    <Info className="w-3 h-3" />
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(funnel.inquiry?.total_value)}</p>
                  <p className="text-xs text-slate-400 mt-1">{funnel.inquiry?.count} inquiries</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{funnel.inquiry?.tooltip}</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-l-4 border-l-blue-500 cursor-help" data-testid="booked-card">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    Booked Value
                    <Info className="w-3 h-3" />
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(funnel.booked?.total_value)}</p>
                  <p className="text-xs text-slate-400 mt-1">{funnel.booked?.count} booked</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{funnel.booked?.tooltip}</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-l-4 border-l-green-500 cursor-help" data-testid="signoff-card">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    Sign-Off Value
                    <Info className="w-3 h-3" />
                  </p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(funnel.signoff?.total_value)}</p>
                  <p className="text-xs text-slate-400 mt-1">{funnel.signoff?.count} signed-off</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{funnel.signoff?.tooltip}</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-l-4 border-l-red-500 cursor-help" data-testid="cancelled-card">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    Cancelled Value
                    <Info className="w-3 h-3" />
                  </p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(funnel.cancelled?.total_value)}</p>
                  <p className="text-xs text-slate-400 mt-1">{funnel.cancelled?.count} cancelled</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{funnel.cancelled?.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Conversion Rates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-4 py-4">
              {/* Inquiry */}
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                  <Users className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Inquiry</p>
                <p className="text-lg font-bold">{funnel.inquiry?.count}</p>
              </div>
              
              {/* Arrow with conversion rate */}
              <div className="flex flex-col items-center">
                <ArrowRight className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-medium text-blue-600 mt-1">
                  {conversions.inquiry_to_booked?.rate}%
                </span>
              </div>
              
              {/* Booked */}
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                  <FileCheck className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Booked</p>
                <p className="text-lg font-bold">{funnel.booked?.count}</p>
              </div>
              
              {/* Arrow with conversion rate */}
              <div className="flex flex-col items-center">
                <ArrowRight className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-medium text-green-600 mt-1">
                  {conversions.booked_to_signoff?.rate}%
                </span>
              </div>
              
              {/* Signed Off */}
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Signed-Off</p>
                <p className="text-lg font-bold">{funnel.signoff?.count}</p>
              </div>
              
              {/* Cancelled (separate) */}
              <div className="text-center ml-8 border-l pl-8 border-slate-200">
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Cancelled</p>
                <p className="text-lg font-bold">{funnel.cancelled?.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Value Change Analysis */}
        <div className="grid grid-cols-2 gap-4">
          <Card data-testid="inquiry-to-booked-change">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">
                Inquiry → Booked Value Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {getChangeIcon(valueChanges.inquiry_to_booked?.absolute_change)}
                <div>
                  <p className={`text-2xl font-bold ${getChangeColor(valueChanges.inquiry_to_booked?.absolute_change)}`}>
                    {valueChanges.inquiry_to_booked?.absolute_change >= 0 ? '+' : ''}
                    {formatCurrency(valueChanges.inquiry_to_booked?.absolute_change || 0)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {valueChanges.inquiry_to_booked?.percent_change >= 0 ? '+' : ''}
                    {valueChanges.inquiry_to_booked?.percent_change}% change
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-slate-600">
                    {valueChanges.inquiry_to_booked?.projects_with_increase} projects with increase
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-slate-600">
                    {valueChanges.inquiry_to_booked?.projects_with_decrease} projects with decrease
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="booked-to-signoff-change">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">
                Booked → Sign-Off Value Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {getChangeIcon(valueChanges.booked_to_signoff?.absolute_change)}
                <div>
                  <p className={`text-2xl font-bold ${getChangeColor(valueChanges.booked_to_signoff?.absolute_change)}`}>
                    {valueChanges.booked_to_signoff?.absolute_change >= 0 ? '+' : ''}
                    {formatCurrency(valueChanges.booked_to_signoff?.absolute_change || 0)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {valueChanges.booked_to_signoff?.percent_change >= 0 ? '+' : ''}
                    {valueChanges.booked_to_signoff?.percent_change}% change
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-slate-600">
                    {valueChanges.booked_to_signoff?.projects_with_increase} projects with increase
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-slate-600">
                    {valueChanges.booked_to_signoff?.projects_with_decrease} projects with decrease
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stage Breakdown - Collapsible */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-slate-50"
            onClick={() => setShowStageBreakdown(!showStageBreakdown)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Stage-wise Breakdown</CardTitle>
              {showStageBreakdown ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </CardHeader>
          {showStageBreakdown && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-slate-500">Stage</th>
                      <th className="text-center p-3 text-xs font-medium text-slate-500">Projects</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-500">Inquiry Value</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-500">Booked Value</th>
                      <th className="text-right p-3 text-xs font-medium text-slate-500">Sign-Off Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data?.stage_breakdown?.map((stage) => (
                      <tr key={stage.stage} className="hover:bg-slate-50">
                        <td className="p-3">
                          <Badge variant="outline">{stage.stage}</Badge>
                        </td>
                        <td className="p-3 text-center text-sm font-medium">{stage.count}</td>
                        <td className="p-3 text-right text-sm text-slate-600">
                          {formatCurrency(stage.inquiry_value)}
                        </td>
                        <td className="p-3 text-right text-sm text-blue-600">
                          {formatCurrency(stage.booked_value)}
                        </td>
                        <td className="p-3 text-right text-sm text-green-600 font-medium">
                          {formatCurrency(stage.signoff_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Cancelled Projects - Collapsible */}
        {data?.cancelled_projects?.length > 0 && (
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => setShowCancelledProjects(!showCancelledProjects)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-red-700">
                  Cancelled Projects ({data?.cancelled_projects?.length})
                </CardTitle>
                {showCancelledProjects ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </CardHeader>
            {showCancelledProjects && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-red-50 border-b">
                      <tr>
                        <th className="text-left p-3 text-xs font-medium text-slate-500">PID</th>
                        <th className="text-left p-3 text-xs font-medium text-slate-500">Client</th>
                        <th className="text-left p-3 text-xs font-medium text-slate-500">Designer</th>
                        <th className="text-right p-3 text-xs font-medium text-slate-500">Cancelled Value</th>
                        <th className="text-left p-3 text-xs font-medium text-slate-500">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data?.cancelled_projects?.map((project) => (
                        <tr 
                          key={project.project_id} 
                          className="hover:bg-red-50 cursor-pointer"
                          onClick={() => navigate(`/projects/${project.project_id}`)}
                        >
                          <td className="p-3">
                            <span className="font-mono text-sm text-slate-600">{project.pid || '-'}</span>
                          </td>
                          <td className="p-3 text-sm text-slate-900">{project.client_name}</td>
                          <td className="p-3 text-sm text-slate-600">{project.primary_designer || '-'}</td>
                          <td className="p-3 text-right text-sm font-medium text-red-600">
                            {formatCurrency(project.cancelled_value)}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              {project.cancellation_reason || 'Not specified'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Footer with timestamp */}
        <div className="text-center text-xs text-slate-400">
          Generated at {new Date(data?.generated_at).toLocaleString('en-IN')}
        </div>
      </div>
    </TooltipProvider>
  );
}
