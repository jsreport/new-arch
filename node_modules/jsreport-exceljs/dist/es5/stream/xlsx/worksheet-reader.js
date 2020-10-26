"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var Sax = require('sax');

var _ = require('../../utils/under-dash');

var utils = require('../../utils/utils');

var colCache = require('../../utils/col-cache');

var Dimensions = require('../../doc/range');

var Row = require('../../doc/row');

var Column = require('../../doc/column');

var WorksheetReader =
/*#__PURE__*/
function (_EventEmitter) {
  _inherits(WorksheetReader, _EventEmitter);

  function WorksheetReader(workbook, id) {
    var _this;

    _classCallCheck(this, WorksheetReader);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(WorksheetReader).call(this));
    _this.workbook = workbook;
    _this.id = id; // and a name

    _this.name = "Sheet".concat(_this.id); // column definitions

    _this._columns = null;
    _this._keys = {}; // keep a record of dimensions

    _this._dimensions = new Dimensions();
    return _this;
  } // destroy - not a valid operation for a streaming writer
  // even though some streamers might be able to, it's a bad idea.


  _createClass(WorksheetReader, [{
    key: "destroy",
    value: function destroy() {
      throw new Error('Invalid Operation: destroy');
    } // return the current dimensions of the writer

  }, {
    key: "getColumn",
    // get a single column by col number. If it doesn't exist, it and any gaps before it
    // are created.
    value: function getColumn(c) {
      if (typeof c === 'string') {
        // if it matches a key'd column, return that
        var col = this._keys[c];

        if (col) {
          return col;
        } // otherise, assume letter


        c = colCache.l2n(c);
      }

      if (!this._columns) {
        this._columns = [];
      }

      if (c > this._columns.length) {
        var n = this._columns.length + 1;

        while (n <= c) {
          this._columns.push(new Column(this, n++));
        }
      }

      return this._columns[c - 1];
    }
  }, {
    key: "getColumnKey",
    value: function getColumnKey(key) {
      return this._keys[key];
    }
  }, {
    key: "setColumnKey",
    value: function setColumnKey(key, value) {
      this._keys[key] = value;
    }
  }, {
    key: "deleteColumnKey",
    value: function deleteColumnKey(key) {
      delete this._keys[key];
    }
  }, {
    key: "eachColumnKey",
    value: function eachColumnKey(f) {
      _.each(this._keys, f);
    } // =========================================================================
    // Read

  }, {
    key: "_emitRow",
    value: function _emitRow(row) {
      this.emit('row', row);
    }
  }, {
    key: "read",
    value: function read(entry, options) {
      var _this2 = this;

      var emitSheet = false;
      var emitHyperlinks = false;
      var hyperlinks = null;

      switch (options.worksheets) {
        case 'emit':
          emitSheet = true;
          break;

        case 'prep':
          break;

        default:
          break;
      }

      switch (options.hyperlinks) {
        case 'emit':
          emitHyperlinks = true;
          break;

        case 'cache':
          this.hyperlinks = hyperlinks = {};
          break;

        default:
          break;
      }

      if (!emitSheet && !emitHyperlinks && !hyperlinks) {
        entry.autodrain();
        this.emit('finished');
        return;
      } // references


      var sharedStrings = this.workbook.sharedStrings;
      var styles = this.workbook.styles;
      var properties = this.workbook.properties; // xml position

      var inCols = false;
      var inRows = false;
      var inHyperlinks = false; // parse state

      var cols = null;
      var row = null;
      var c = null;
      var current = null;
      var parser = Sax.createStream(true, {});
      parser.on('opentag', function (node) {
        if (emitSheet) {
          switch (node.name) {
            case 'cols':
              inCols = true;
              cols = [];
              break;

            case 'sheetData':
              inRows = true;
              break;

            case 'col':
              if (inCols) {
                cols.push({
                  min: parseInt(node.attributes.min, 10),
                  max: parseInt(node.attributes.max, 10),
                  width: parseFloat(node.attributes.width),
                  styleId: parseInt(node.attributes.style || '0', 10)
                });
              }

              break;

            case 'row':
              if (inRows) {
                var r = parseInt(node.attributes.r, 10);
                row = new Row(_this2, r);

                if (node.attributes.ht) {
                  row.height = parseFloat(node.attributes.ht);
                }

                if (node.attributes.s) {
                  var styleId = parseInt(node.attributes.s, 10);
                  var style = styles.getStyleModel(styleId);

                  if (style) {
                    row.style = style;
                  }
                }
              }

              break;

            case 'c':
              if (row) {
                c = {
                  ref: node.attributes.r,
                  s: parseInt(node.attributes.s, 10),
                  t: node.attributes.t
                };
              }

              break;

            case 'f':
              if (c) {
                current = c.f = {
                  text: ''
                };
              }

              break;

            case 'v':
              if (c) {
                current = c.v = {
                  text: ''
                };
              }

              break;

            case 'mergeCell':
              break;

            default:
              break;
          }
        } // =================================================================
        //


        if (emitHyperlinks || hyperlinks) {
          switch (node.name) {
            case 'hyperlinks':
              inHyperlinks = true;
              break;

            case 'hyperlink':
              if (inHyperlinks) {
                var hyperlink = {
                  ref: node.attributes.ref,
                  rId: node.attributes['r:id']
                };

                if (emitHyperlinks) {
                  _this2.emit('hyperlink', hyperlink);
                } else {
                  hyperlinks[hyperlink.ref] = hyperlink;
                }
              }

              break;

            default:
              break;
          }
        }
      }); // only text data is for sheet values

      parser.on('text', function (text) {
        if (emitSheet) {
          if (current) {
            current.text += text;
          }
        }
      });
      parser.on('closetag', function (name) {
        if (emitSheet) {
          switch (name) {
            case 'cols':
              inCols = false;
              _this2._columns = Column.fromModel(cols);
              break;

            case 'sheetData':
              inRows = false;
              break;

            case 'row':
              _this2._dimensions.expandRow(row);

              _this2._emitRow(row);

              row = null;
              break;

            case 'c':
              if (row && c) {
                var address = colCache.decodeAddress(c.ref);
                var cell = row.getCell(address.col);

                if (c.s) {
                  var style = styles.getStyleModel(c.s);

                  if (style) {
                    cell.style = style;
                  }
                }

                if (c.f) {
                  var value = {
                    formula: c.f.text
                  };

                  if (c.v) {
                    if (c.t === 'str') {
                      value.result = utils.xmlDecode(c.v.text);
                    } else {
                      value.result = parseFloat(c.v.text);
                    }
                  }

                  cell.value = value;
                } else if (c.v) {
                  switch (c.t) {
                    case 's':
                      {
                        var index = parseInt(c.v.text, 10);

                        if (sharedStrings) {
                          cell.value = sharedStrings[index];
                        } else {
                          cell.value = {
                            sharedString: index
                          };
                        }

                        break;
                      }

                    case 'str':
                      cell.value = utils.xmlDecode(c.v.text);
                      break;

                    case 'e':
                      cell.value = {
                        error: c.v.text
                      };
                      break;

                    case 'b':
                      cell.value = parseInt(c.v.text, 10) !== 0;
                      break;

                    default:
                      if (utils.isDateFmt(cell.numFmt)) {
                        cell.value = utils.excelToDate(parseFloat(c.v.text), properties.model.date1904);
                      } else {
                        cell.value = parseFloat(c.v.text);
                      }

                      break;
                  }
                }

                if (hyperlinks) {
                  var hyperlink = hyperlinks[c.ref];

                  if (hyperlink) {
                    cell.text = cell.value;
                    cell.value = undefined;
                    cell.hyperlink = hyperlink;
                  }
                }

                c = null;
              }

              break;

            default:
              break;
          }
        }

        if (emitHyperlinks || hyperlinks) {
          switch (name) {
            case 'hyperlinks':
              inHyperlinks = false;
              break;

            default:
              break;
          }
        }
      });
      parser.on('error', function (error) {
        _this2.emit('error', error);
      });
      parser.on('end', function () {
        _this2.emit('finished');
      }); // create a down-stream flow-control to regulate the stream

      var flowControl = this.workbook.flowControl.createChild();
      flowControl.pipe(parser, {
        sync: true
      });
      entry.pipe(flowControl);
    }
  }, {
    key: "dimensions",
    get: function get() {
      return this._dimensions;
    } // =========================================================================
    // Columns
    // get the current columns array.

  }, {
    key: "columns",
    get: function get() {
      return this._columns;
    }
  }]);

  return WorksheetReader;
}(EventEmitter);

module.exports = WorksheetReader;
//# sourceMappingURL=worksheet-reader.js.map
