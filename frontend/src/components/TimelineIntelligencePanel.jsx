import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  Edit3,
  Share2,
  History,
  ChevronRight,
  Eye,
  EyeOff,
  Calculator,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TimelineIntelligencePanel = ({ projectId, canManage = false, isManager = false }) => {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState(null);
  const [options, setOptions] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [genForm, setGenForm] = useState({
    scope_type: '3bhk',
    project_tier: 'standard',
    priority_tag: 'normal'
  });
  
  const [overrideForm, setOverrideForm] = useState({
    milestones: [],
    override_reason: '',
    notes: ''
  });
  
  const [historyData, setHistoryData] = useState(null);

  useEffect(() => {
    fetchTimeline();
    fetchOptions();
  }, [projectId]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/projects/${projectId}/timeline`, {
        withCredentials: true
      });
      setTimeline(res.data);
      
      // Pre-populate override form with current milestones
      if (res.data.active_milestones) {
        setOverrideForm(prev => ({
          ...prev,
          milestones: res.data.active_milestones.map(m => ({
            ...m,
            planned_date: m.planned_date
          }))
        }));
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await axios.get(`${API}/timeline-config/options`, {
        withCredentials: true
      });
      setOptions(res.data);
    } catch (err) {
      console.error('Failed to fetch timeline options:', err);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await axios.post(`${API}/projects/${projectId}/timeline/generate`, genForm, {
        withCredentials: true
      });
      toast.success('Timeline generated successfully');
      setShowGenerateModal(false);
      fetchTimeline();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate timeline');
    } finally {
      setGenerating(false);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideForm.override_reason.trim()) {
      toast.error('Please provide a reason for the override');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/projects/${projectId}/timeline/override`, overrideForm, {
        withCredentials: true
      });
      toast.success('Override request submitted for approval');
      setShowOverrideModal(false);
      fetchTimeline();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit override');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (approved, notes = '') => {
    try {
      setSubmitting(true);
      await axios.put(`${API}/projects/${projectId}/timeline/review`, {
        approved,
        review_notes: notes
      }, { withCredentials: true });
      toast.success(approved ? 'Timeline approved' : 'Timeline rejected');
      fetchTimeline();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to review timeline');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    try {
      setSubmitting(true);
      await axios.post(`${API}/projects/${projectId}/timeline/share`, {}, {
        withCredentials: true
      });
      toast.success('Timeline shared with customer');
      fetchTimeline();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to share timeline');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/projects/${projectId}/timeline/history`, {
        withCredentials: true
      });
      setHistoryData(res.data);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error('Failed to fetch history');
    }
  };

  const updateMilestoneDate = (index, newDate) => {
    setOverrideForm(prev => ({
      ...prev,
      milestones: prev.milestones.map((m, i) => 
        i === index ? { ...m, planned_date: newDate } : m
      )
    }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_approval':
        return <Badge className="bg-amber-100 text-amber-700">Pending Approval</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      case 'superseded':
        return <Badge className="bg-slate-100 text-slate-700">Superseded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No timeline exists
  if (!timeline?.exists) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No timeline generated for this project</p>
            {canManage && (
              <Button onClick={() => setShowGenerateModal(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Timeline
              </Button>
            )}
          </div>

          {/* Generate Timeline Modal */}
          <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Project Timeline</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    Project Scope
                  </label>
                  <Select value={genForm.scope_type} onValueChange={v => setGenForm(p => ({ ...p, scope_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.scope_types?.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} (×{s.complexity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    Project Tier
                  </label>
                  <Select value={genForm.project_tier} onValueChange={v => setGenForm(p => ({ ...p, project_tier: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.project_tiers?.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label} (revision ×{t.revision_buffer})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    Priority
                  </label>
                  <Select value={genForm.priority_tag} onValueChange={v => setGenForm(p => ({ ...p, priority_tag: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.priority_tags?.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label} {p.compression < 1 && `(${Math.round((1 - p.compression) * 100)}% faster)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate Timeline
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  const timelineData = timeline.timeline;
  const activeMilestones = timeline.active_milestones || [];
  const pendingVersion = timeline.pending_approval;
  const calcInputs = timelineData?.versions?.[0]?.calculation_inputs || {};

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Project Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            {timeline.is_shared_with_customer && (
              <Badge className="bg-emerald-100 text-emerald-700">
                <Share2 className="w-3 h-3 mr-1" />
                Shared
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={fetchHistory}>
              <History className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Classification badges */}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {options?.scope_types?.find(s => s.value === timelineData?.scope_type)?.label || timelineData?.scope_type}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {options?.project_tiers?.find(t => t.value === timelineData?.project_tier)?.label || timelineData?.project_tier}
          </Badge>
          {timelineData?.priority_tag !== 'normal' && (
            <Badge className="bg-purple-100 text-purple-700 text-xs">
              {options?.priority_tags?.find(p => p.value === timelineData?.priority_tag)?.label || timelineData?.priority_tag}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pending Approval Alert */}
        {pendingVersion && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Version {pendingVersion.version} ({pendingVersion.type === 'manual_override' ? 'Override' : 'System'}) pending approval
                </span>
              </div>
              {isManager && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleApprove(false, 'Rejected by manager')}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => handleApprove(true)}>
                    Approve
                  </Button>
                </div>
              )}
            </div>
            {pendingVersion.calculation_inputs?.override_reason && (
              <p className="text-xs text-amber-600 mt-2">
                Reason: {pendingVersion.calculation_inputs.override_reason}
              </p>
            )}
          </div>
        )}

        {/* Milestones Timeline */}
        <div className="space-y-2">
          {(pendingVersion?.milestones || activeMilestones).map((milestone, index) => (
            <div
              key={milestone.milestone_key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                milestone.status === 'completed' 
                  ? "bg-emerald-50 border-emerald-200"
                  : milestone.is_customer_facing
                    ? "bg-white border-slate-200 hover:border-purple-200"
                    : "bg-slate-50 border-slate-200"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                milestone.status === 'completed'
                  ? "bg-emerald-500 text-white"
                  : milestone.is_customer_facing
                    ? "bg-purple-100 text-purple-700"
                    : "bg-slate-200 text-slate-600"
              )}>
                {milestone.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium",
                    milestone.is_customer_facing ? "text-slate-800" : "text-slate-600"
                  )}>
                    {milestone.milestone_name}
                  </span>
                  {!milestone.is_customer_facing && (
                    <Badge variant="outline" className="text-xs">
                      <EyeOff className="w-3 h-3 mr-1" />
                      Internal
                    </Badge>
                  )}
                  {milestone.requires_meeting && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      Meeting
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <span className={cn(
                  "text-sm font-medium",
                  milestone.status === 'completed' ? "text-emerald-700" : "text-slate-700"
                )}>
                  {formatDate(milestone.planned_date)}
                </span>
                {milestone.adjusted_days && (
                  <p className="text-xs text-slate-500">
                    {milestone.adjusted_days} days
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Calculation Info Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-slate-500"
          onClick={() => setShowCalculationModal(true)}
        >
          <Calculator className="w-4 h-4 mr-2" />
          View Calculation Factors
        </Button>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          {canManage && !pendingVersion && (
            <Button variant="outline" size="sm" onClick={() => setShowOverrideModal(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Request Override
            </Button>
          )}
          
          {isManager && timeline.active_milestones && !timeline.is_shared_with_customer && (
            <Button size="sm" onClick={handleShare} disabled={submitting}>
              <Share2 className="w-4 h-4 mr-2" />
              Share with Customer
            </Button>
          )}
        </div>

        {/* Override Modal */}
        <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Timeline Override</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Override Reason *
                </label>
                <Textarea
                  value={overrideForm.override_reason}
                  onChange={e => setOverrideForm(p => ({ ...p, override_reason: e.target.value }))}
                  placeholder="Why do you need to change the timeline?"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Adjusted Dates
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {overrideForm.milestones.map((m, idx) => (
                    <div key={m.milestone_key} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                      <span className="flex-1 text-sm">{m.milestone_name}</span>
                      <Input
                        type="date"
                        value={m.planned_date}
                        onChange={e => updateMilestoneDate(idx, e.target.value)}
                        className="w-40"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Additional Notes
                </label>
                <Textarea
                  value={overrideForm.notes}
                  onChange={e => setOverrideForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional context..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleOverrideSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit for Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Calculation Modal */}
        <Dialog open={showCalculationModal} onOpenChange={setShowCalculationModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Timeline Calculation Factors</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Scope:</div>
                <div className="font-medium">{calcInputs.scope_label} (×{calcInputs.complexity_factor})</div>
                
                <div className="text-slate-500">Tier:</div>
                <div className="font-medium">{calcInputs.tier_label} (revision ×{calcInputs.revision_buffer})</div>
                
                <div className="text-slate-500">Priority:</div>
                <div className="font-medium">{calcInputs.priority_label} (compress ×{calcInputs.timeline_compression})</div>
                
                <div className="text-slate-500">Designer:</div>
                <div className="font-medium">{calcInputs.designer_name}</div>
                
                <div className="text-slate-500">Skill Level:</div>
                <div className="font-medium">{calcInputs.skill_label} (×{calcInputs.skill_multiplier})</div>
                
                <div className="text-slate-500">Active Projects:</div>
                <div className="font-medium">{calcInputs.designer_active_projects} ({calcInputs.workload_level} load)</div>
                
                <div className="text-slate-500">Workload Factor:</div>
                <div className="font-medium">×{calcInputs.workload_multiplier}</div>
                
                <div className="text-slate-500">Manager Review Buffer:</div>
                <div className="font-medium">{calcInputs.manager_review_buffer_days} days</div>
                
                <div className="text-slate-500">Client Buffer:</div>
                <div className="font-medium">{calcInputs.client_coordination_buffer} days</div>
              </div>
              
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Combined Design Multiplier:</span>
                  <span className="text-lg font-bold text-purple-600">×{calcInputs.design_multiplier}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCalculationModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Modal */}
        <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Timeline History</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Versions */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Versions</h4>
                <div className="space-y-2">
                  {historyData?.timeline?.versions?.map(v => (
                    <div key={v.version} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{v.version}</span>
                        <Badge variant="outline" className="text-xs">
                          {v.type === 'system_generated' ? 'System' : 'Override'}
                        </Badge>
                        {getStatusBadge(v.status)}
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDate(v.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Approval History */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Approval History</h4>
                <div className="space-y-2">
                  {historyData?.approval_history?.map(h => (
                    <div key={h.approval_id} className="p-2 bg-slate-50 rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{h.action.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-500">{formatDate(h.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-500">by {h.actor_name}</p>
                      {h.notes && <p className="text-xs text-slate-600 mt-1">{h.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TimelineIntelligencePanel;
