import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { createApp } from "../app.js";

describe("API", () => {
  it("GET /health -> 200 ok when DB answers", async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const app = createApp({ pool });

    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.text).toBe("ok");
  });

  it("POST /notes without title -> 400", async () => {
    const pool = { query: vi.fn() };
    const app = createApp({ pool });

    const response = await request(app).post("/notes").send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("title is required");
  });
});