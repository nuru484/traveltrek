// src/components/flights/destination-combobox.tsx
//
// Searchable destination picker shared by the flight form's Origin and
// Destination fields. Rendered inside a react-hook-form <FormField>, so
// FormItem/FormControl/FormMessage bind to the surrounding field context.
"use client";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { IDestination } from "@/types/destination.types";

interface IDestinationComboboxProps {
  label: string;
  /** Selected destination id (0 = none). */
  value: number;
  /** Text shown on the closed trigger (placeholder when nothing selected). */
  displayText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  options: IDestination[];
  isLoading: boolean;
  loadingText: string;
  emptyText: string;
  /** Origin items show the name only; destination items add city, country. */
  showLocationLine?: boolean;
  onSelect: (id: number) => void;
}

export function DestinationCombobox({
  label,
  value,
  displayText,
  open,
  onOpenChange,
  search,
  onSearchChange,
  searchPlaceholder,
  options,
  isLoading,
  loadingText,
  emptyText,
  showLocationLine = false,
  onSelect }: IDestinationComboboxProps) {
  return (
    <FormItem className="flex flex-col">
      <FormLabel>{label}</FormLabel>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "h-10 w-full min-w-0 justify-between text-left font-normal",
                !value && "text-muted-foreground"
              )}
            >
              <span className="min-w-0 flex-1 line-clamp-1 whitespace-normal [overflow-wrap:anywhere]">
                {displayText}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={onSearchChange}
            />
            <CommandEmpty>{isLoading ? loadingText : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => onSelect(option.id)}
                  className="items-start"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 mt-0.5",
                      option.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {showLocationLine ? (
                    <div className="flex flex-col overflow-hidden w-full">
                      <span className="break-words">{option.name}</span>
                      <span className="text-xs text-muted-foreground break-words">
                        {option.city && `${option.city}, `}
                        {option.country}
                      </span>
                    </div>
                  ) : (
                    <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                      {option.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}
