import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  dailyStats: defineTable({
    username: v.string(),
    date: v.string(), // "YYYY-MM-DD"
    commits: v.array(
      v.object({
        sha: v.string(),
        repo: v.string(),
        repoUrl: v.string(),
        message: v.string(),
        date: v.string(),
        commitUrl: v.string(),
        additions: v.number(),
        deletions: v.number(),
      })
    ),
  }).index("by_username_date", ["username", "date"]),
});
