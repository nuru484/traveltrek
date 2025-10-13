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
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Edit,
  Trash2,
  MoreHorizontal,
  Calendar,
  Globe,
  FileText,
  ImageOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import toast from "react-hot-toast";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

interface IDestinationDetailProps {
  destination: IDestination;
}

export default function DestinationDetail({
  destination,
}: IDestinationDetailProps) {
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

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "MMM dd, yyyy");
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
      <Card className="overflow-hidden border-0 shadow-md">
        {destination.photo ? (
          <div className="relative w-full h-[300px] md:h-[400px]">
            <Image
              src={destination.photo}
              alt={`${destination.name}`}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

            {isAdmin && (
              <div className="absolute top-4 right-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="bg-white/95 hover:bg-white text-black shadow-lg cursor-pointer h-9 w-9"
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
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                    {destination.name}
                  </h1>
                  <div className="flex items-center gap-2 text-white/90">
                    <MapPin className="h-4 w-4" />
                    <span className="text-base md:text-lg">
                      {destination.city ? `${destination.city}, ` : ""}
                      {destination.country}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Fallback for no image
          <div className="relative w-full h-[200px] bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageOff className="h-16 w-16 text-muted-foreground/30" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-background/80 to-transparent">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                    {destination.name}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-base md:text-lg">
                      {destination.city ? `${destination.city}, ` : ""}
                      {destination.country}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="cursor-pointer h-9 w-9"
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
            </div>
          </div>
        )}
      </Card>

      {/* Content Section */}
      <Card className="shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="space-y-6">
            {/* Description Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">About</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {destination.description ||
                  "No description has been added for this destination yet. Check back later for more details."}
              </p>
            </div>

            <Separator />

            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Country
                  </p>
                  <p className="text-base font-semibold text-foreground truncate">
                    {destination.country}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    City
                  </p>
                  <p className="text-base font-semibold text-foreground truncate">
                    {destination.city || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Added
                  </p>
                  <p className="text-base font-semibold text-foreground truncate">
                    {destination.createdAt
                      ? formatDate(destination.createdAt)
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Footer */}
            <div className="pt-4 border-t">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
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
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
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
