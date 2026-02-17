import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

/**
 * SearchableSelect Component
 * A dropdown with built-in search functionality
 * 
 * @param {Array} options - Array of { value, label, sublabel? } objects
 * @param {string} value - Currently selected value
 * @param {Function} onValueChange - Callback when value changes
 * @param {string} placeholder - Placeholder text when nothing selected
 * @param {string} searchPlaceholder - Placeholder for search input
 * @param {string} emptyText - Text shown when no results found
 * @param {string} className - Additional classes for the trigger button
 * @param {React.ReactNode} icon - Optional icon to show before placeholder
 * @param {boolean} disabled - Whether the select is disabled
 */
export const SearchableSelect = ({
  options = [],
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  className,
  icon,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Find the selected option's label
  const selectedLabel = useMemo(() => {
    const selected = options.find(opt => opt.value === value);
    return selected?.label || placeholder;
  }, [options, value, placeholder]);

  // Filter options based on search query (case-insensitive)
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(opt => {
      const labelMatch = opt.label?.toLowerCase().includes(query);
      const sublabelMatch = opt.sublabel?.toLowerCase().includes(query);
      const valueMatch = opt.value?.toLowerCase().includes(query);
      return labelMatch || sublabelMatch || valueMatch;
    });
  }, [options, searchQuery]);

  const handleSelect = (selectedValue) => {
    onValueChange(selectedValue === value ? '' : selectedValue);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            value && value !== 'all' && "border-blue-500 bg-blue-50",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {icon}
            <span className="truncate">{selectedLabel}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;
