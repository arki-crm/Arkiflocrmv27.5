import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Reusable Vendor Select component with quick-create capability
 * 
 * Props:
 * - value: string (vendor_id) - Currently selected vendor ID
 * - onChange: function(vendor_id, vendor_name) - Called when selection changes
 * - placeholder: string - Placeholder text
 * - disabled: boolean - Disable the selector
 * - label: string - Optional label text
 * - required: boolean - Show required indicator
 * - className: string - Additional CSS classes
 */
const VendorSelect = ({ 
  value, 
  onChange, 
  placeholder = "Select vendor...",
  disabled = false,
  label,
  required = false,
  className = ""
}) => {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const inputRef = useRef(null);

  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/accounting/vendors`, {
        withCredentials: true
      });
      setVendors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async () => {
    if (!newVendorName.trim()) {
      toast.error('Please enter a vendor name');
      return;
    }

    try {
      setCreating(true);
      const response = await axios.post(`${API}/api/accounting/vendors/quick-create`, {
        vendor_name: newVendorName.trim()
      }, { withCredentials: true });

      const newVendor = response.data;
      
      // Add to list if not already there
      setVendors(prev => {
        const exists = prev.some(v => v.vendor_id === newVendor.vendor_id);
        if (exists) return prev;
        return [...prev, newVendor];
      });

      // Select the new vendor
      onChange(newVendor.vendor_id, newVendor.vendor_name);
      
      toast.success(`Vendor "${newVendor.vendor_name}" created`);
      setNewVendorName('');
      setShowQuickCreate(false);
      setOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create vendor');
    } finally {
      setCreating(false);
    }
  };

  const selectedVendor = vendors.find(v => v.vendor_id === value);

  // Filter vendors based on search
  const filteredVendors = vendors.filter(v => 
    v.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if search term exactly matches an existing vendor
  const exactMatch = vendors.some(v => 
    v.vendor_name?.toLowerCase() === searchTerm.toLowerCase()
  );

  return (
    <div className={className}>
      {label && (
        <Label className="mb-1.5 block">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
            data-testid="vendor-select-trigger"
          >
            {selectedVendor ? selectedVendor.vendor_name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {showQuickCreate ? (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Add New Vendor</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowQuickCreate(false)}
                >
                  Cancel
                </Button>
              </div>
              <Input
                ref={inputRef}
                placeholder="Enter vendor name"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickCreate();
                  }
                }}
                data-testid="vendor-quick-create-input"
              />
              <Button 
                onClick={handleQuickCreate} 
                disabled={creating || !newVendorName.trim()}
                className="w-full"
                data-testid="vendor-quick-create-submit"
              >
                {creating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Create Vendor</>
                )}
              </Button>
            </div>
          ) : (
            <Command>
              <CommandInput 
                placeholder="Search vendors..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Loading vendors...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      <div className="p-2 text-center">
                        <p className="text-sm text-gray-500 mb-2">No vendor found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewVendorName(searchTerm);
                            setShowQuickCreate(true);
                            setTimeout(() => inputRef.current?.focus(), 100);
                          }}
                          data-testid="vendor-create-new-btn"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create "{searchTerm}"
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredVendors.map((vendor) => (
                        <CommandItem
                          key={vendor.vendor_id}
                          value={vendor.vendor_name}
                          onSelect={() => {
                            onChange(vendor.vendor_id, vendor.vendor_name);
                            setOpen(false);
                            setSearchTerm('');
                          }}
                          data-testid={`vendor-option-${vendor.vendor_id}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === vendor.vendor_id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {vendor.vendor_name}
                          {vendor.vendor_type && (
                            <span className="ml-2 text-xs text-gray-400">
                              ({vendor.vendor_type})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {/* Always show "+ Add new vendor" option at bottom */}
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setNewVendorName(searchTerm);
                          setShowQuickCreate(true);
                          setTimeout(() => inputRef.current?.focus(), 100);
                        }}
                        data-testid="vendor-add-new-btn"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add new vendor
                      </Button>
                    </div>
                  </>
                )}
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default VendorSelect;
