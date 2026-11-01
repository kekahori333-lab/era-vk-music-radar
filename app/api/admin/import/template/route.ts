import { isAdmin } from "@/lib/auth";
import { CSV_HEADERS } from "@/lib/import-csv";
export async function GET() {
  if (!(await isAdmin()))
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  return new Response("\uFEFF" + CSV_HEADERS + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="era-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
