import { SITE } from "@config";
import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content_layer",
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image()
        .refine(img => img.width >= 1200 && img.height >= 630, {
          message: "OpenGraph image must be at least 1200 X 630 pixels!",
        })
        .or(z.string())
        .optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      editPost: z
        .object({
          disabled: z.boolean().optional(),
          url: z.string().optional(),
          text: z.string().optional(),
          appendFilePath: z.boolean().optional(),
        })
        .optional(),
    }),
});

const facebookArchive = defineCollection({
  type: "content_layer",
  loader: glob({ pattern: "**/*.md", base: "./content/facebook-archive" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.date(),
    historicalDate: z.string().optional(),
    historicalDatePrecision: z
      .enum(["day", "month", "year", "decade", "unknown"])
      .default("unknown"),
    source: z.literal("facebook"),
    sourceTimestamp: z.number().int(),
    sourcePostIndex: z.number().int().optional(),
    facebookPostId: z.string().optional(),
    facebookPermalink: z.string().url().optional(),
    facebookTitle: z.string().optional(),
    facebookActivityType: z
      .enum(["status", "shared-link", "shared-post", "video"])
      .optional(),
    sharedUrl: z.string().url().optional(),
    sharedAttachmentUnavailable: z.boolean().optional(),
    album: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(true),
    reviewStatus: z.enum(["pending", "reviewed"]).default("pending"),
    mediaReviewStatus: z.enum(["pending", "reviewed"]).default("pending"),
    commentImportStatus: z
      .enum(["pending", "partial", "complete", "unavailable"])
      .default("pending"),
    media: z.array(
      z.object({
        src: z.string(),
        sourceId: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        alt: z.string(),
        caption: z.string().optional(),
      })
    ),
    video: z
      .object({
        src: z.string().url(),
        sourceId: z.string(),
        mimeType: z.literal("video/mp4"),
        bytes: z.number().int().positive(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        durationSeconds: z.number().positive(),
        hasAudio: z.boolean(),
      })
      .optional(),
  }),
});

export const collections = { blog, facebookArchive };
