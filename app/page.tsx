import HomeIntroTransition from "./home-intro-transition";
import AppPanel from "./components/app-panel";

export default function Home() {
  return (
    <main
      id="ch26-home"
      className="group flex min-h-dvh items-stretch p-[clamp(16px,4vw,48px)]"
      data-ch26-stage="intro"
      data-name="Desktop - 1"
      data-node-id="28:3"
    >
      <HomeIntroTransition />

      <AppPanel
        className={[
          "relative flex-1 min-h-0 w-full overflow-hidden",
          "border-2 border-black/50",
          "px-[clamp(24px,10vw,384px)] py-[clamp(24px,6vw,64px)]",
          "[--ch26-intro-overlay-delay:150ms]",
          "[--ch26-intro-overlay-duration:2200ms]",
          "before:pointer-events-none before:absolute before:inset-0 before:content-['']",
          "before:rounded-2xl",
          // Intro (Figma node 36:3651): dark panel gradient, then fade to the app's main panel.
          "before:bg-[linear-gradient(to_bottom,var(--ch26-panel-from),var(--ch26-panel-to-intro))]",
          "before:opacity-100",
          "before:transition-opacity",
          "before:ease-linear",
          "before:[transition-delay:var(--ch26-intro-overlay-delay)]",
          "before:[transition-duration:var(--ch26-intro-overlay-duration)]",
          "group-data-[ch26-stage=final]:before:opacity-0",
          "motion-reduce:before:delay-0 motion-reduce:before:duration-[1ms]",
        ].join(" ")}
        data-node-id="29:6"
      >
        <div
          className="relative z-10 flex h-full flex-col items-center justify-center"
          data-node-id="29:9"
        >
          <p
            className={[
              "m-0 text-2xl font-semibold leading-none text-white/90",
              "opacity-0",
              "transition",
              "will-change-[opacity]",
              "group-data-[ch26-stage=final]:animate-[ch26-greeting-flicker_2800ms_cubic-bezier(0.16,1,0.3,1)_both]",
              // Start the flicker only after the intro overlay has fully faded.
              "group-data-[ch26-stage=final]:[animation-delay:calc(var(--ch26-intro-overlay-delay)+var(--ch26-intro-overlay-duration)+150ms)]",
              // Safety: if the animation is dropped for any reason, still reveal the greeting after the same delay.
              "group-data-[ch26-stage=final]:opacity-100",
              "group-data-[ch26-stage=final]:[transition-delay:calc(var(--ch26-intro-overlay-delay)+var(--ch26-intro-overlay-duration)+150ms)]",
              "group-data-[ch26-stage=final]:[transition-duration:120ms]",
              "motion-reduce:will-change-auto",
              "motion-reduce:animate-none",
              "motion-reduce:opacity-100",
            ].join(" ")}
            data-node-id="29:8"
          >
            Good evening, Raghav.
          </p>
        </div>
      </AppPanel>
    </main>
  );
}
