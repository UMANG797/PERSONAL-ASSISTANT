import { NextResponse } from "next/server";
import { getAccessToken } from "@auth0/nextjs-auth0";

export async function GET() {
  try {
    const { accessToken } = await getAccessToken();
    return NextResponse.json({ accessToken });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch access token" }, { status: 401 });
  }
}
