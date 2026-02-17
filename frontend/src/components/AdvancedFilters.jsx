import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Badge } from './ui/badge';
import { 
  Filter, 
  X, 
  Calendar,
  ArrowUpDown,
  Users,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

// Time filter options
const TIME_FILTERS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom Range' }
];

// Sort options
const SORT_OPTIONS = {
  leads: [
    { value: 'updated_at:desc', label: 'Last Updated (Newest)' },
    { value: 'updated_at:asc', label: 'Last Updated (Oldest)' },
    { value: 'created_at:desc', label: 'Created Date (Newest)' },
    { value: 'created_at:asc', label: 'Created Date (Oldest)' },
    { value: 'budget:desc', label: 'Budget (High → Low)' },
    { value: 'budget:asc', label: 'Budget (Low → High)' }
  ],
  projects: [
    { value: 'updated_at:desc', label: 'Last Updated (Newest)' },
    { value: 'updated_at:asc', label: 'Last Updated (Oldest)' },
    { value: 'created_at:desc', label: 'Created Date (Newest)' },
    { value: 'created_at:asc', label: 'Created Date (Oldest)' },
    { value: 'project_value:desc', label: 'Project Value (High → Low)' },
    { value: 'project_value:asc', label: 'Project Value (Low → High)' }
  ],
  presales: [
    { value: 'created_at:desc', label: 'Created Date (Newest)' },
    { value: 'created_at:asc', label: 'Created Date (Oldest)' },
    { value: 'updated_at:desc', label: 'Last Updated (Newest)' },
    { value: 'updated_at:asc', label: 'Last Updated (Oldest)' },
    { value: 'budget:desc', label: 'Budget (High → Low)' },
    { value: 'budget:asc', label: 'Budget (Low → High)' }
  ]
};

// Hold status options for projects
const HOLD_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Active', label: 'Active' },
  { value: 'Hold', label: 'On Hold' },
  { value: 'Deactivated', label: 'Deactivated' }
];

/**
 * AdvancedFilters Component
 * Reusable filter panel for Leads, Projects, and PreSales pages
 * 
 * @param {Object} filters - Current filter state
 * @param {Function} onFiltersChange - Callback when filters change
 * @param {Array} designers - List of designers for dropdown
 * @param {Array} users - List of users for collaborator filter
 * @param {string} type - 'leads' | 'projects' | 'presales'
 * @param {boolean} showDesignerFilter - Whether to show designer filter
 * @param {boolean} showHoldStatus - Whether to show hold status filter (projects only)
 * @param {boolean} showCollaboratorFilter - Whether to show collaborator filter
 */
export const AdvancedFilters = ({
  filters,
  onFiltersChange,
  designers = [],
  users = [],
  type = 'leads',
  showDesignerFilter = false,
  showHoldStatus = false,
  showCollaboratorFilter = false,
  className
}) => {
  const sortOptions = SORT_OPTIONS[type] || SORT_OPTIONS.leads;
  
  // Count active filters
  const activeFilterCount = [
    filters.timeFilter && filters.timeFilter !== 'all',
    filters.designerId && filters.designerId !== 'all',
    filters.holdStatus && filters.holdStatus !== 'all',
    filters.collaboratorId && filters.collaboratorId !== 'all',
    filters.startDate && filters.endDate,
    filters.sortBy && filters.sortBy !== 'updated_at:desc'
  ].filter(Boolean).length;

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    
    // Reset custom dates if time filter changes to non-custom
    if (key === 'timeFilter' && value !== 'custom') {
      newFilters.startDate = '';
      newFilters.endDate = '';
    }
    
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      timeFilter: 'all',
      startDate: '',
      endDate: '',
      designerId: 'all',
      holdStatus: 'all',
      collaboratorId: 'all',
      sortBy: 'updated_at:desc'
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Time Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "h-8 gap-1.5",
              (filters.timeFilter && filters.timeFilter !== 'all') && "border-blue-500 bg-blue-50"
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {filters.timeFilter === 'custom' && filters.startDate 
              ? `${filters.startDate} → ${filters.endDate || '...'}` 
              : TIME_FILTERS.find(t => t.value === filters.timeFilter)?.label || 'All Time'}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-3">
            <Label className="text-xs font-medium text-slate-500">Time Period</Label>
            <Select 
              value={filters.timeFilter || 'all'} 
              onValueChange={(v) => updateFilter('timeFilter', v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {filters.timeFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <Label className="text-xs text-slate-500">From Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => updateFilter('startDate', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">To Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => updateFilter('endDate', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Designer Filter */}
      {showDesignerFilter && designers.length > 0 && (
        <Select 
          value={filters.designerId || 'all'} 
          onValueChange={(v) => updateFilter('designerId', v)}
        >
          <SelectTrigger 
            className={cn(
              "h-8 w-[180px]",
              (filters.designerId && filters.designerId !== 'all') && "border-blue-500 bg-blue-50"
            )}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="All Designers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Designers</SelectItem>
            {designers.map(d => (
              <SelectItem key={d.user_id} value={d.user_id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Collaborator / Team Member Filter */}
      {showCollaboratorFilter && users.length > 0 && (
        <Select 
          value={filters.collaboratorId || 'all'} 
          onValueChange={(v) => updateFilter('collaboratorId', v)}
        >
          <SelectTrigger 
            className={cn(
              "h-8 w-[180px]",
              (filters.collaboratorId && filters.collaboratorId !== 'all') && "border-blue-500 bg-blue-50"
            )}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Team Member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {users.map(u => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.name} ({u.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Hold Status Filter (Projects only) */}
      {showHoldStatus && (
        <Select 
          value={filters.holdStatus || 'all'} 
          onValueChange={(v) => updateFilter('holdStatus', v)}
        >
          <SelectTrigger 
            className={cn(
              "h-8 w-[130px]",
              (filters.holdStatus && filters.holdStatus !== 'all') && "border-blue-500 bg-blue-50"
            )}
          >
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {HOLD_STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Sort By */}
      <Select 
        value={filters.sortBy || 'updated_at:desc'} 
        onValueChange={(v) => updateFilter('sortBy', v)}
      >
        <SelectTrigger 
          className={cn(
            "h-8 w-[180px]",
            (filters.sortBy && filters.sortBy !== 'updated_at:desc') && "border-blue-500 bg-blue-50"
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active Filter Count & Clear */}
      {activeFilterCount > 0 && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={clearAllFilters}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
};

// Utility function to get localStorage key for filters
export const getFilterStorageKey = (type) => `arkiflo_${type}_filters`;

// Utility function to save filters to localStorage
export const saveFiltersToStorage = (type, filters) => {
  try {
    localStorage.setItem(getFilterStorageKey(type), JSON.stringify(filters));
  } catch (e) {
    console.warn('Failed to save filters to localStorage:', e);
  }
};

// Utility function to load filters from localStorage
export const loadFiltersFromStorage = (type) => {
  try {
    const stored = localStorage.getItem(getFilterStorageKey(type));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load filters from localStorage:', e);
  }
  return {
    timeFilter: 'all',
    startDate: '',
    endDate: '',
    designerId: 'all',
    holdStatus: 'all',
    collaboratorId: 'all',
    sortBy: 'updated_at:desc'
  };
};

export default AdvancedFilters;
