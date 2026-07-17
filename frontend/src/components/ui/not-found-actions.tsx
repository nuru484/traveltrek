"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The 404 page's two ways out: step back through history, or start over at
 * the landing page. Client island so `router.back()` can reach the history. */
export function NotFoundActions() {
  const router = useRouter();

  return (
    <div className="flex flex-col-reverse items-stretch justify-center gap-2 min-[420px]:flex-row min-[420px]:items-center">
      <Button
        type="button"
        variant="outline"
        onClick={() => router.back()}
        className="cursor-pointer rounded-full border-foreground/25 px-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Go back
      </Button>
      <Button
        asChild
        className="rounded-full bg-foreground px-6 text-background hover:bg-foreground/90"
      >
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
