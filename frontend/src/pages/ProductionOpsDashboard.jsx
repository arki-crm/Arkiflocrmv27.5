import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  Wrench,
  ClipboardCheck,
  Home,
  RefreshCw,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// V1 Execution Stages (6 stages)
const EXECUTION_STAGES = [
  { key: "Validation", label: "Validation", icon: ClipboardCheck, color: "purple" },
  { key: "Kick-Off", label: "Kick-Off", icon: Play, color: "blue" },
  { key: "Production", label: "Production", icon: Package, color: "amber" },
  { key: "Delivery", label: "Delivery", icon: Truck, color: "orange" },
  { key: "Installation", label: "Installation", icon: Wrench, color: "cyan" },
  { key: "Handover", label: "Handover", icon: Home, color: "emerald" }
];

const ProductionOpsDashboard = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Production ops managers and those with admin.view_reports can access
    if (user && !hasPermission('admin.view_reports') && !hasPermission('milestones.update.production') && !user?.senior_manager_view) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate, hasPermission]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/production-ops/dashboard`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch production/ops dashboard:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const projectsByStage = data?.projects_by_stage || {};
  const delayedProjects = data?.delayed_projects || [];
  const upcomingDeliveries = data?.upcoming_deliveries || [];
  const recentCompletions = data?.recent_completions || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-orange-600" />
            Production & Operations
          </h1>
          <p className="text-sm text-slate-500">Validation, Production, Delivery & Handover</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {EXECUTION_STAGES.map((stage) => {
          const StageIcon = stage.icon;
          const count = projectsByStage[stage.key] || 0;
          const colorClasses = {
            purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
            blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
            amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
            cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
            emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' }
          };
          const colors = colorClasses[stage.color];
          
          return (
            <Card key={stage.key} className={cn("border", colors.border, colors.bg)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <StageIcon className={cn("w-4 h-4", colors.text)} />
                  <span className="text-xs text-slate-500 uppercase">{stage.label}</span>
                </div>
                <p className={cn("text-2xl font-bold", colors.text)}>{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(
          "border-slate-200",
          (summary.delayed_count || 0) > 0 && "border-red-200 bg-red-50"
        )}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Delayed Projects</p>
              <p className="text-2xl font-bold text-red-600">{summary.delayed_count || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Due This Week</p>
              <p className="text-2xl font-bold text-blue-600">{summary.due_this_week || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-400" />
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Completed (Month)</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.completed_this_month || 0}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visual */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Execution Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-48">
            {EXECUTION_STAGES.map((stage, index) => {
              const count = projectsByStage[stage.key] || 0;
              const maxCount = Math.max(...Object.values(projectsByStage), 1);
              const height = (count / maxCount) * 100;
              const StageIcon = stage.icon;
              
              const colorClasses = {
                purple: 'bg-purple-500',
                blue: 'bg-blue-500',
                amber: 'bg-amber-500',
                orange: 'bg-orange-500',
                cyan: 'bg-cyan-500',
                emerald: 'bg-emerald-500'
              };
              
              return (
                <div key={stage.key} className="flex flex-col items-center flex-1">
                  <span className="text-sm font-semibold text-slate-700 mb-1">{count}</span>
                  <div 
                    className={cn(
                      "w-full rounded-t-md transition-all duration-300",
                      colorClasses[stage.color]
                    )}
                    style={{ height: `${Math.max(height, 8)}%` }}
                  />
                  <div className="flex flex-col items-center mt-2">
                    <StageIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-500 mt-1 text-center leading-tight">
                      {stage.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delayed Projects */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delayed Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {delayedProjects.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {delayedProjects.map((project) => (
                  <div 
                    key={project.project_id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate(`/projects/${project.project_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{project.project_name}</p>
                      <p className="text-xs text-slate-500">{project.client_name} • {project.stage}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs ml-2">
                      {project.days_delayed} days
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-slate-400 ml-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-500">No delayed projects!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deliveries */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Upcoming (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeliveries.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {upcomingDeliveries.map((project) => (
                  <div 
                    key={project.project_id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => navigate(`/projects/${project.project_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{project.project_name}</p>
                      <p className="text-xs text-slate-500">{project.client_name} • {project.stage}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 text-xs ml-2">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(project.expected_date)}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-slate-400 ml-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No upcoming deliveries</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductionOpsDashboard;
