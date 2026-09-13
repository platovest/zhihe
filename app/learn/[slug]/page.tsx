import Lesson from '../Lesson';
import '../lesson.css';

export default async function CoursePage({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  return <Lesson slug={slug} />;
}
