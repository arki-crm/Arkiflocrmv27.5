import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  AlertTriangle,
  Eye,
  ArrowRight,
  Clipboard
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ValidationPipeline = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Require projects.view_all permission for validation pipeline
    if (user && !hasPermission('projects.view_all')) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate, hasPermission]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/validation-pipeline`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch validation pipeline:', err);
      toast.error('Failed to load validation pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (status) => {
    if (!selectedProject) return;
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/validation-pipeline/${selectedProject.design_project.id}/validate`, {
        status,
        notes: validationNotes
      }, { withCredentials: true });
      
      toast.success(status === 'approved' ? 'Validation approved!' : 'Revision requested');
      setShowValidationModal(false);
      setValidationNotes('');
      fetchData();
    } catch (err) {
      console.error('Failed to validate:', err);
      toast.error('Failed to process validation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToProduction = async (designProjectId) => {
    try {
      await axios.post(`${API}/validation-pipeline/${designProjectId}/send-to-production`, {}, {
        withCredentials: true
      });
      
      toast.success('Project sent to production!');
      fetchData();
    } catch (err) {
      console.error('Failed to send to production:', err);
      toast.error('Failed to send to production');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const pipeline = data?.pipeline || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clipboard className="w-7 h-7 text-emerald-600" />
            Validation Pipeline
          </h1>
          <p className="text-sm text-slate-500">Production Manager - Validate and approve designs</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {pipeline.length} Pending Validation
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-slate-500 uppercase">Drawings to Validate</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {pipeline.filter(p => p.has_drawings).length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-slate-500 uppercase">Ready for Production</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">
              {pipeline.filter(p => p.has_drawings && p.has_sign_off).length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-500 uppercase">Missing Sign-off</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {pipeline.filter(p => !p.has_sign_off).length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-slate-500 uppercase">Missing Drawings</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {pipeline.filter(p => !p.has_drawings).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Items */}
      <div className="space-y-4">
        {pipeline.length > 0 ? (
          pipeline.map((item) => (
            <Card key={item.design_project.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Designer Avatar */}
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-white font-medium",
                      "bg-emerald-500"
                    )}>
                      {item.designer?.picture ? (
                        <img src={item.designer.picture} alt={item.designer.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(item.designer?.name)
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {item.project?.project_name || 'Untitled Project'}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {item.project?.client_name} • Designer: {item.designer?.name}
                      </p>
                      
                      {/* File Status */}
                      <div className="flex items-center gap-3 mt-3">
                        <Badge className={cn(
                          'text-xs',
                          item.has_drawings ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        )}>
                          <FileText className="w-3 h-3 mr-1" />
                          {item.has_drawings ? 'Drawings Uploaded' : 'No Drawings'}
                        </Badge>
                        
                        <Badge className={cn(
                          'text-xs',
                          item.has_sign_off ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {item.has_sign_off ? 'Sign-off Received' : 'No Sign-off'}
                        </Badge>
                      </div>
                      
                      {/* Files List */}
                      {item.files?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-slate-500">Uploaded Files:</p>
                          {item.files.map((file) => (
                            <a 
                              key={file.id}
                              href={file.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              {file.file_name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/projects/${item.design_project.project_id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    
                    {item.has_drawings && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProject(item);
                          setShowValidationModal(true);
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Validate
                      </Button>
                    )}
                    
                    {item.has_drawings && item.has_sign_off && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleSendToProduction(item.design_project.id)}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send to Production
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-slate-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-700">All caught up!</h3>
              <p className="text-sm text-slate-500">No projects pending validation</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Validation Modal */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Validate Project
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                Validating: <span className="font-medium">{selectedProject?.project?.project_name}</span>
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">Notes (Optional)</label>
              <Textarea
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Add validation notes or revision requests..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleValidate('needs_revision')}
              disabled={submitting}
              className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Request Revision
            </Button>
            <Button
              onClick={() => handleValidate('approved')}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ValidationPipeline;
