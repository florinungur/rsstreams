import { describe, expect, it } from "vitest";
import { detectPage } from "./page-detector";

function u(href: string): URL {
    return new URL(href, "https://www.youtube.com");
}

describe("detectPage", () => {
    describe("handle", () => {
        it("recognises /@handle", () => {
            expect(detectPage(u("/@MKBHD"))).toEqual({ kind: "handle", handle: "MKBHD" });
        });

        it("recognises /@handle with trailing path", () => {
            expect(detectPage(u("/@MKBHD/videos"))).toEqual({
                kind: "handle",
                handle: "MKBHD",
            });
        });

        it("returns other on empty handle (/@)", () => {
            expect(detectPage(u("/@"))).toEqual({ kind: "other" });
        });
    });

    describe("channel", () => {
        it("recognises /channel/UC…", () => {
            expect(detectPage(u("/channel/UCBJycsmduvYEL83R_U4JriQ"))).toEqual({
                kind: "channel",
                channelId: "UCBJycsmduvYEL83R_U4JriQ",
            });
        });

        it("recognises /channel/UC… with trailing path", () => {
            expect(detectPage(u("/channel/UCBJycsmduvYEL83R_U4JriQ/videos"))).toEqual({
                kind: "channel",
                channelId: "UCBJycsmduvYEL83R_U4JriQ",
            });
        });

        it("returns other on empty channel id (/channel/)", () => {
            expect(detectPage(u("/channel/"))).toEqual({ kind: "other" });
        });
    });

    describe("watch", () => {
        it("recognises /watch?v=ID", () => {
            expect(detectPage(u("/watch?v=dQw4w9WgXcQ"))).toEqual({
                kind: "watch",
                videoId: "dQw4w9WgXcQ",
            });
        });

        it("returns other when v= is empty", () => {
            expect(detectPage(u("/watch?v="))).toEqual({ kind: "other" });
        });

        it("returns other when v= is missing", () => {
            expect(detectPage(u("/watch"))).toEqual({ kind: "other" });
        });
    });

    describe("playlist", () => {
        it("recognises /playlist?list=ID", () => {
            expect(detectPage(u("/playlist?list=PLBCF2DAC6FFB574DE"))).toEqual({
                kind: "playlist",
                listId: "PLBCF2DAC6FFB574DE",
            });
        });

        it("returns other when list= is empty", () => {
            expect(detectPage(u("/playlist?list="))).toEqual({ kind: "other" });
        });

        it("returns other when list= is missing", () => {
            expect(detectPage(u("/playlist"))).toEqual({ kind: "other" });
        });
    });

    describe("other", () => {
        it("returns other on /results", () => {
            expect(detectPage(u("/results?search_query=cat"))).toEqual({ kind: "other" });
        });

        it("returns other on /", () => {
            expect(detectPage(u("/"))).toEqual({ kind: "other" });
        });
    });
});
