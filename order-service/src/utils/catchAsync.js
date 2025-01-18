module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
    // fn(req, res, next).catch(err=>next(err)); // alternative way to handle errors , the above one is the same as writing this line.
  };
};
