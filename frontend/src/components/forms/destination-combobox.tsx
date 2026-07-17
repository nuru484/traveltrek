// src/components/forms/destination-combobox.tsx
//
// The searchable destination picker shared by the tour and hotel forms. Owns
// its own search box, open state, and the destinations query; writes the
// chosen destination id back through the bound react-hook-form field.
"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Control, FieldValues, Path } from "react-hook-form";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import { cn } from "@/lib/utils";

export function DestinationCombobox<T extends FieldValues>({
  control,
  name,
  /** The entity's current destination name, shown until the list loads. */
  fallbackName,
}: {
  control: Control<T>;
  name: Path<T>;
  fallbackName?: string;
}) {
  const [destinationSearch, setDestinationSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: destinationsData, isLoading: isLoadingDestinations } =
    useGetAllDestinationsQuery({
      limit: 10,
      search: destinationSearch,
    });

  const destinations = destinationsData?.data || [];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedId = field.value as number | undefined;
        return (
          <FormItem className="flex flex-col">
            <FormLabel>Destination</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                      "h-10 w-full min-w-0 justify-between text-left font-normal",
                      !selectedId && "text-muted-foreground"
                    )}
                  >
                    <span className="min-w-0 flex-1 line-clamp-1 whitespace-normal [overflow-wrap:anywhere]">
                      {selectedId
                        ? destinations.find(
                            (destination) => destination.id === selectedId
                          )?.name ||
                          fallbackName ||
                          "Select destination"
                        : "Select destination"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search destination..."
                    value={destinationSearch}
                    onValueChange={setDestinationSearch}
                  />
                  <CommandEmpty>
                    {isLoadingDestinations
                      ? "Loading destinations..."
                      : "No destination found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {destinations.map((destination) => (
                      <CommandItem
                        key={destination.id}
                        value={destination.name}
                        onSelect={() => {
                          field.onChange(destination.id);
                          setOpen(false);
                          setDestinationSearch("");
                        }}
                        className="items-start"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0 mt-0.5",
                            destination.id === selectedId
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                          {destination.name}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
