"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var Note =
/*#__PURE__*/
function () {
  function Note(note) {
    _classCallCheck(this, Note);

    this.note = note;
  }

  _createClass(Note, [{
    key: "model",
    get: function get() {
      switch (_typeof(this.note)) {
        case 'string':
          return {
            type: 'note',
            note: {
              texts: [{
                text: this.note
              }]
            }
          };

        default:
          return {
            type: 'note',
            note: this.note
          };
      }
    },
    set: function set(value) {
      // convenience - simplify unstyled notes
      var note = value.note;
      var texts = note.texts;

      if (texts.length === 1 && Object.keys(texts[0]).length === 1) {
        this.note = texts[0].text;
      } else {
        this.note = note;
      }
    }
  }], [{
    key: "fromModel",
    value: function fromModel(model) {
      var note = new Note();
      note.model = model;
      return note;
    }
  }]);

  return Note;
}();

module.exports = Note;
//# sourceMappingURL=note.js.map
