export const EducationCard = ({ title }: { title: string }) => {
  return (
    <div className="relative h-full w-full flex flex-col justify-end items-start">
      <div className="absolute bottom-0 left-0 w-full h-[30%] bg-gradient-to-b from-transparent to-background -z-10 pointer-events-none backdrop-blur-md" />
      <img
        src="/education/education-1-light.png"
        alt={title}
        className="absolute w-full h-full object-cover -z-20"
      />
      <img
        src="/education/education-1-dark.png"
        alt={title}
        className="absolute w-full h-full object-cover -z-20 dark:block hidden"
      />
      <div className="p-4 z-20">
        <h1 className="text-start text-xl font-medium tracking-tight text-muted-foreground">
          {title}
        </h1>
      </div>
    </div>
  );
};
