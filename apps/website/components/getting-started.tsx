import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePreloadImages } from "@/hooks/usePreloadImages";

const steps = [
  {
    title: "Install Claude Code",
    description:
      "August uses your local instance of claude code for it's agents.",
  },
  {
    title: "Create an agent",
    description: "Design a custom agent to automate your workflows.",
  },
  {
    title: "Add your projects",
    description:
      "Connect your project folders, so agents know exactly where to work.",
  },
  {
    title: "Start with your tasks",
    description:
      "Kick off your first task and let your agent take care of the execution.",
  },
];

export default function GettingStarted() {
  const [activeStep, setActiveStep] = useState(0);
  const imageDivRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [hidden, setHidden] = useState(true);

  // Preload all step images
  const imageUrls = steps.flatMap((_, index) => [
    `/steps_light/${index}.png`,
    `/steps_dark/${index}.png`,
  ]);
  usePreloadImages(imageUrls);

  useEffect(() => {
    if (imageDivRef.current) {
      setHeight(imageDivRef.current.clientHeight);
    }
  }, [imageDivRef, imageDivRef.current?.clientHeight]);

  return (
    <>
      {/* Mobile: Unrolled step-by-step */}
      <div className="flex flex-col gap-6 md:hidden">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="bg-secondary border rounded-xl p-4 flex flex-col gap-2">
              <span className="text-muted-foreground">{index + 1}</span>
              <div>
                <span className="font-semibold text-lg">{step.title}</span>
                <div>
                  <span className="text-sm text-muted-foreground">
                    {step.description}
                  </span>
                </div>
              </div>
            </div>
            <div className="overflow-hidden">
              <Image
                src={`/steps_light/${index}.png`}
                priority={index === 0}
                width={800}
                height={400}
                alt={step.title}
                className="shadow border rounded-xl dark:hidden"
                onLoad={() => setHidden(false)}
              />
              <Image
                src={`/steps_dark/${index}.png`}
                priority={index === 0}
                width={800}
                height={400}
                alt={step.title}
                className="shadow border rounded-xl hidden dark:block"
                onLoad={() => setHidden(false)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Interactive side-by-side */}
      <div
        className="hidden md:flex flex-row w-full border rounded-xl"
        style={{
          opacity: hidden ? 0 : 1,
        }}
      >
        <div
          className="flex-3 flex flex-col p-[6px] pr-0 gap-2 overflow-scroll"
          style={{ height: height }}
        >
          {steps.map((step, index) => (
            <div
              className="flex-1 bg-secondary border rounded p-2 flex flex-col gap-2 justify-between"
              key={index}
              style={{
                opacity: index === activeStep ? 1 : 0.3,
              }}
              onClick={() => {
                setActiveStep(index);
              }}
            >
              <span className="text-muted-foreground">{index + 1}</span>
              <div>
                <span className="font-semibold">{step.title}</span>
                <div className="w-[80%]">
                  <span className="text-sm text-muted-foreground ">
                    {step.description}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex-7 overflow-hidden p-2 h-full" ref={imageDivRef}>
          <Image
            src={`/steps_light/${activeStep}.png`}
            priority
            width={1600}
            height={800}
            alt={steps[activeStep].title}
            className="shadow border rounded dark:hidden"
            onLoad={() => setHidden(false)}
          />
          <Image
            src={`/steps_dark/${activeStep}.png`}
            priority
            width={1600}
            height={800}
            alt={steps[activeStep].title}
            className="shadow border rounded hidden dark:block"
            onLoad={() => setHidden(false)}
          />
        </div>
      </div>
    </>
  );
}
