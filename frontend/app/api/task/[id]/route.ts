import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"

const TASKS_DIR = join(process.cwd(), "..", "backend", "tasks")

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = join(TASKS_DIR, `${params.id}.json`)
    const raw = readFileSync(filePath, "utf-8")
    const task = JSON.parse(raw)
    return NextResponse.json(task)
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
