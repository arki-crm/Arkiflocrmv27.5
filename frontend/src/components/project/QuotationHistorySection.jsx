import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Plus, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STYLES = {
  'Tentative': 'bg-slate-100 text-slate-700',
  'Revised': 'bg-amber-100 text-amber-700',
  'Approved': 'bg-green-100 text-green-700',
  'Superseded': 'bg-red-100 text-red-700 line-through'
};

const QuotationHistorySection = ({ 
  entityType, // 'lead' or 'project'
  entityId, 
  quotationHistory = [], 
  canAddEntry = false,
  onHistoryUpdated 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [newEntry, setNewEntry] = useState({
    quoted_value: '',
    status: 'Tentative',
    note: ''
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '-';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  const handleAddEntry = async () => {
    const value = parseFloat(newEntry.quoted_value);
    if (isNaN(value) || value <= 0) {
      toast.error('Please enter a valid quotation value');
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = entityType === 'lead' 
        ? `${API}/leads/${entityId}/quotation-history`
        : `${API}/projects/${entityId}/quotation-history`;
      
      await axios.post(endpoint, {
        quoted_value: value,
        status: newEntry.status,
        note: newEntry.note || null
      }, { withCredentials: true });

      toast.success('Quotation entry added');
      setShowAddModal(false);
      setNewEntry({ quoted_value: '', status: 'Tentative', note: '' });
      if (onHistoryUpdated) onHistoryUpdated();
    } catch (err) {
      console.error('Failed to add quotation entry:', err);
      toast.error(err.response?.data?.detail || 'Failed to add entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedHistory = [...quotationHistory].sort((a, b) => b.version - a.version);

  return (
    <Card className="border-slate-200" data-testid="quotation-history-section">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Quotation History
          </CardTitle>
          {canAddEntry && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddModal(true)}
              className="h-8 text-xs"
              data-testid="add-quotation-btn"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Quote
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {sortedHistory.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm">No quotation history yet</p>
            {canAddEntry && (
              <Button
                variant="link"
                className="text-blue-600 text-sm mt-1"
                onClick={() => setShowAddModal(true)}
              >
                Add first quotation
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-xs">Ver</TableHead>
                  <TableHead className="text-xs">Quotation Value</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Prepared By</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((entry, idx) => (
                  <React.Fragment key={entry.version || idx}>
                    <TableRow 
                      className="hover:bg-slate-50"
                      data-testid={`quotation-row-${entry.version}`}
                    >
                      <TableCell className="font-mono text-xs text-slate-600">
                        v{entry.version}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {formatCurrency(entry.quoted_value)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {entry.created_by_name || 'System'}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[entry.status] || 'bg-slate-100 text-slate-700'
                        )}>
                          {entry.status || 'Tentative'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {entry.note && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setExpandedRow(expandedRow === entry.version ? null : entry.version)}
                          >
                            {expandedRow === entry.version ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRow === entry.version && entry.note && (
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={6} className="py-2">
                          <div className="text-xs text-slate-600 pl-2 border-l-2 border-blue-300">
                            <span className="font-medium">Notes:</span> {entry.note}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Quotation Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Add Quotation Entry
            </DialogTitle>
            <DialogDescription>
              Record a new quotation value. This is append-only for audit purposes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="quoted-value">Quotation Value *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <Input
                  id="quoted-value"
                  type="number"
                  value={newEntry.quoted_value}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, quoted_value: e.target.value }))}
                  placeholder="0"
                  className="pl-8"
                  data-testid="quotation-value-input"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={newEntry.status}
                onValueChange={(value) => setNewEntry(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="status" data-testid="quotation-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tentative">Tentative</SelectItem>
                  <SelectItem value="Revised">Revised</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
              {newEntry.status === 'Approved' && (
                <p className="text-xs text-amber-600 mt-1">
                  * Marking as Approved will supersede all previous quotations
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="note">Notes / Reason for Change</Label>
              <Textarea
                id="note"
                value={newEntry.note}
                onChange={(e) => setNewEntry(prev => ({ ...prev, note: e.target.value }))}
                placeholder="e.g., Updated after client feedback on kitchen design"
                rows={2}
                data-testid="quotation-note-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddEntry} 
              disabled={isSubmitting || !newEntry.quoted_value}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="submit-quotation-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                'Add Entry'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default QuotationHistorySection;
