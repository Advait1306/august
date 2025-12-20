import { useRef, useEffect } from "react";
import { VList, VListHandle } from "virtua";
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import { Turn as TurnType } from "@jupiter/sync/zero/zero-schema.gen";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Turn } from "./turn";
import { BlinkingCursor } from "./blinking-cursor";
import { EducationCard } from "./education-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface TaskThreadProps {
  selectedTaskId: string;
}

export function TaskThread({ selectedTaskId }: TaskThreadProps) {
  const virtualizerRef = useRef<VListHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch turns for the selected task
  const [turns] = useQuery(
    selectedTaskId !== "new-conversation"
      ? queries.turns.byTask({ taskId: selectedTaskId })
      : queries.turns.byTask({ taskId: "" })
  );

  // Check if the last turn is incomplete (still generating)
  const lastTurn = turns[turns.length - 1] as TurnType | undefined;
  const isGenerating =
    lastTurn?.type === "assistant" && lastTurn?.complete === false;

  // Scroll to bottom when turns change
  useEffect(() => {
    if (virtualizerRef.current && turns.length > 0) {
      virtualizerRef.current.scrollToIndex(turns.length - 1, {
        align: "end",
      });
    }
  }, [turns.length, selectedTaskId]);

  if (selectedTaskId === "new-conversation") {
    {
      /* The -translate-y-20 is to account for optical weight of the composer */
    }
    return (
      <ConversationEmptyState className="flex flex-col justify-center items-center overflow-visible gap-8 p-0 -translate-y-20">
        <div className="w-full max-w-[800px] flex flex-row justify-between items-center gap-2">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xl font-medium text-start">Library</span>
            <span className="text-sm text-muted-foreground max-w-[60%] text-start">
              Learn how to make the best use of August to speed up your work
            </span>
          </div>
          <div className="flex flex-row gap-4 items-center">
            <div className="h-[40px] w-[40px] rounded-full bg-primary" />
          </div>
        </div>
        <div className="relative flex grow-1 max-h-[300px] w-full max-w-[800px]">
          <Carousel
            opts={{
              align: "start",
              loop: false,
            }}
            className="w-full select-none"
            plugins={[
              Autoplay({
                delay: 4000,
                stopOnInteraction: true,
                stopOnMouseEnter: true,
              }),
            ]}
          >
            <CarouselContent className="-ml-2">
              <CarouselItem className="pl-2 basis-1/3">
                <div className="h-[300px] border rounded-xl overflow-hidden">
                  <EducationCard title="Structuring meeting transcripts into tables" />
                </div>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-1/3">
                <div className="h-[300px] border rounded-xl overflow-hidden">
                  <EducationCard title="Daily report from Google Sheets and Shiprocket" />
                </div>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-1/3">
                <div className="h-[300px] border rounded-xl overflow-hidden">
                  <EducationCard title="Analysing YouTube Analytics data for better videos" />
                </div>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-1/3">
                <div className="h-[300px] border rounded-xl overflow-hidden">
                  <EducationCard title="Analysing YouTube Analytics data for better videos" />
                </div>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-1/3">
                <div className="h-[300px] border rounded-xl overflow-hidden">
                  <EducationCard title="Analysing YouTube Analytics data for better videos" />
                </div>
              </CarouselItem>
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </ConversationEmptyState>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="relative flex flex-col w-full max-w-[720px] h-[calc(100vh-204px)]"
    >
      <VList className="grow-1 no-scrollbar w-full" ref={virtualizerRef}>
        {/* Used to offset the header */}
        <div className="h-[54px] w-full" />
        {turns.map((turn) => (
          <Turn key={turn.id} turn={turn as TurnType} />
        ))}
        {isGenerating && (
          <div className="flex flex-row text-sm text-muted-foreground items-center gap-2">
            Working...
            <BlinkingCursor />
          </div>
        )}
      </VList>
    </div>
  );
}
