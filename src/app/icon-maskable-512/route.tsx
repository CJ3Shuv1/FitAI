import { ImageResponse } from "next/og";
import { BarbellIcon } from "@/lib/appIcon";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<BarbellIcon size={512} variant="maskable" />, {
    width: 512,
    height: 512,
  });
}
