"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var _ = {
  each: function each(obj, cb) {
    if (obj) {
      if (Array.isArray(obj)) {
        obj.forEach(cb);
      } else {
        Object.keys(obj).forEach(function (key) {
          cb(obj[key], key);
        });
      }
    }
  },
  some: function some(obj, cb) {
    if (obj) {
      if (Array.isArray(obj)) {
        return obj.some(cb);
      }

      return Object.keys(obj).some(function (key) {
        return cb(obj[key], key);
      });
    }

    return false;
  },
  every: function every(obj, cb) {
    if (obj) {
      if (Array.isArray(obj)) {
        return obj.every(cb);
      }

      return Object.keys(obj).every(function (key) {
        return cb(obj[key], key);
      });
    }

    return true;
  },
  map: function map(obj, cb) {
    if (obj) {
      if (Array.isArray(obj)) {
        return obj.map(cb);
      }

      return Object.keys(obj).map(function (key) {
        return cb(obj[key], key);
      });
    }

    return [];
  },
  keyBy: function keyBy(a, p) {
    return a.reduce(function (o, v) {
      o[v[p]] = v;
      return o;
    }, {});
  },
  isEqual: function isEqual(a, b) {
    var aType = _typeof(a);

    var bType = _typeof(b);

    var aArray = Array.isArray(a);
    var bArray = Array.isArray(b);

    if (aType !== bType) {
      return false;
    }

    switch (_typeof(a)) {
      case 'object':
        if (aArray || bArray) {
          if (aArray && bArray) {
            return a.length === b.length && a.every(function (aValue, index) {
              var bValue = b[index];
              return _.isEqual(aValue, bValue);
            });
          }

          return false;
        }

        return _.every(a, function (aValue, key) {
          var bValue = b[key];
          return _.isEqual(aValue, bValue);
        });

      default:
        return a === b;
    }
  },
  escapeHtml: function escapeHtml(html) {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },
  strcmp: function strcmp(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
};
module.exports = _;
//# sourceMappingURL=under-dash.js.map
