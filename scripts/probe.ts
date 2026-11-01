import "../lib/load-env";
import { probeVk } from "../lib/vk-probe";
try {
  const report = await probeVk();
  if (!report.configured) {
    console.error("Задайте VK_ACCESS_TOKEN в защищённом окружении");
    process.exitCode = 1;
  } else {
    if (report.profile) console.log(`Владелец токена: ${report.profile.url}`);
    for (const check of report.checks) {
      console.log(
        `${check.method}: ${check.message}${check.posts !== undefined ? ` Публикаций: ${check.posts}; аудиовложений: ${check.audio}.` : ""}`,
      );
      if (check.status === "denied" || check.status === "failed")
        process.exitCode = 1;
    }
    console.log(report.coverage);
  }
} catch {
  console.error("Не удалось проверить подключение. Проверьте настройки VK.");
  process.exitCode = 1;
}
