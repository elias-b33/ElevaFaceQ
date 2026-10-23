import { useId } from "react";

/** Original vector studies: no stock portraits or external image requests. */
export function AnatomyPlate({ view = "front", className = "" }: { view?: "front" | "side"; className?: string }) {
  const id = useId().replaceAll(":", "");
  return <svg viewBox="0 0 300 390" className={`anatomy-plate ${className}`} role="img" aria-label={view === "front" ? "Anatomical line study of a front-facing face" : "Anatomical line study of a side profile"}>
    <defs><pattern id={`hatch-${id}`} width="5" height="5" patternTransform="rotate(-28)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth=".5" opacity=".2"/></pattern></defs>
    <g fill="none" stroke="currentColor" strokeWidth=".55" opacity=".35"><path d="M28 99h244M28 165h244M28 228h244M28 289h244M150 25v311" strokeDasharray="3 5"/><path d="M25 37v-9h20m210 0h20v9M25 318v9h20m210 0h20v-9"/></g>
    {view === "front" ? <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M90 276c4 33-6 49-38 66m158-66c-4 33 6 49 38 66M83 172c-11-18-22-7-17 15 3 17 10 27 18 22m132-37c11-18 22-7 17 15-3 17-10 27-18 22" strokeWidth="1.1"/>
      <path d="M150 54c-52-1-76 35-72 89l5 70c2 28 12 49 27 62 16 13 26 22 40 24 14-2 24-11 40-24 15-13 25-34 27-62l5-70c4-54-20-90-72-89Z" fill={`url(#hatch-${id})`} strokeWidth="1.1"/>
      <path d="M80 138c5-35 18-42 28-54 14 6 20 8 42 4 22 4 28 2 42-4 10 12 23 19 28 54M89 145c12-11 25-10 43-3m36 0c18-7 31-8 43 3M91 166c13-13 29-12 42 0-13 9-29 10-42 0Zm76 0c13-12 29-13 42 0-13 10-29 9-42 0Z" strokeWidth="1.25"/>
      <path d="M104 164a10 10 0 0 0 19 0m54 0a10 10 0 0 0 19 0M137 159c-2 18-3 32-10 46-2 7 5 10 11 9m25-55c2 18 3 32 10 46 2 7-5 10-11 9m-24 0c5 5 19 5 24 0M144 220l-2 10m14-10 2 10M125 240l17-5 8 2 8-2 17 5-25 3-25-3Zm0 0c10 12 40 12 50 0m-35 24c7 3 13 3 20 0" strokeWidth=".95"/>
      <path d="M91 185l14 15m104-15-14 15M88 219l26 27m98-27-26 27M99 107l10 17m92-17-10 17M101 289l26 30m72-30-26 30" strokeWidth=".6" opacity=".5"/>
      <g fill="currentColor" stroke="none">{[[150,88],[94,166],[132,166],[168,166],[206,166],[150,214],[125,240],[175,240],[150,299],[84,213],[216,213]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.7"/>)}</g>
    </g> : <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M83 308c10-34 6-48-1-69-15-31-23-69-15-108 8-47 44-73 84-71 30 1 51 16 58 42l-2 29-5 18 9 20 23 28c3 5 1 10-7 10l-14 2-4 13 8 8c3 4-3 8-10 9l7 7c2 4-3 8-9 10l-2 20c0 14-14 18-31 18l-15 35" fill={`url(#hatch-${id})`} strokeWidth="1.2"/>
      <path d="M84 125c20-30 49-37 75-30 18 4 30 10 47 10M199 153l-29 5 25 10m-25-10c5 11 13 12 21 8M197 153c-8-11-19-12-29-7M181 202l24 5m-16-6 4-5m9 29 8 4-22 3m0 0 19 7m-24 34 19 1M134 180c-6-20-25-16-26 6-1 22 5 39 16 36 9-3 16-20 10-29-3-6-10-7-14-2m2 7 7 6-4 9M118 224l1 27 47 35m-48-35-9-9m57 44-13 18M96 312l-31 31m101-38 48 38" strokeWidth="1"/>
      <path d="M78 163l18-17m-21 30 18-17m-16 32 18-17m-10 36 15-13m31-70 17-16m-7 22 17-16m-16 150 11 13m-21-9 9 11" strokeWidth=".6" opacity=".5"/>
      <path d="M123 194l60-13" strokeWidth=".75" strokeDasharray="4 4" opacity=".7"/>
      <g fill="currentColor" stroke="none">{[[202,149],[234,199],[211,211],[210,229],[207,242],[202,274],[168,286],[123,194],[183,181]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.7"/>)}</g>
    </g>}
  </svg>;
}
