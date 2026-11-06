import { jest } from "@jest/globals";

const { APIFeatures } = await import("../../utils/apiFeatures.js");

// A chainable mock that mimics a Mongoose Query.
const makeQuery = (countResult = 7) => {
  const q = {};
  q.find = jest.fn().mockReturnValue(q);
  q.sort = jest.fn().mockReturnValue(q);
  q.select = jest.fn().mockReturnValue(q);
  q.skip = jest.fn().mockReturnValue(q);
  q.limit = jest.fn().mockReturnValue(q);
  q.getFilter = jest.fn().mockReturnValue({ resolved: "filter" });
  q.model = {
    find: jest.fn().mockReturnValue({
      countDocuments: jest.fn().mockResolvedValue(countResult),
    }),
  };
  return q;
};

describe("APIFeatures", () => {
  it("filter() should strip reserved keys before querying", () => {
    const q = makeQuery();
    new APIFeatures(q, {
      price: 10,
      page: "2",
      sort: "x",
      limit: "5",
      fields: "a",
    }).filter();

    expect(q.find).toHaveBeenCalledWith({ price: 10 });
  });

  it("sort() should default to -createdAt when no sort is given", () => {
    const q = makeQuery();
    new APIFeatures(q, {}).sort();
    expect(q.sort).toHaveBeenCalledWith("-createdAt");
  });

  it("sort() should translate a comma list to a space list", () => {
    const q = makeQuery();
    new APIFeatures(q, { sort: "price,-name" }).sort();
    expect(q.sort).toHaveBeenCalledWith("price -name");
  });

  it("limitFields() should default to excluding __v", () => {
    const q = makeQuery();
    new APIFeatures(q, {}).limitFields();
    expect(q.select).toHaveBeenCalledWith("-__v");
  });

  it("limitFields() should select the requested fields as a space list", () => {
    const q = makeQuery();
    new APIFeatures(q, { fields: "name,price" }).limitFields();
    expect(q.select).toHaveBeenCalledWith("name price");
  });

  it("paginate() should default to page 1 / limit 50", () => {
    const q = makeQuery();
    const f = new APIFeatures(q, {}).paginate();
    expect(q.skip).toHaveBeenCalledWith(0);
    expect(q.limit).toHaveBeenCalledWith(50);
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
  });

  it("paginate() should compute skip from page and limit", () => {
    const q = makeQuery();
    new APIFeatures(q, { page: "3", limit: "10" }).paginate();
    expect(q.skip).toHaveBeenCalledWith(20);
    expect(q.limit).toHaveBeenCalledWith(10);
  });

  it("getCount() should populate totalCount", async () => {
    const q = makeQuery(42);
    const f = new APIFeatures(q, {});
    await f.getCount();
    expect(q.model.find).toHaveBeenCalledWith({ resolved: "filter" });
    expect(f.totalCount).toBe(42);
  });

  it("process() should run the full chain and set totalCount", async () => {
    const q = makeQuery(5);
    const f = await new APIFeatures(q, { page: "1", limit: "20" }).process();

    expect(q.find).toHaveBeenCalled();
    expect(q.sort).toHaveBeenCalled();
    expect(q.select).toHaveBeenCalled();
    expect(q.skip).toHaveBeenCalled();
    expect(f.totalCount).toBe(5);
    expect(f.page).toBe(1);
    expect(f.limit).toBe(20);
  });
});
