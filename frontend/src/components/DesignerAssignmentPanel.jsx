import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  User,
  UserPlus,
  UserMinus,
  Clock,
  CheckCircle,
  XCircle,
  History,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ASSIGNMENT_REASONS = [
  { value: 'initial', label: 'Initial Assignment' },
  { value: 'reassigned', label: 'Reassigned' },
  { value: 'resigned', label: 'Designer Resigned' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'workload_balance', label: 'Workload Balance' }
];

const END_REASONS = [
  { value: 'reassigned', label: 'Reassigned to Another Designer' },
  { value: 'resigned', label: 'Designer Resigned' },
  { value: 'escalation', label: 'Escalated' },
  { value: 'project_complete', label: 'Project Completed' }
];

export default function DesignerAssignmentPanel({ projectId, currentPrimaryDesigner, onUpdate }) {
  const [assignments, setAssignments] = useState([]);
  const [currentPrimary, setCurrentPrimary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [designers, setDesigners] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    designer_id: '',
    role: 'Primary',
    assignment_reason: 'reassigned',
    notes: ''
  });
  const [assigning, setAssigning] = useState(false);
  
  // End assignment modal state
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingAssignment, setEndingAssignment] = useState(null);
  const [endData, setEndData] = useState({
    end_reason: 'reassigned',
    notes: ''
  });
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchAssignments();
      fetchDesigners();
    }
  }, [projectId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/projects/${projectId}/designer-assignments`, {
        withCredentials: true
      });
      setAssignments(response.data.assignments || []);
      setCurrentPrimary(response.data.current_primary);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      toast.error('Failed to load designer assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDesigners = async () => {
    try {
      const response = await axios.get(`${API}/users`, { withCredentials: true });
      const designerRoles = ['Designer', 'SeniorDesigner', 'DesignManager'];
      const designerUsers = response.data.filter(u => designerRoles.includes(u.role));
      setDesigners(designerUsers);
    } catch (err) {
      console.error('Failed to fetch designers:', err);
    }
  };

  const handleAssign = async () => {
    if (!assignData.designer_id) {
      toast.error('Please select a designer');
      return;
    }
    
    try {
      setAssigning(true);
      await axios.post(
        `${API}/projects/${projectId}/designer-assignments`,
        assignData,
        { withCredentials: true }
      );
      toast.success('Designer assigned successfully');
      setShowAssignModal(false);
      setAssignData({ designer_id: '', role: 'Primary', assignment_reason: 'reassigned', notes: '' });
      fetchAssignments();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to assign designer:', err);
      toast.error(err.response?.data?.detail || 'Failed to assign designer');
    } finally {
      setAssigning(false);
    }
  };

  const handleEndAssignment = async () => {
    if (!endingAssignment) return;
    
    try {
      setEnding(true);
      await axios.put(
        `${API}/projects/${projectId}/designer-assignments/${endingAssignment.assignment_id}/end`,
        endData,
        { withCredentials: true }
      );
      toast.success('Assignment ended');
      setShowEndModal(false);
      setEndingAssignment(null);
      setEndData({ end_reason: 'reassigned', notes: '' });
      fetchAssignments();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to end assignment:', err);
      toast.error(err.response?.data?.detail || 'Failed to end assignment');
    } finally {
      setEnding(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const activeAssignments = assignments.filter(a => a.is_active);
  const pastAssignments = assignments.filter(a => !a.is_active);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="designer-assignment-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Designer Assignments
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowAssignModal(true)}
              className="gap-1"
              data-testid="assign-designer-btn"
            >
              <UserPlus className="w-4 h-4" />
              Assign Designer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Primary Designer */}
          {currentPrimary ? (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">{currentPrimary.designer_name}</p>
                    <div className="flex items-center gap-2 text-xs text-purple-600">
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        Primary Designer
                      </Badge>
                      <span>Since {formatDate(currentPrimary.assigned_from)}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setEndingAssignment(currentPrimary);
                    setShowEndModal(true);
                  }}
                  data-testid="end-primary-btn"
                >
                  <UserMinus className="w-4 h-4 mr-1" />
                  End
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">No Primary Designer Assigned</p>
                <p className="text-xs text-amber-600">Please assign a Primary designer for accountability tracking</p>
              </div>
            </div>
          )}

          {/* Support Designers */}
          {activeAssignments.filter(a => a.role === 'Support').length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Support Designers</p>
              {activeAssignments.filter(a => a.role === 'Support').map(assignment => (
                <div
                  key={assignment.assignment_id}
                  className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{assignment.designer_name}</p>
                      <p className="text-xs text-slate-500">Since {formatDate(assignment.assigned_from)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-red-600"
                    onClick={() => {
                      setEndingAssignment(assignment);
                      setShowEndModal(true);
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Assignment History Toggle */}
          {pastAssignments.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-slate-600"
                onClick={() => setShowHistory(!showHistory)}
                data-testid="toggle-history-btn"
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Assignment History ({pastAssignments.length})
                </span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              
              {showHistory && (
                <div className="mt-2 space-y-2 border-t pt-3">
                  {pastAssignments.map(assignment => (
                    <div
                      key={assignment.assignment_id}
                      className="p-3 bg-slate-50 border rounded-lg opacity-75"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">{assignment.designer_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {assignment.role}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
                          {assignment.end_reason || 'ended'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex items-center gap-4">
                        <span>{formatDate(assignment.assigned_from)}</span>
                        <span>→</span>
                        <span>{formatDate(assignment.assigned_to)}</span>
                      </div>
                      {assignment.notes && (
                        <p className="mt-1 text-xs text-slate-500 italic">{assignment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attribution Info */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            <p className="font-medium mb-1">Attribution Rules:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>Sign-Off KPIs → Primary designer at sign-off time</li>
              <li>Cancelled projects → Primary designer at cancellation</li>
              <li>Active projects → Current Primary designer</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Assign Designer Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Designer</DialogTitle>
            <DialogDescription>
              Assign a designer to this project. If assigning as Primary, the current Primary will be ended.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Designer</Label>
              <Select
                value={assignData.designer_id}
                onValueChange={(v) => setAssignData(prev => ({ ...prev, designer_id: v }))}
              >
                <SelectTrigger data-testid="select-designer">
                  <SelectValue placeholder="Select a designer" />
                </SelectTrigger>
                <SelectContent>
                  {designers.map(d => (
                    <SelectItem key={d.user_id} value={d.user_id}>
                      {d.name} ({d.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={assignData.role}
                onValueChange={(v) => setAssignData(prev => ({ ...prev, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primary">Primary (owns KPIs)</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select
                value={assignData.assignment_reason}
                onValueChange={(v) => setAssignData(prev => ({ ...prev, assignment_reason: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes about this assignment..."
                value={assignData.notes}
                onChange={(e) => setAssignData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
            
            {assignData.role === 'Primary' && currentPrimary && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                This will end the current Primary assignment ({currentPrimary.designer_name})
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning} data-testid="confirm-assign-btn">
              {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Assign Designer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Assignment Modal */}
      <Dialog open={showEndModal} onOpenChange={setShowEndModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Assignment</DialogTitle>
            <DialogDescription>
              End this designer's assignment. The assignment history will be preserved.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {endingAssignment && (
              <div className="p-3 bg-slate-50 border rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">{endingAssignment.designer_name}</span>
                  <Badge variant="outline" className="ml-2">{endingAssignment.role}</Badge>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Assigned since {formatDate(endingAssignment.assigned_from)}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Reason for ending</Label>
              <Select
                value={endData.end_reason}
                onValueChange={(v) => setEndData(prev => ({ ...prev, end_reason: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {END_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={endData.notes}
                onChange={(e) => setEndData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
            
            {endingAssignment?.role === 'Primary' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Warning: This project will have no Primary designer. Please assign a new one.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEndAssignment} 
              disabled={ending}
              data-testid="confirm-end-btn"
            >
              {ending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              End Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
