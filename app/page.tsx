import HomeIntroTransition from "./home-intro-transition";
import AppPanel from "./components/app-panel";
import IntroGreetingBlock from "./components/intro_greeting_block";

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
          "relative flex flex-1 min-h-0 w-full items-center overflow-hidden",
          "border-2 border-black/50",
          "px-[clamp(24px,10vw,384px)] py-[clamp(24px,6vw,64px)]",
          "[--ch26-intro-overlay-delay:150ms]",
          "[--ch26-intro-overlay-duration:2200ms]",
          // Timing vars for the intro greeting sequence (used for coordinated transitions).
          "[--ch26-greeting-start:calc(var(--ch26-intro-overlay-delay)+var(--ch26-intro-overlay-duration)+150ms)]",
          "[--ch26-greeting-duration:2800ms]",
          "[--ch26-greeting-end:calc(var(--ch26-greeting-start)+var(--ch26-greeting-duration))]",
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
	        <IntroGreetingBlock greeting="Good evening, Raghav." />
	      </AppPanel>
	    </main>
	  );
}
