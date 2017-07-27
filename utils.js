function getarr(d) {
  let arr = [d];

  for (let i = 1; i < arguments.length; i++) {
    let p = arguments[i];
    let v = arr[0][p];
    
    if (v === null || v === undefined) {
      return [];
    }

    arr = Array.isArray(v) ? v : [v];

    if (arr.length === 0) {
      return [];
    }
  }

  return arr;
}

module.exports = {
  getarr
}