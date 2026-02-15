export default function ReflectLoading() {
  return (
    <main className="group flex min-h-dvh items-stretch p-[clamp(16px,4vw,48px)]">
      <div className="flex flex-1 min-h-0 w-full rounded-2xl border-2 border-black/20 bg-black/5 px-[clamp(24px,10vw,384px)] py-[clamp(24px,6vw,64px)]">
        <div className="w-full">
          <div className="h-7 w-40 rounded bg-black/15" />
          <div className="mt-6 h-[52vh] w-full rounded-2xl bg-black/10" />
        </div>
      </div>
    </main>
  );
}
