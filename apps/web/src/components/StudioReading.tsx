import type { ReactNode } from "react";
import { StudioPageHeader } from "./StudioPageHeader";

export function StudioReading({ section, title, description, chapters }: {
  section: string; title: ReactNode; description: string;
  chapters: { id: string; title: string; content: ReactNode }[];
}) {
  return <main className="studio-page studio-reading-page">
    <StudioPageHeader section={section} title={title} description={description}/>
    <div className="reading-layout"><aside className="reading-index"><p className="studio-overline">ON THIS PAGE</p><nav aria-label={section + " sections"}>{chapters.map((chapter,index)=><a key={chapter.id} href={"#"+chapter.id}><span>{String(index+1).padStart(2,"0")}</span>{chapter.title}</a>)}</nav></aside><div className="reading-chapters">{chapters.map((chapter,index)=><section className="reading-chapter" id={chapter.id} key={chapter.id}><header><span>{String(index+1).padStart(2,"0")}</span><h2>{chapter.title}</h2></header><div className="reading-chapter-content">{chapter.content}</div></section>)}</div></div>
  </main>;
}
