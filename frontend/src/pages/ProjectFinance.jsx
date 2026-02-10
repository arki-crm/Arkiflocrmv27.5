import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Search, 
  Loader2, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FolderKanban,
  ArrowRight
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

const ProjectFinance = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalSignoffValue: 0,
    totalReceived: 0,
    totalPlanned: 0,
    totalActual: 0,
    projectsWithOverspend: 0
  });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/finance/project-finance`, {
        params: { search: search || undefined },
        withCredentials: true
      });
      setProjects(res.data);
      
      // Calculate stats - use signoff_value as primary (fallback to contract_value for compatibility)
      const total = res.data.reduce((acc, p) => ({
        totalSignoffValue: acc.totalSignoffValue + (p.signoff_value || p.contract_value || 0),
        totalReceived: acc.totalReceived + (p.total_received || 0),
        totalPlanned: acc.totalPlanned + (p.planned_cost || 0),
        totalActual: acc.totalActual + (p.actual_cost || 0),
        projectsWithOverspend: acc.projectsWithOverspend + (p.has_overspend ? 1 : 0)
      }), {
        totalSignoffValue: 0,
        totalReceived: 0,
        totalPlanned: 0,
        totalActual: 0,
        projectsWithOverspend: 0
      });
      
      setStats({
        totalProjects: res.data.length,
        ...total
      });
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchProjects();
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (!hasPermission('finance.view_project_finance')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="project-finance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Project Finance
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track project costs, vendor mappings, and financial health</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <FolderKanban className="w-4 h-4" />
              Projects
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.totalProjects}</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              Sign-off Value
            </div>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(stats.totalSignoffValue)}</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
              <TrendingUp className="w-4 h-4" />
              Received
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalReceived)}</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              Planned Cost
            </div>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalPlanned)}</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
              <TrendingDown className="w-4 h-4" />
              Actual Cost
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(stats.totalActual)}</p>
          </CardContent>
        </Card>
        
        <Card className={cn("border-slate-200", stats.projectsWithOverspend > 0 && "border-amber-300 bg-amber-50")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
              <AlertTriangle className="w-4 h-4" />
              Over Budget
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.projectsWithOverspend}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by PID, project name, or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="search-input"
        />
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {projects.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center">
              <p className="text-slate-500">No projects found</p>
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card 
              key={project.project_id} 
              className={cn(
                "border-slate-200 hover:border-blue-300 transition-colors cursor-pointer",
                project.has_overspend && "border-l-4 border-l-amber-500"
              )}
              onClick={() => navigate(`/finance/project-finance/${project.project_id}`)}
              data-testid={`project-card-${project.project_id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        {project.pid_display}
                      </span>
                      <Badge variant={project.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                        {project.status}
                      </Badge>
                      {project.has_overspend && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Over Budget
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 truncate">{project.project_name}</h3>
                    <p className="text-sm text-slate-500">{project.client_name}</p>
                    {project.current_stage && (
                      <p className="text-xs text-slate-400 mt-1">Stage: {project.current_stage}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-right">
                    <div>
                      <p className="text-xs text-slate-500">Sign-off Value</p>
                      <p className="font-semibold text-slate-900">{formatCurrency(project.signoff_value || project.contract_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Received</p>
                      <p className="font-semibold text-green-600">{formatCurrency(project.total_received)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Planned</p>
                      <p className="font-semibold text-blue-600">{formatCurrency(project.planned_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Actual</p>
                      <p className={cn(
                        "font-semibold",
                        project.has_overspend ? "text-red-600" : "text-slate-900"
                      )}>
                        {formatCurrency(project.actual_cost)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="hidden lg:flex flex-col items-end gap-1">
                    <div className={cn(
                      "text-sm font-semibold px-3 py-1 rounded-full",
                      project.safe_surplus >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {project.safe_surplus >= 0 ? 'Surplus: ' : 'Deficit: '}
                      {formatCurrency(Math.abs(project.safe_surplus))}
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-600">
                      View Details <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectFinance;
