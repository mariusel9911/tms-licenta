import { useState } from 'react';
import { countries } from 'country-data-list';
import { CircleFlag } from 'react-circle-flags';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CountryDropdownProps {
  value?: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const countryList = countries.all.filter((c) => c.alpha2 && c.status === 'assigned' && c.name);

export function CountryDropdown({
  value,
  onChange,
  placeholder = 'Select country',
  disabled = false,
}: CountryDropdownProps) {
  const [open, setOpen] = useState(false);

  const selected = countryList.find(
    (c) => c.name.toLowerCase() === (value ?? '').toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={(next) => { if (!disabled) setOpen(next); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <CircleFlag countryCode={selected.alpha2.toLowerCase()} height={20} width={20} />
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countryList.map((country) => (
                <CommandItem
                  key={country.alpha2}
                  value={country.name}
                  onSelect={() => {
                    onChange(country.name);
                    setOpen(false);
                  }}
                >
                  <CircleFlag
                    countryCode={country.alpha2.toLowerCase()}
                    height={20}
                    width={20}
                    className="mr-2 shrink-0"
                  />
                  {country.name}
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      (value ?? '').toLowerCase() === country.name.toLowerCase()
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
