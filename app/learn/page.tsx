import type { Metadata } from "next";
import Catalog from "./Catalog";
import "./lesson.css";

export const metadata: Metadata = {
  title: "七课关系练习室 | 知合",
  description: "七节原创中文沟通课，含情境练习、知识检验与练习卡。本地内测，首课免费，后续课程通过模拟订单体验。",
};

export default function LearnPage() {
  return <Catalog />;
}
