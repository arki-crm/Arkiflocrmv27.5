import React, { useState } from 'react';
import { 
  Clock, Calendar, Pause, Play, ArrowRight, AlertTriangle, 
  Loader2, ChevronRight, History
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const ADJUSTMENT_REASONS = [
  { value: 'Customer Hold', label: 'Customer Hold', icon: '⏸️' },
  { value: 'Customer Delay', label: 'Customer Delay', icon: '👤' },
  { value: 'Internal Delay', label: 'Internal Delay', icon: '🏢' },
  { value: 'Payment Delay', label: 'Payment Delay', icon: '💳' },
  { value: 'Vendor Delay', label: 'Vendor Delay', icon: '📦' },
  { value: 'Scope Change', label: 'Scope Change', icon: '📝' },
  { value: 'Other', label: 'Other', icon: '📋' }
];

const ADJUSTMENT_TYPES = [
  { 
    value: 'shift_forward', 
    label: 'Shift remaining milestones forward',
    description: 'Move all future dates by a specified number of days',
    icon: <ArrowRight className="w-4 h-4" />
  },
  { 
    value: 'new_completion_date', 
    label: 'Set new expected completion date',
    description: 'Adjust timeline to meet a new target date',
    icon: <Calendar className="w-4 h-4" />
  },
  { 
    value: 'on_hold', 
    label: 'Mark timeline as "On Hold"',
    description: 'Pause delay calculations until resumed',
    icon: <Pause className="w-4 h-4" />
  }
];

export default function TimelineAdjustmentModal({ 
  open, 
  onClose, 
  onSubmit, 
  entityType = 'lead', // 'lead' or 'project'
  entityId,
  entityName,
  currentTimeline,
  isOnHold = false,
  loading = false
}) {
  const [formData, setFormData] = useState({
    reason: '',
    remarks: '',
    effective_date: new Date().toISOString().split('T')[0],
    adjustment_type: isOnHold ? 'resume' : 'shift_forward',
    shift_days: 7,
    new_completion_date: ''
  });
  const [errors, setErrors] = useState({});

  const handleSubmit = () => {
    const newErrors = {};
    
    if (!isOnHold && !formData.reason) {
      newErrors.reason = 'Please select a reason';
    }
    
    if (!formData.remarks || formData.remarks.trim().length < 10) {
      newErrors.remarks = 'Remarks must be at least 10 characters';
    }
    
    if (formData.adjustment_type === 'shift_forward' && (!formData.shift_days || formData.shift_days < 1)) {
      newErrors.shift_days = 'Days must be at least 1';
    }
    
    if (formData.adjustment_type === 'new_completion_date' && !formData.new_completion_date) {
      newErrors.new_completion_date = 'Please select a new completion date';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      reason: '',
      remarks: '',
      effective_date: new Date().toISOString().split('T')[0],
      adjustment_type: isOnHold ? 'resume' : 'shift_forward',
      shift_days: 7,
      new_completion_date: ''
    });
    setErrors({});
    onClose();
  };

  // If on hold, show resume dialog
  if (isOnHold) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-green-600" />
              Resume Timeline
            </DialogTitle>
            <DialogDescription>
              Resume the {entityType} timeline and auto-shift future dates by the hold duration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">On Hold Since</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                {currentTimeline?.hold_since 
                  ? new Date(currentTimeline.hold_since).toLocaleDateString()
                  : 'Unknown'
                }
              </p>
            </div>

            <div>
              <Label htmlFor="resumeRemarks">Remarks *</Label>
              <Textarea
                id="resumeRemarks"
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Explain why the hold is being lifted..."
                rows={3}
                className={errors.remarks ? 'border-red-500' : ''}
              />
              {errors.remarks && <p className="text-xs text-red-500 mt-1">{errors.remarks}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Resume & Auto-Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Adjust Timeline
          </DialogTitle>
          <DialogDescription>
            Adjust the timeline for {entityType}: <strong>{entityName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
          {/* Reason Selection */}
          <div>
            <Label>Reason for Adjustment *</Label>
            <Select 
              value={formData.reason} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, reason: v }))}
            >
              <SelectTrigger className={errors.reason ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map(reason => (
                  <SelectItem key={reason.value} value={reason.value}>
                    <span className="flex items-center gap-2">
                      <span>{reason.icon}</span>
                      {reason.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason}</p>}
          </div>

          {/* Effective Date */}
          <div>
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={formData.effective_date}
              onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
            />
            <p className="text-xs text-slate-500 mt-1">When did this adjustment become necessary?</p>
          </div>

          {/* Adjustment Type */}
          <div>
            <Label>Adjustment Type *</Label>
            <RadioGroup 
              value={formData.adjustment_type}
              onValueChange={(v) => setFormData(prev => ({ ...prev, adjustment_type: v }))}
              className="mt-2 space-y-2"
            >
              {ADJUSTMENT_TYPES.map(type => (
                <label
                  key={type.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.adjustment_type === type.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <RadioGroupItem value={type.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {type.icon}
                      {type.label}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Conditional Fields Based on Type */}
          {formData.adjustment_type === 'shift_forward' && (
            <div className="pl-6 border-l-2 border-blue-200">
              <Label htmlFor="shiftDays">Number of Days to Shift *</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="shiftDays"
                  type="number"
                  min="1"
                  value={formData.shift_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, shift_days: parseInt(e.target.value) || 0 }))}
                  className={`w-24 ${errors.shift_days ? 'border-red-500' : ''}`}
                />
                <span className="text-slate-600">days</span>
              </div>
              {errors.shift_days && <p className="text-xs text-red-500 mt-1">{errors.shift_days}</p>}
            </div>
          )}

          {formData.adjustment_type === 'new_completion_date' && (
            <div className="pl-6 border-l-2 border-blue-200">
              <Label htmlFor="newCompletionDate">New Expected Completion Date *</Label>
              <Input
                id="newCompletionDate"
                type="date"
                value={formData.new_completion_date}
                onChange={(e) => setFormData(prev => ({ ...prev, new_completion_date: e.target.value }))}
                className={errors.new_completion_date ? 'border-red-500' : ''}
              />
              {errors.new_completion_date && <p className="text-xs text-red-500 mt-1">{errors.new_completion_date}</p>}
              {currentTimeline?.expected_completion && (
                <p className="text-xs text-slate-500 mt-1">
                  Current expected: {new Date(currentTimeline.expected_completion).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {formData.adjustment_type === 'on_hold' && (
            <div className="pl-6 border-l-2 border-amber-200">
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Marking as "On Hold" will:
                </p>
                <ul className="text-xs text-amber-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Pause all delay calculations</li>
                  <li>Show "ON HOLD" badge instead of delay days</li>
                  <li>Auto-shift dates when resumed</li>
                </ul>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks *</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Provide detailed explanation for this timeline adjustment..."
              rows={3}
              className={errors.remarks ? 'border-red-500' : ''}
            />
            {errors.remarks && <p className="text-xs text-red-500 mt-1">{errors.remarks}</p>}
            <p className="text-xs text-slate-500 mt-1">
              {formData.remarks.length}/10 characters minimum
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-2" />
            )}
            Apply Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Timeline History Component
export function TimelineHistoryModal({ open, onClose, history = [], entityType = 'lead' }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            Timeline Adjustment History
          </DialogTitle>
          <DialogDescription>
            View all timeline adjustments for this {entityType}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[50vh] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No timeline adjustments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((adj, index) => (
                <div key={adj.id || index} className="p-4 border rounded-lg bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        {adj.adjustment_type === 'on_hold' && '⏸️ On Hold'}
                        {adj.adjustment_type === 'resume' && '▶️ Resumed'}
                        {adj.adjustment_type === 'shift_forward' && `⏩ Shifted +${adj.shift_days} days`}
                        {adj.adjustment_type === 'new_completion_date' && '📅 New Completion Date'}
                      </Badge>
                      <h4 className="font-medium text-slate-900">{adj.reason}</h4>
                      <p className="text-sm text-slate-600 mt-1">{adj.remarks}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(adj.date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">By:</span>{' '}
                      <span className="font-medium">{adj.user_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Effective:</span>{' '}
                      <span className="font-medium">{adj.effective_date}</span>
                    </div>
                    {adj.previous_completion && (
                      <div>
                        <span className="text-slate-500">Previous:</span>{' '}
                        <span className="font-medium">{adj.previous_completion}</span>
                      </div>
                    )}
                    {adj.new_completion && (
                      <div>
                        <span className="text-slate-500">New:</span>{' '}
                        <span className="font-medium text-blue-600">{adj.new_completion}</span>
                      </div>
                    )}
                  </div>
                  
                  {adj.affected_stages?.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Affected {entityType === 'project' ? 'milestones' : 'stages'}: {adj.affected_stages.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
