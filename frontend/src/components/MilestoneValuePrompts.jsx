import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import {
  AlertTriangle,
  FileText,
  IndianRupee,
  Lock,
  CheckCircle,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * QuotationValuePrompt - Shown when BOQ/Quotation milestones are completed
 * Forces user to enter quotation value before milestone can be marked complete
 */
export function QuotationValuePrompt({
  open,
  onOpenChange,
  entityType, // 'lead' or 'project'
  entityId,
  milestoneName,
  currentQuotationValue,
  onComplete,
  onCancel
}) {
  const [quotedValue, setQuotedValue] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQuotedValue(currentQuotationValue ? String(currentQuotationValue) : '');
      setNote('');
    }
  }, [open, currentQuotationValue]);

  const handleSubmit = async () => {
    if (!quotedValue || parseFloat(quotedValue) <= 0) {
      toast.error('Please enter a valid quotation value');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Add quotation history entry
      const endpoint = entityType === 'lead' 
        ? `${API}/leads/${entityId}/quotation-history`
        : `${API}/projects/${entityId}/quotation-history`;
      
      await axios.post(endpoint, {
        quoted_value: parseFloat(quotedValue),
        status: 'Tentative',
        note: note || `Quotation entered at "${milestoneName}" milestone`
      }, { withCredentials: true });

      toast.success('Quotation value recorded');
      onComplete(parseFloat(quotedValue));
    } catch (err) {
      console.error('Failed to save quotation:', err);
      toast.error(err.response?.data?.detail || 'Failed to save quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Enter Quotation Value
          </DialogTitle>
          <DialogDescription>
            Before completing &ldquo;{milestoneName}&rdquo;, please enter the quotation value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quotation-value">Quotation Value (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="quotation-value"
                type="number"
                placeholder="Enter amount"
                value={quotedValue}
                onChange={(e) => setQuotedValue(e.target.value)}
                className="pl-9"
                data-testid="quotation-value-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quotation-note">Note (optional)</Label>
            <Textarea
              id="quotation-note"
              placeholder="Any notes about this quotation..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {currentQuotationValue > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-600" />
              <span className="text-amber-800">
                Previous quotation: ₹{currentQuotationValue.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="confirm-quotation-btn">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save & Complete Milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * ValueChangePrompt - Shown when revision milestones are completed
 * Asks if quotation value has changed
 */
export function ValueChangePrompt({
  open,
  onOpenChange,
  entityType,
  entityId,
  milestoneName,
  currentQuotationValue,
  onComplete,
  onCancel
}) {
  const [hasChanged, setHasChanged] = useState(null);
  const [newValue, setNewValue] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setHasChanged(null);
      setNewValue('');
      setNote('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (hasChanged === null) {
      toast.error('Please indicate if the quotation value has changed');
      return;
    }

    if (hasChanged === 'yes' && (!newValue || parseFloat(newValue) <= 0)) {
      toast.error('Please enter the new quotation value');
      return;
    }

    try {
      setIsSubmitting(true);

      if (hasChanged === 'yes') {
        // Add revised quotation entry
        const endpoint = entityType === 'lead'
          ? `${API}/leads/${entityId}/quotation-history`
          : `${API}/projects/${entityId}/quotation-history`;

        await axios.post(endpoint, {
          quoted_value: parseFloat(newValue),
          status: 'Revised',
          note: note || `Revised quotation at "${milestoneName}" milestone`
        }, { withCredentials: true });

        toast.success('Revised quotation value recorded');
        onComplete(parseFloat(newValue));
      } else {
        // No change - just complete the milestone
        onComplete(currentQuotationValue);
      }
    } catch (err) {
      console.error('Failed to save quotation:', err);
      toast.error(err.response?.data?.detail || 'Failed to save quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Quotation Value Check
          </DialogTitle>
          <DialogDescription>
            Before completing &ldquo;{milestoneName}&rdquo;, please confirm if the quotation value has changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Value Display */}
          <div className="p-3 bg-slate-50 border rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Current Quotation Value</p>
            <p className="text-xl font-bold text-slate-900">
              ₹{(currentQuotationValue || 0).toLocaleString('en-IN')}
            </p>
          </div>

          {/* Has Value Changed? */}
          <div className="space-y-3">
            <Label>Has the quotation value changed?</Label>
            <RadioGroup value={hasChanged} onValueChange={setHasChanged}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="no" id="no-change" />
                <Label htmlFor="no-change" className="cursor-pointer flex-1">
                  No, value remains the same
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="yes" id="yes-change" />
                <Label htmlFor="yes-change" className="cursor-pointer flex-1">
                  Yes, value has changed
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* New Value Input (shown only if changed) */}
          {hasChanged === 'yes' && (
            <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="new-value">New Quotation Value (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="new-value"
                    type="number"
                    placeholder="Enter new amount"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="pl-9 bg-white"
                    data-testid="new-quotation-value-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revision-note">Reason for change (optional)</Label>
                <Textarea
                  id="revision-note"
                  placeholder="e.g., Scope change, client request..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || hasChanged === null}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {hasChanged === 'yes' ? 'Save & Complete' : 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * BookedValueConfirmation - Shown when booking payment is confirmed
 * Shows auto-pulled value, allows edit before locking
 */
export function BookedValueConfirmation({
  open,
  onOpenChange,
  entityType,
  entityId,
  currentQuotationValue,
  inquiryValue,
  onConfirm,
  onCancel
}) {
  const [bookedValue, setBookedValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-pull from quotation or inquiry
  const suggestedValue = currentQuotationValue || inquiryValue || 0;
  const valueSource = currentQuotationValue ? 'Latest Quotation' : 'Inquiry Value';

  useEffect(() => {
    if (open) {
      setBookedValue(String(suggestedValue));
    }
  }, [open, suggestedValue]);

  const handleConfirm = async () => {
    if (!bookedValue || parseFloat(bookedValue) <= 0) {
      toast.error('Please enter a valid booked value');
      return;
    }

    try {
      setIsSubmitting(true);
      onConfirm(parseFloat(bookedValue));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            Confirm Booked Value
          </DialogTitle>
          <DialogDescription>
            This value will be locked as the "Booked Value" when booking is confirmed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 mb-1">Auto-pulled from: {valueSource}</p>
            <p className="text-xl font-bold text-blue-900">
              ₹{suggestedValue.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Editable Value */}
          <div className="space-y-2">
            <Label htmlFor="booked-value">Booked Value (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="booked-value"
                type="number"
                value={bookedValue}
                onChange={(e) => setBookedValue(e.target.value)}
                className="pl-9 text-lg font-semibold"
                data-testid="booked-value-input"
              />
            </div>
            <p className="text-xs text-slate-500">
              You can adjust this value if needed before confirming.
            </p>
          </div>

          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-600" />
            <span className="text-amber-800">
              Once confirmed, booked value cannot be changed.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} data-testid="confirm-booked-value-btn">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Lock className="w-4 h-4 mr-2" />
            Confirm & Lock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * SignOffConfirmation - Shown when KWS Sign-Off is completed
 * Shows auto-pulled value, requires explicit confirmation before locking
 */
export function SignOffConfirmation({
  open,
  onOpenChange,
  projectId,
  quotationHistory,
  bookedValue,
  inquiryValue,
  onConfirm,
  onCancel
}) {
  const [signoffValue, setSignoffValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate suggested value (approved quotation > latest quotation > booked > inquiry)
  const getSignoffValue = () => {
    if (quotationHistory && quotationHistory.length > 0) {
      const approved = quotationHistory.filter(q => q.status === 'Approved');
      if (approved.length > 0) {
        return { value: approved[approved.length - 1].quoted_value, source: 'Approved Quotation' };
      }
      return { value: quotationHistory[quotationHistory.length - 1].quoted_value, source: 'Latest Quotation' };
    }
    if (bookedValue) {
      return { value: bookedValue, source: 'Booked Value' };
    }
    return { value: inquiryValue || 0, source: 'Inquiry Value' };
  };

  const { value: suggestedValue, source: valueSource } = getSignoffValue();

  useEffect(() => {
    if (open) {
      setSignoffValue(String(suggestedValue));
    }
  }, [open, suggestedValue]);

  const handleConfirm = async () => {
    if (!signoffValue || parseFloat(signoffValue) <= 0) {
      toast.error('Please enter a valid sign-off value');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Call backend to lock signoff value
      await axios.post(`${API}/projects/${projectId}/confirm-signoff-value`, {
        signoff_value: parseFloat(signoffValue)
      }, { withCredentials: true });

      toast.success('Sign-off value confirmed and locked');
      onConfirm(parseFloat(signoffValue));
    } catch (err) {
      console.error('Failed to confirm sign-off value:', err);
      toast.error(err.response?.data?.detail || 'Failed to confirm sign-off value');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Confirm Sign-Off Value
          </DialogTitle>
          <DialogDescription>
            This is the final contract value. Once confirmed, it becomes the single source of truth for all financial calculations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Info */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-600 mb-1">Auto-pulled from: {valueSource}</p>
            <p className="text-2xl font-bold text-green-900">
              ₹{suggestedValue.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Editable Value */}
          <div className="space-y-2">
            <Label htmlFor="signoff-value">Final Sign-Off Value (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="signoff-value"
                type="number"
                value={signoffValue}
                onChange={(e) => setSignoffValue(e.target.value)}
                className="pl-9 text-lg font-semibold"
                data-testid="signoff-value-input"
              />
            </div>
            <p className="text-xs text-slate-500">
              Adjust if final negotiated value differs from quotation.
            </p>
          </div>

          {/* Quotation History Summary */}
          {quotationHistory && quotationHistory.length > 0 && (
            <div className="p-3 bg-slate-50 border rounded-lg">
              <p className="text-xs font-medium text-slate-600 mb-2">Quotation History</p>
              <div className="space-y-1">
                {quotationHistory.slice(-3).map((q, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      {new Date(q.created_at).toLocaleDateString('en-IN')}
                      <Badge variant="outline" className="ml-2 text-xs">{q.status}</Badge>
                    </span>
                    <span className="font-medium">₹{q.quoted_value?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Warning */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <Lock className="w-4 h-4 inline mr-2 text-red-600" />
            <span className="text-red-800 font-medium">
              This action is irreversible. Sign-off value cannot be changed after confirmation.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
            data-testid="confirm-signoff-value-btn"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Lock className="w-4 h-4 mr-2" />
            Confirm Sign-Off Value
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
