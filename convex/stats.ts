import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const commitObject = v.object({
  sha: v.string(),
  repo: v.string(),
  repoUrl: v.string(),
  message: v.string(),
  date: v.string(),
  commitUrl: v.string(),
  additions: v.number(),
  deletions: v.number(),
});

export const getByDate = query({
  args: { username: v.string(), date: v.string() },
  handler: async (ctx, { username, date }) => {
    return ctx.db
      .query("dailyStats")
      .withIndex("by_username_date", (q) =>
        q.eq("username", username).eq("date", date)
      )
      .unique();
  },
});

export const setDay = mutation({
  args: {
    username: v.string(),
    date: v.string(),
    commits: v.array(commitObject),
  },
  handler: async (ctx, { username, date, commits }) => {
    const existing = await ctx.db
      .query("dailyStats")
      .withIndex("by_username_date", (q) =>
        q.eq("username", username).eq("date", date)
      )
      .unique();
    if (existing) {
      await ctx.db.replace(existing._id, { username, date, commits });
    } else {
      await ctx.db.insert("dailyStats", { username, date, commits });
    }
  },
});
