import { isAdmin, sameOrigin } from "@/lib/auth";
import { importCsv } from "@/lib/importer";
import { ImportError, parseImport, importPreview } from "@/lib/import-csv";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin()))
    return Response.json(
      { error: "Требуется вход администратора" },
      { status: 403 },
    );
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: "Пустой запрос" }, { status: 400 });
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 3 * 1024 * 1024) {
        await reader.cancel();
        return Response.json(
          { error: "Запрос слишком большой. CSV — до 2 МБ." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    let body;
    try {
      body = JSON.parse(buffer.toString("utf8"));
    } catch {
      return Response.json({ error: "Некорректный JSON" }, { status: 400 });
    }
    if (
      !body ||
      typeof body.csv !== "string" ||
      typeof body.source !== "string"
    )
      return Response.json(
        { error: "Укажите CSV и название источника" },
        { status: 400 },
      );
    const source = body.source.trim();
    if (
      source.length < 3 ||
      source.length > 100 ||
      /[\u0000-\u001f]/.test(source)
    )
      throw new ImportError("Название источника: от 3 до 100 символов.");
    if (body.preview === true)
      return Response.json(
        { preview: importPreview(parseImport(body.csv)) },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (body.confirmed !== true)
      return Response.json(
        {
          error:
            "Подтвердите, что загружаете реальные публикации из разрешённого источника.",
        },
        { status: 400 },
      );
    return Response.json(await importCsv(body.csv, source), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ImportError
            ? e.message
            : "Не удалось подтвердить импорт. Проверьте подключение к базе; повторная загрузка не создаст дубли.",
      },
      { status: e instanceof ImportError ? 400 : 503 },
    );
  } finally {
    reader.releaseLock();
  }
}
