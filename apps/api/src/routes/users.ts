// apps/api/src/routes/users.ts

import { Router } from "express";
import { supabase, TABLES } from "../supabase/client.js";

const router = Router();

console.log("[Users] ✅ Route file loaded!");

// GET /api/users/active
router.get("/active", async (_req, res) => {
  try {
    console.log("[Users] 📋 Fetching all staff/petugas...");

    const { data: users, error } = await supabase
      .from(TABLES.USERS)
      .select("id, name, email, role, created_at")
      .in("role", ["staff", "petugas"])
      .order("name", { ascending: true });

    if (error) {
      console.error("[Users] ❌ Fetch error:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log("[Users] ✅ Users found:", users?.length || 0);

    const { data: scans } = await supabase
      .from(TABLES.OPNAME)
      .select("user_id");

    const scanCount = new Map<string, number>();

    scans?.forEach((item) => {
      if (item.user_id) {
        scanCount.set(
          item.user_id,
          (scanCount.get(item.user_id) || 0) + 1
        );
      }
    });

    const formattedData =
      users?.map((user) => ({
        ...user,
        scans: scanCount.get(user.id) || 0,
        isActive: (scanCount.get(user.id) || 0) > 0,
      })) || [];

    formattedData.sort((a, b) => b.scans - a.scans);

    console.log("[Users] ✅ Total users:", formattedData.length);

    return res.json({
      success: true,
      data: formattedData,
    });
  } catch (error: unknown) {
    console.error("[Users] ❌ Active error:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/users
router.get("/", async (_req, res) => {
  try {
    const { data: users, error } = await supabase
      .from(TABLES.USERS)
      .select("id, name, email, role, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("[Users] ❌ Get all error:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      data: users || [],
    });
  } catch (error: unknown) {
    console.error("[Users] ❌ Get all error:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
