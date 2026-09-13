import type { Metadata } from "next";
import Lesson from "./Lesson";
import "./lesson.css";

export const metadata: Metadata = {
  title: "把需要说清楚 · 免费体验课 | 知合",
  description: "约 6 分钟，学习从事实、感受与请求开始一次关系对话。含情境练习、知识检验与可下载练习卡。",
};

export default function LearnPage() {
  return <Lesson />;
}
