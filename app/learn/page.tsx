import type { Metadata } from "next";
import Catalog from "./Catalog";
import "./lesson.css";

export const metadata: Metadata = {
  title: "七课关系练习室 | 知合",
  description: "七节原创中文沟通课，含情境练习、知识检验与练习卡。第1课完整免费，第2–7课付费，目前暂未开放购买。",
};

export default function LearnPage() {
  return <Catalog />;
}
