const Extend = require('underscore').extend;

function Base(schema, customFields) {
  let schemaCopy = Object.assign({}, schema);

  customFields = customFields || [];

  customFields.forEach((field) => {
    schemaCopy[field] = field;
  });

  return use(schemaCopy);
}

function use(schema) {
  return function(it) {
    let props = Object.keys(schema).map(function(key) {
      let p = schema[key];
      let v;

      if (typeof p === "string") {
        let chain = p.split('.');
        v = evaluateChain(chain, it);

        if (v === null || v === undefined) {
          return {};
        }

      } else if (typeof p === 'function') {
        v = p(it);
      } else {
        v = use(p)(it);
      }

      let obj = {};

      obj[key] = v;

      return obj;
    });

    return Extend.apply(null, props);
  };
}

function evaluateChain(chain, it) {
  for (let i = 0; i < chain.length; i++) {
    let name = chain[i];

    if (Array.isArray(it)) {
      it = mapget(it, name);
    } else {
      it = get(it, name);
    }

    if (it === null || it === undefined) {
      break;
    }
  }

  return it;
}


function get(obj, key) {
  let v;

  if (/^.+\[]$/.test(key)) {
    v = obj[key.substr(0, key.length - 2)] || [];
  } else {
    v = parse(key, obj[key]);
  }

  return v;
}

function mapget(arr, name) {
  return arr.map(function(x) {
    return get(x, name);
  });
}

function bool(x) {
  return typeof x === "string" ? x.toLowerCase() === 'true' : !!x;
}

function parse(key, val) {
  // unwrap array
  let v = Array.isArray(val) ? val[0] : val;

  if (/^f.+$/.test(key)) {
    return bool(v);
  } else if (/^[in].+$/.test(key)) {
    let i = parseInt(v, 10);
    return isNaN(i) ? v : i;
  } else if (/^dt.*$/.test(key)) {
    // TODO handle invalid dates
    return new Date(v);
  }

  return v;
}

module.exports = Base;