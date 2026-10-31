import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ЭРА | VK Music Radar",
  description:
    "Музыкальная аналитика публичных публикаций ВКонтакте. Прозрачная статистика наблюдаемой выборки.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
