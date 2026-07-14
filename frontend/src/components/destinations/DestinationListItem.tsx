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
import { Badge } from "@/components/ui/badge";
import { MapPin, Eye, Edit, Trash2, Calendar } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import toast from "react-hot-toast";
import { truncateText } from "@/utils/truncateText";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

interface IDestinationListItemProps {
  destination: IDestination;
}

export default function DestinationListItem({
  destination,
}: IDestinationListItemProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";
  const [deleteDestination, { isLoading: isDeleting }] =
    useDeleteDestinationMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleView = () => {
    router.push(`/dashboard/destinations/${destination.id}/detail`);
  };

  const handleEdit = () => {
    router.push(`/dashboard/destinations/${destination.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteDestination(destination.id).unwrap();
      toast.success("Destination deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete destination:", error);
      toast.error(message || "Failed to delete destination");
    }
  };

  const formatDate = (dateInput: string | Date) => {
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return format(date, "MMM dd, yyyy");
  };

  return (
    <>
      <Card className="w-full transition-all duration-300 group overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row h-full">
            {/* Destination Image */}
            <div className="relative w-full md:w-1/4 h-40 md:h-auto flex-shrink-0">
              {destination.photo ? (
                <Image
                  src={destination.photo}
                  alt={destination.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 25vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0" />
            </div>

            {/* Destination Information */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                    {truncateText(destination.name)}{" "}
                    <span className="text-muted-foreground">
                      - {destination.country}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {destination.city || "N/A"}
                  </p>
                </div>
                <div className="flex-shrink-0 ml-4 text-right">
                  <Badge variant="secondary" className="text-xs">
                    Destination
                  </Badge>
                </div>
              </div>

              {/* Details Row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{destination.country}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {destination.createdAt
                      ? formatDate(destination.createdAt)
                      : "N/A"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleView}
                  className="flex-1 sm:flex-none sm:min-w-[80px] group-hover:border-primary/50 transition-colors cursor-pointer"
                  disabled={isDeleting}
                >
                  <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">View</span>
                  <span className="sm:hidden">Details</span>
                </Button>

                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Edit className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Edit</span>
                      <span className="sm:hidden">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive hover:border-destructive/50 flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Delete</span>
                      <span className="sm:hidden">Del</span>
                    </Button>
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
        description={`Are you sure you want to delete "${truncateText(
          destination.name
        )}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}
