// src/components/destinations/DestinationDetail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { RootState } from "@/redux/store";
import { useDeleteDestinationMutation } from "@/redux/destinationApi";
import { IDestination } from "@/types/destination.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { } from "@/components/ui/separator";
import {
  Edit,
  Trash2,
  MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import toast from "react-hot-toast";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

interface IDestinationDetailProps {
  destination: IDestination;
}

export default function DestinationDetail({
  destination }: IDestinationDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";
  const [deleteDestination, { isLoading: isDeleting }] =
    useDeleteDestinationMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleEdit = () => {
    router.push(`/dashboard/destinations/${destination.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteDestination(destination.id).unwrap();
      toast.success("Destination deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/destinations");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete destination:", error);
      toast.error(message || "Failed to delete destination");
    }
  };

  const formatDateLong = (date: string | Date) => {
    return format(new Date(date), "EEEE, MMMM dd, yyyy 'at' h:mm a");
  };

  const truncatedName =
    destination?.name?.length > 50
      ? `${destination?.name.slice(0, 47)}...`
      : destination?.name;

  return (
    <div className="container mx-auto space-y-6">
      <Card className="overflow-hidden py-0 gap-0">
        {destination.photo && (
          <div className="relative w-full h-[240px] md:h-[340px]">
            <Image
              src={destination.photo}
              alt={`${destination.name}`}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-6">
          <div className="min-w-0 flex-1 space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight break-words [overflow-wrap:anywhere]">
              {destination.name}
            </h1>
            <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4">
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Country
                </dt>
                <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                  {destination.country}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  City
                </dt>
                <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                  {destination.city || "Not specified"}
                </dd>
              </div>
            </dl>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-none cursor-pointer"
                  disabled={isDeleting}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={handleEdit}
                  disabled={isDeleting}
                  className="cursor-pointer"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Card>

      {/* Content Section */}
      <Card className="py-0 max-sm:rounded-none max-sm:border-x-0 max-sm:bg-transparent">
        <CardContent className="p-4 sm:p-6 max-sm:px-3">
          <div className="space-y-6">
            {/* About */}
            <div className="min-w-0">
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                About
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {destination.description ||
                  "No description has been added for this destination yet. Check back later for more details."}
              </p>
            </div>

            {/* Metadata Footer */}
            <div className="pt-4 border-t">
              <div className="flex flex-col gap-3 text-xs text-muted-foreground min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:gap-4">
                <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-1.5">
                  <span className="font-medium">Created:</span>
                  <span>
                    {destination.createdAt
                      ? formatDateLong(destination.createdAt)
                      : "N/A"}
                  </span>
                </div>
                {destination.updatedAt &&
                  destination.createdAt !== destination.updatedAt && (
                    <>
                      <span className="max-[479px]:hidden">•</span>
                      <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-1.5">
                        <span className="font-medium">Last updated:</span>
                        <span>{formatDateLong(destination.updatedAt)}</span>
                      </div>
                    </>
                  )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Destination"
        description={`Are you sure you want to delete "${truncatedName}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />
    </div>
  );
}
