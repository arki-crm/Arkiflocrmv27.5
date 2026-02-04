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
  User,
  Users,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DesignerDashboard() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('fy');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [expandedDesigner, setExpandedDesigner] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, [period]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      let url = `${API}/dashboards/designer?period=${period}`;
      
      if (period === 'custom' && customDates.from && customDates.to) {
        url += `&from_date=${customDates.from}&to_date=${customDates.to}`;
      }
      
      const response = await axios.get(url, { withCredentials: true });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch designer dashboard:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied. Designer Dashboard requires Design Manager or Admin permissions.');
      } else {
        toast.error('Failed to load designer dashboard');
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

  const getRetentionColor = (rate) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const teamSummary = data?.team_summary || {};
  const designers = data?.designers || [];

  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="designer-dashboard">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Designer Performance</h1>
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
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800">Designer Value Attribution</p>
            <p className="text-xs text-purple-600">{data?.value_sources_tooltip}</p>
          </div>
        </div>

        {/* Team Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Total Booked Value</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(teamSummary.total_booked_value)}</p>
              <p className="text-xs text-slate-400 mt-1">Team total</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Total Sign-Off Value</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(teamSummary.total_signoff_value)}</p>
              <p className="text-xs text-slate-400 mt-1">Finalized contracts</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Net Value Change</p>
              <div className="flex items-center gap-2">
                {getChangeIcon(teamSummary.net_value_change)}
                <p className={`text-xl font-bold ${getChangeColor(teamSummary.net_value_change)}`}>
                  {teamSummary.net_value_change >= 0 ? '+' : ''}
                  {formatCurrency(teamSummary.net_value_change)}
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {teamSummary.net_value_change_percent >= 0 ? '+' : ''}
                {teamSummary.net_value_change_percent}%
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-slate-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Total Projects</p>
              <p className="text-xl font-bold text-slate-900">{teamSummary.total_projects}</p>
              <p className="text-xs text-slate-400 mt-1">All stages</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Active Designers</p>
              <p className="text-xl font-bold text-amber-600">{teamSummary.active_designers}</p>
              <p className="text-xs text-slate-400 mt-1">With projects</p>
            </CardContent>
          </Card>
        </div>

        {/* Designer Performance Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              Designer-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {designers.filter(d => d.designer_id !== 'unassigned').map((designer) => (
                <div key={designer.designer_id} className="border rounded-lg">
                  {/* Designer Row Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => setExpandedDesigner(
                      expandedDesigner === designer.designer_id ? null : designer.designer_id
                    )}
                    data-testid={`designer-row-${designer.designer_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{designer.designer_name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{designer.project_count} projects</span>
                          <span className={getRetentionColor(designer.retention_rate)}>
                            {designer.retention_rate}% retention
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Booked Value */}
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Booked</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {formatCurrency(designer.total_booked_value)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {designer.booked_value_contribution}% team
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Value locked at first payment</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Sign-Off Value */}
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Sign-Off</p>
                            <p className="text-sm font-semibold text-green-600">
                              {formatCurrency(designer.total_signoff_value)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {designer.signoff_value_contribution}% team
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Final contracted value</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Net Change */}
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Net Change</p>
                            <div className="flex items-center gap-1 justify-end">
                              {getChangeIcon(designer.net_value_change)}
                              <p className={`text-sm font-semibold ${getChangeColor(designer.net_value_change)}`}>
                                {designer.net_value_change >= 0 ? '+' : ''}
                                {formatCurrency(designer.net_value_change)}
                              </p>
                            </div>
                            <p className={`text-xs ${getChangeColor(designer.net_value_change_percent)}`}>
                              {designer.net_value_change_percent >= 0 ? '+' : ''}
                              {designer.net_value_change_percent}%
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sign-Off minus Booked value</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Project Status Badges */}
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <Clock className="w-3 h-3 mr-1" />
                          {designer.active_projects} active
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {designer.completed_projects} done
                        </Badge>
                        {designer.cancelled_projects > 0 && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            {designer.cancelled_projects}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Expand Icon */}
                      {expandedDesigner === designer.designer_id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedDesigner === designer.designer_id && (
                    <div className="border-t bg-slate-50 p-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Monthly Trend */}
                        {designer.monthly_breakdown?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Monthly Trend</h4>
                            <div className="space-y-2">
                              {designer.monthly_breakdown.slice(-6).map((month) => (
                                <div key={month.month} className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600">{month.month}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-xs text-slate-400">
                                      {month.project_count} proj
                                    </span>
                                    <span className="text-blue-600 min-w-[80px] text-right">
                                      {formatCurrency(month.booked_value)}
                                    </span>
                                    <span className="text-green-600 min-w-[80px] text-right">
                                      {formatCurrency(month.signoff_value)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Project List */}
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-3">Projects</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {designer.projects?.slice(0, 10).map((project) => (
                              <div 
                                key={project.project_id}
                                className="flex items-center justify-between text-sm p-2 bg-white rounded border cursor-pointer hover:bg-blue-50"
                                onClick={() => navigate(`/projects/${project.project_id}`)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-slate-500">
                                    {project.pid || project.project_id.slice(0, 8)}
                                  </span>
                                  <span className="text-slate-700">{project.client_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      project.status === 'Cancelled' 
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : project.status === 'Completed'
                                          ? 'bg-green-50 text-green-700 border-green-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                  >
                                    {project.status}
                                  </Badge>
                                  <span className="text-green-600 text-xs">
                                    {project.signoff_value > 0 
                                      ? formatCurrency(project.signoff_value) 
                                      : formatCurrency(project.booked_value)}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {designer.projects?.length > 10 && (
                              <p className="text-xs text-slate-400 text-center pt-2">
                                +{designer.projects.length - 10} more projects
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Cancelled Value (if any) */}
                      {designer.cancelled_value > 0 && (
                        <div className="mt-4 p-3 bg-red-50 rounded-lg">
                          <p className="text-sm text-red-700">
                            <XCircle className="w-4 h-4 inline mr-2" />
                            Cancelled Value: {formatCurrency(designer.cancelled_value)} from {designer.cancelled_projects} project(s)
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Unassigned Projects */}
              {designers.find(d => d.designer_id === 'unassigned')?.project_count > 0 && (
                <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Unassigned Projects</p>
                      <p className="text-sm text-amber-600">
                        {designers.find(d => d.designer_id === 'unassigned')?.project_count} projects without primary designer
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer with timestamp */}
        <div className="text-center text-xs text-slate-400">
          Generated at {new Date(data?.generated_at).toLocaleString('en-IN')}
        </div>
      </div>
    </TooltipProvider>
  );
}
