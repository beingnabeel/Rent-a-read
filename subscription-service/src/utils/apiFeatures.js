// REFACTORING API FEATURES
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }
  filter() {
    const queryObj = { ...this.queryString };
    console.log("Original query object:", queryObj);

    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B> ADVANCED FILTERING
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    console.log("Filtered query string:", queryStr);

    // Only apply the filter if there are actual filters
    if (Object.keys(JSON.parse(queryStr)).length > 0) {
      this.query = this.query.find(JSON.parse(queryStr));
    }

    console.log("MongoDB query:", this.query.getFilter());

    return this;
  }
  //   SEARCH
  search() {
    if (this.queryString.search) {
      const searchRegex = new RegExp(this.queryString.search, "i");
      console.log("Search query:", searchRegex);
      this.query = this.query.or([
        { title: searchRegex },
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
        { status: searchRegex },
        { paperType: searchRegex },
        { author: searchRegex },
        { publisher: searchRegex },
        { series: searchRegex },
        { shelfId: searchRegex },
      ]);
    }
    return this;
  }
  // SORTING
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }
  // field limits
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }
  // pagination
  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;
    console.log("Query string", this.queryString);
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
