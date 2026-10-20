const { orderPosts, postProblem } = require("../lib/postsApi.ts");

describe("event posts", () => {
  test("pinned first, then newest", () => {
    const posts = [
      { id: "old", pinned: false, show_from: "2027-05-01", created_at: "a" },
      { id: "pin", pinned: true, show_from: "2027-04-01", created_at: "a" },
      { id: "new", pinned: false, show_from: "2027-06-05", created_at: "a" },
    ];
    expect(orderPosts(posts).map((p) => p.id)).toEqual(["pin", "new", "old"]);
  });

  test("checks before saving", () => {
    expect(postProblem({ kind: "news", title: " ", link_url: null })).toBe("Enter a headline.");
    expect(postProblem({ kind: "advert", title: "", link_url: null })).toBe("Enter the advertiser's name.");
    expect(postProblem({ kind: "advert", title: "Hotel", link_url: "http://x" })).toBe("The link should start with https://");
    expect(postProblem({ kind: "news", title: "Ladies 32 confirmed", link_url: null })).toBeNull();
  });
});
