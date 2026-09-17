interface VerifiedStampProps {
  className?: string;
}

export function VerifiedStamp({ className = "" }: VerifiedStampProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex -rotate-6 flex-col items-center justify-center border-2 border-stamp px-6 py-4 text-stamp select-none ${className}`}
    >
      <span className="absolute inset-1 border border-stamp/70" />
      <span className="font-mono text-[10px] tracking-[0.25em]">FANSHAWE COLLEGE</span>
      <span className="my-1 font-mono text-base leading-none font-bold tracking-[0.12em]">
        VERIFIED STUDENT
      </span>
      <span className="font-mono text-[10px] tracking-[0.25em]">ACCESS ONLY</span>
    </div>
  );
}
