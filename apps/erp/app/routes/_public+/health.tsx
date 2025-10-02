import { getCarbonServiceRole } from "@carbon/auth";

// Simple health check that doesn't depend on database
export async function loader() {
  try {
    // Basic application health check
    const startTime = Date.now();

    // Optional: Add a lightweight database check with timeout
    const client = getCarbonServiceRole();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Health check timeout")), 5000)
    );

    const healthCheck = client
      .from("attributeDataType")
      .select("id")
      .limit(1)
      .single();

    await Promise.race([healthCheck, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status: "OK",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.log("health ❌", { error });
    return new Response(
      JSON.stringify({
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
